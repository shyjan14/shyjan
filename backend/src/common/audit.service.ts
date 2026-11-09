import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

const SENSITIVE = ['passwordHash', 'mfaSecret', 'iban', 'tokenHash'];

function redact(v: unknown): Prisma.InputJsonValue | undefined {
  if (v === undefined || v === null) return undefined;
  const obj = JSON.parse(JSON.stringify(v));
  if (obj && typeof obj === 'object') for (const k of SENSITIVE) if (k in obj) obj[k] = '***';
  return obj;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    actorId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
    req?: { ip?: string; headers?: Record<string, unknown> };
  }) {
    await this.prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        oldValue: redact(params.oldValue),
        newValue: redact(params.newValue),
        ip: params.req?.ip,
        userAgent: (params.req?.headers?.['user-agent'] as string | undefined)?.slice(0, 300),
      },
    });
  }
}
