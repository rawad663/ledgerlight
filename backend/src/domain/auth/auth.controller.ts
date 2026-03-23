import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '@src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@src/common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto } from './dto/login.dto';
import type { UserWithMemberships } from './strategies/jwt.strategy';
import { ApiDoc } from '@src/common/swagger/api-doc.decorator';
import { LoginResponseDto, RefreshResponseDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiDoc({
    summary: 'Login with email and password',
    description:
      'Returns a short-lived access token (JWT), a refresh token, and the user context with memberships.',
    body: LoginDto,
    ok: LoginResponseDto,
    badRequestDesc: 'Invalid payload',
  })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @ApiDoc({
    summary: 'Refresh access token',
    description:
      'Exchanges a valid refresh token for a new access token and returns the current user context.',
    body: RefreshTokenDto,
    ok: RefreshResponseDto,
    badRequestDesc: 'Invalid payload',
  })
  refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refresh(refreshTokenDto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  @ApiDoc({
    summary: 'Logout current user',
    description:
      'Revokes all active refresh tokens for the current user. Requires a valid access token.',
    noContent: true,
    auth: true,
  })
  logout(@CurrentUser() user: UserWithMemberships) {
    return this.authService.logout(user.id);
  }
}
