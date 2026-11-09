import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthUser, CurrentUser, MANAGERS, Public, Roles } from '../common/decorators';
import { ChangePasswordDto, LoginDto, MfaCodeDto, MfaVerifyDto, RefreshDto } from './auth.dto';
import { AuthService } from './auth.service';

const LOGIN_LIMIT = Number(process.env.LOGIN_RATE_LIMIT_PER_MIN ?? 10);

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public() @Post('login') @HttpCode(200)
  @Throttle({ default: { limit: LOGIN_LIMIT, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Req() req: any) {
    return this.auth.login(dto, req);
  }

  @Public() @Post('mfa/verify') @HttpCode(200)
  @Throttle({ default: { limit: LOGIN_LIMIT, ttl: 60_000 } })
  verifyMfa(@Body() dto: MfaVerifyDto, @Req() req: any) {
    return this.auth.verifyMfa(dto.mfaToken, dto.code, req);
  }

  @Public() @Post('refresh') @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public() @Post('logout') @HttpCode(200)
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  me(@CurrentUser() u: AuthUser) {
    return this.auth.me(u.userId);
  }

  @Post('change-password') @HttpCode(200)
  changePassword(@CurrentUser() u: AuthUser, @Body() dto: ChangePasswordDto, @Req() req: any) {
    return this.auth.changePassword(u.userId, dto, req);
  }

  @Roles(...MANAGERS) @Post('mfa/setup')
  mfaSetup(@CurrentUser() u: AuthUser) {
    return this.auth.mfaSetup(u.userId);
  }

  @Roles(...MANAGERS) @Post('mfa/enable') @HttpCode(200)
  mfaEnable(@CurrentUser() u: AuthUser, @Body() dto: MfaCodeDto) {
    return this.auth.mfaEnable(u.userId, dto.code);
  }
}
