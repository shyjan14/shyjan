import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { AuthUser, IS_PUBLIC, ROLES } from './decorators';
import { PrismaService } from './prisma.service';

/**
 * Global guard: every route requires a valid access token unless marked @Public().
 * User status and role are re-read from the database on each request so that
 * deactivation or role changes take effect immediately (not when the token expires).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector, private jwt: JwtService, private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Missing access token');

    let payload: { sub: string; typ: string };
    try {
      payload = await this.jwt.verifyAsync(header.slice(7), { secret: process.env.JWT_ACCESS_SECRET });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (payload.typ !== 'access') throw new UnauthorizedException('Invalid token type');

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { employee: { select: { id: true, branchId: true } }, managedBranches: { select: { id: true } } },
    });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Account disabled');

    const hr = user.role === 'HR_ADMIN' || user.role === 'SUPER_ADMIN';
    const scope = hr
      ? null
      : user.role === 'BRANCH_MANAGER'
        ? user.managedBranches.map((b) => b.id)
        : user.employee
          ? [user.employee.branchId]
          : [];

    const authUser: AuthUser = {
      userId: user.id,
      role: user.role,
      employeeId: user.employee?.id ?? null,
      branchId: user.employee?.branchId ?? null,
      scopeBranchIds: scope,
    };
    req.user = authUser;

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, targets);
    if (roles?.length && !roles.includes(user.role)) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
