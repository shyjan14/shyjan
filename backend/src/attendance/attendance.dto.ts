import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsIn, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { PunchType } from '@prisma/client';

const toBool = ({ value }: { value: unknown }) => value === true || value === 'true' || value === '1';

/** Sent as multipart/form-data together with a `selfie` JPEG. */
export class PunchDto {
  @IsEnum(PunchType) type!: PunchType;
  @Type(() => Number) @IsLatitude() latitude!: number;
  @Type(() => Number) @IsLongitude() longitude!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(10000) accuracy!: number;
  @IsOptional() @Transform(toBool) @IsBoolean() isMockLocation?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() isRooted?: boolean;
  @IsOptional() @IsString() @MaxLength(40) wifiBssid?: string;
  @IsOptional() @IsDateString() deviceTime?: string;
  /** Offline punch captured earlier and synced now. */
  @IsOptional() @Transform(toBool) @IsBoolean() offline?: boolean;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class ManualPunchDto {
  @IsUUID() employeeId!: string;
  @IsEnum(PunchType) type!: PunchType;
  @IsDateString() time!: string;
  @IsString() @MaxLength(300) reason!: string;
}

export class RegularizationDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
  @IsOptional() @IsDateString() checkIn?: string;
  @IsOptional() @IsDateString() checkOut?: string;
  @IsString() @MaxLength(500) reason!: string;
}

export class DecisionDto {
  @IsIn(['APPROVE', 'REJECT']) action!: 'APPROVE' | 'REJECT';
  @IsOptional() @IsString() @MaxLength(500) comment?: string;
}
