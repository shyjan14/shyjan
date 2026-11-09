import { IsNotEmpty, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  /** Employee code (e.g. EMP001) or email */
  @IsString() @IsNotEmpty() @MaxLength(120) login!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) password!: string;
  /** Stable device identifier from the mobile app. Omitted by the web portal. */
  @IsOptional() @IsString() @MaxLength(200) deviceId?: string;
  @IsOptional() @IsString() @MaxLength(120) deviceModel?: string;
  @IsOptional() @IsString() @MaxLength(40) platform?: string;
}

export class RefreshDto {
  @IsString() @IsNotEmpty() refreshToken!: string;
}

export class MfaVerifyDto {
  @IsString() @IsNotEmpty() mfaToken!: string;
  @IsString() @Length(6, 6) code!: string;
}

export class MfaCodeDto {
  @IsString() @Length(6, 6) code!: string;
}

export class ChangePasswordDto {
  @IsString() @IsNotEmpty() currentPassword!: string;
  @IsString()
  @MinLength(10, { message: 'Password must be at least 10 characters' })
  @MaxLength(200)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, { message: 'Password needs upper case, lower case and a number' })
  newPassword!: string;
}
