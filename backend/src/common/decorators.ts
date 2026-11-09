import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export interface AuthUser {
  userId: string;
  role: Role;
  employeeId: string | null;
  branchId: string | null;
  /** Branch IDs this user may see. null = all branches (HR / Super Admin). */
  scopeBranchIds: string[] | null;
}

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const MANAGERS: Role[] = ['BRANCH_MANAGER', 'HR_ADMIN', 'SUPER_ADMIN'];
export const HR: Role[] = ['HR_ADMIN', 'SUPER_ADMIN'];

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

export function isHr(u: AuthUser) {
  return u.role === 'HR_ADMIN' || u.role === 'SUPER_ADMIN';
}
