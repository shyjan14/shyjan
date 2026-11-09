import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsIn, IsNumber, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';
import { DocumentType, Gender, Role, WorkMode } from '@prisma/client';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateEmployeeDto {
  @Matches(/^[A-Za-z0-9-]{2,20}$/) employeeCode!: string;
  @IsEmail() email!: string;
  @IsOptional() @Matches(/^\+?\d{8,15}$/, { message: 'phone must be like +9715XXXXXXXX' }) phone?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsUUID() branchId!: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() managerId?: string;
  @IsOptional() @IsUUID() shiftId?: string;
  @IsString() @MaxLength(60) firstName!: string;
  @IsString() @MaxLength(60) lastName!: string;
  @IsOptional() @IsString() @MaxLength(120) nameArabic?: string;
  @IsString() @MaxLength(80) designation!: string;
  @IsEnum(Gender) gender!: Gender;
  @IsOptional() @Matches(DATE) dateOfBirth?: string;
  @IsString() @MaxLength(60) nationality!: string;
  @IsOptional() @IsString() @MaxLength(20) maritalStatus?: string;
  @IsOptional() @IsString() @MaxLength(30) religion?: string;
  @IsOptional() @IsString() @MaxLength(5) bloodGroup?: string;
  @IsOptional() @IsString() @MaxLength(300) uaeAddress?: string;
  @IsOptional() @IsString() @MaxLength(40) emirate?: string;
  @IsOptional() @IsString() @MaxLength(300) homeAddress?: string;
  @IsOptional() @IsString() @MaxLength(80) emergencyName?: string;
  @IsOptional() @IsString() @MaxLength(40) emergencyRelation?: string;
  @IsOptional() @IsString() @MaxLength(20) emergencyPhone?: string;
  @Matches(DATE) joiningDate!: string;
  @IsOptional() @Matches(DATE) probationEnd?: string;
  @IsOptional() @IsIn(['LIMITED', 'UNLIMITED']) contractType?: string;
  @IsOptional() @Matches(DATE) contractEnd?: string;
  @IsOptional() @IsEnum(WorkMode) workMode?: WorkMode;
  @IsOptional() @IsBoolean() allowRemotePunch?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) basicSalary?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) housingAllow?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) transportAllow?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) otherAllow?: number;
  @IsOptional() @Matches(/^AE\d{21}$/, { message: 'IBAN must be a UAE IBAN (AE + 21 digits)' }) iban?: string;
  @IsOptional() @IsString() @MaxLength(80) bankName?: string;
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: 'ACTIVE' | 'INACTIVE';
}

/** Fields an employee may change on their own profile. */
export class SelfUpdateDto {
  @IsOptional() @Matches(/^\+?\d{8,15}$/) phone?: string;
  @IsOptional() @IsString() @MaxLength(300) uaeAddress?: string;
  @IsOptional() @IsString() @MaxLength(40) emirate?: string;
  @IsOptional() @IsString() @MaxLength(300) homeAddress?: string;
  @IsOptional() @IsString() @MaxLength(80) emergencyName?: string;
  @IsOptional() @IsString() @MaxLength(40) emergencyRelation?: string;
  @IsOptional() @IsString() @MaxLength(20) emergencyPhone?: string;
}

export class DocumentDto {
  @IsEnum(DocumentType) type!: DocumentType;
  @IsOptional() @IsString() @MaxLength(60) number?: string;
  @IsOptional() @Matches(DATE) issueDate?: string;
  @IsOptional() @Matches(DATE) expiryDate?: string;
  @IsOptional() @IsString() @MaxLength(300) notes?: string;
}
