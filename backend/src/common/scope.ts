import { ForbiddenException } from '@nestjs/common';
import { AuthUser } from './decorators';

/** Prisma `where` fragment restricting Employee rows to the caller's branch scope. */
export function employeeScope(u: AuthUser): { branchId?: { in: string[] } } {
  return u.scopeBranchIds === null ? {} : { branchId: { in: u.scopeBranchIds } };
}

export function assertBranchInScope(u: AuthUser, branchId: string) {
  if (u.scopeBranchIds !== null && !u.scopeBranchIds.includes(branchId)) {
    throw new ForbiddenException('This branch is outside your access scope');
  }
}
