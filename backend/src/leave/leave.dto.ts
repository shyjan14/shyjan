import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

export class ApplyLeaveDto {
  @IsUUID() leaveTypeId!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) fromDate!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) toDate!: string;
  @IsOptional() @IsIn(['FIRST_HALF', 'SECOND_HALF']) halfDay?: 'FIRST_HALF' | 'SECOND_HALF';
  @IsString() @MaxLength(1000) reason!: string;
}

export class LeaveDecisionDto {
  @IsIn(['APPROVE', 'REJECT']) action!: 'APPROVE' | 'REJECT';
  @IsOptional() @IsString() @MaxLength(500) comment?: string;
}

export class AdjustBalanceDto {
  @IsUUID() employeeId!: string;
  @IsUUID() leaveTypeId!: string;
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year!: number;
  @Type(() => Number) @IsNumber() @Min(-365) @Max(365) days!: number;
  @IsString() @MaxLength(300) reason!: string;
}
