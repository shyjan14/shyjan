import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../common/audit.service';
import { PrismaService } from '../common/prisma.service';
import { generateSecret, otpauthUrl, verifyTotp } from '../common/totp';
import { ChangePasswordDto, LoginDto } from './auth.dto';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 10);
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
type Req = { ip?: string; headers?: Record<string, unknown> };

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private audit: AuditService) {}

  async login(dto: LoginDto, req: Req) {
    const login = dto.login.trim();
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ employeeCode: login.toUpperCase() }, { email: login.toLowerCase() }] },
    });
    // Same error for unknown user / wrong password to avoid account enumeration.
    const invalid = new UnauthorizedException('Invalid login or password');
    if (!user) {
      await bcrypt.compare(dto.password, DUMMY_HASH); // equalise timing
      throw invalid;
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException(`Account locked after too many attempts. Try again after ${user.lockedUntil.toISOString()}`);
    }
    if (user.status !== 'ACTIVE') throw new ForbiddenException('Account is disabled. Contact HR.');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      const failed = user.failedLogins + 1;
      const lock = failed >= MAX_FAILED;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
      });
      await this.audit.log({ actorId: user.id, action: lock ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED', entity: 'User', entityId: user.id, req });
      throw invalid;
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });

    let deviceStatus: string | null = null;
    if (dto.deviceId) deviceStatus = await this.bindDevice(user, dto);

    if (user.mfaEnabled) {
      const mfaToken = await this.jwt.signAsync(
        { sub: user.id, typ: 'mfa', dev: dto.deviceId ?? null },
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '5m' },
      );
      return { mfaRequired: true, mfaToken };
    }
    return this.completeLogin(user, dto.deviceId ?? null, deviceStatus, req);
  }

  async verifyMfa(mfaToken: string, code: string, req: Req) {
    let p: { sub: string; typ: string; dev: string | null };
    try {
      p = await this.jwt.verifyAsync(mfaToken, { secret: process.env.JWT_ACCESS_SECRET });
    } catch {
      throw new UnauthorizedException('MFA session expired, please log in again');
    }
    if (p.typ !== 'mfa') throw new UnauthorizedException();
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: p.sub } });
    if (!user.mfaSecret || !verifyTotp(user.mfaSecret, code)) {
      await this.audit.log({ actorId: user.id, action: 'MFA_FAILED', entity: 'User', entityId: user.id, req });
      throw new UnauthorizedException('Invalid authentication code');
    }
    const dev = p.dev ? await this.prisma.device.findUnique({ where: { userId_deviceId: { userId: user.id, deviceId: p.dev } } }) : null;
    return this.completeLogin(user, p.dev, dev?.status ?? null, req);
  }

  /** First device is activated automatically; any new device needs HR approval before it can punch. */
  private async bindDevice(user: User, dto: LoginDto): Promise<string> {
    const existing = await this.prisma.device.findUnique({ where: { userId_deviceId: { userId: user.id, deviceId: dto.deviceId! } } });
    if (existing) {
      if (existing.status === 'REVOKED') throw new ForbiddenException('This device has been blocked. Contact HR.');
      return existing.status;
    }
    const active = await this.prisma.device.count({ where: { userId: user.id, status: 'ACTIVE' } });
    const dev = await this.prisma.device.create({
      data: {
        userId: user.id,
        deviceId: dto.deviceId!,
        model: dto.deviceModel,
        platform: dto.platform,
        status: active === 0 ? 'ACTIVE' : 'PENDING',
        approvedAt: active === 0 ? new Date() : null,
      },
    });
    await this.audit.log({ actorId: user.id, action: 'DEVICE_REGISTERED', entity: 'Device', entityId: dev.id, newValue: { model: dev.model, status: dev.status } });
    return dev.status;
  }

  private async completeLogin(user: User, deviceId: string | null, deviceStatus: string | null, req: Req) {
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log({ actorId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, req });
    const tokens = await this.issueTokens(user.id, deviceId);
    return { ...tokens, mustChangePassword: user.mustChangePwd, deviceStatus, user: await this.me(user.id) };
  }

  private async issueTokens(userId: string, deviceId: string | null) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, typ: 'access' },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: process.env.ACCESS_TOKEN_TTL ?? '15m' },
    );
    const refreshToken = randomBytes(48).toString('base64url');
    const days = Number(process.env.REFRESH_TOKEN_DAYS ?? 30);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: sha256(refreshToken), deviceId, expiresAt: new Date(Date.now() + days * 86_400_000) },
    });
    return { accessToken, refreshToken };
  }

  /** Rotating refresh tokens. Re-use of an already-rotated token revokes every session of that user (token theft). */
  async refresh(refreshToken: string) {
    const rt = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) }, include: { user: true } });
    if (!rt) throw new UnauthorizedException('Invalid session');
    if (rt.revokedAt) {
      await this.prisma.refreshToken.updateMany({ where: { userId: rt.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.log({ actorId: rt.userId, action: 'REFRESH_TOKEN_REUSE', entity: 'User', entityId: rt.userId });
      throw new UnauthorizedException('Session revoked, please log in again');
    }
    if (rt.expiresAt < new Date() || rt.user.status !== 'ACTIVE') throw new UnauthorizedException('Session expired');
    await this.prisma.refreshToken.update({ where: { id: rt.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(rt.userId, rt.deviceId);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({ where: { tokenHash: sha256(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto, req: Req) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) throw new BadRequestException('Current password is incorrect');
    if (dto.currentPassword === dto.newPassword) throw new BadRequestException('New password must be different');
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(dto.newPassword, 10), mustChangePwd: false } });
    // Log out every other session.
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log({ actorId: userId, action: 'PASSWORD_CHANGED', entity: 'User', entityId: userId, req });
    return { ok: true };
  }

  async mfaSetup(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.mfaEnabled) throw new BadRequestException('MFA is already enabled');
    const secret = generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { mfaSecret: secret } });
    return { secret, otpauthUrl: otpauthUrl(secret, user.email, 'HRMS') };
  }

  async mfaEnable(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaSecret || !verifyTotp(user.mfaSecret, code)) throw new BadRequestException('Invalid code');
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    await this.audit.log({ actorId: userId, action: 'MFA_ENABLED', entity: 'User', entityId: userId });
    return { ok: true };
  }

  async me(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true, employeeCode: true, email: true, phone: true, role: true, mfaEnabled: true, mustChangePwd: true,
        managedBranches: { select: { id: true, name: true } },
        employee: {
          select: {
            id: true, firstName: true, lastName: true, designation: true, photoUrl: true, allowRemotePunch: true,
            branch: { select: { id: true, name: true, latitude: true, longitude: true, radiusM: true } },
            department: { select: { name: true } },
            shift: true,
          },
        },
      },
    });
    return u;
  }
}
