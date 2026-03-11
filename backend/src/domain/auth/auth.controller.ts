import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@src/common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto } from './dto/login.dto';
import type { UserWithMemberships } from './strategies/jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refresh(refreshTokenDto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: UserWithMemberships) {
    return this.authService.logout(user.id);
  }
}
