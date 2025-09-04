import { Controller, Post, Body, Get, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { Throttle } from '@nestjs/throttler';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ConfirmEmailDto } from './dto/confirm-email.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    if (!user) throw new BadRequestException('Invalid credentials');
    return this.authService.login(user);
  }

  @Post('register')
  async register(@Body() signupDto: SignupDto) {
    const user = await this.authService.register(signupDto);
    return { message: 'Registration successful. Check your email to confirm.' };
  }

  @Post('confirm-email')
  async confirmEmail(@Body() dto: ConfirmEmailDto) {
    const success = await this.authService.confirmEmail(dto.token);
    if (!success) throw new BadRequestException('Invalid or expired token');
    return { message: 'Email confirmed successfully' };
  }

  @Get('confirm-email')
  async confirmEmailByLink(@Query('token') token: string) {
    const success = await this.authService.confirmEmail(token);
    if (!success) throw new BadRequestException('Invalid or expired token');
    return { message: 'Email confirmed successfully via link!' };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { message: 'Password reset email sent if user exists' };
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const success = await this.authService.resetPassword(dto.token, dto.newPassword);
    if (!success) throw new BadRequestException('Invalid or expired token');
    return { message: 'Password reset successful' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Req() req: Request) {
    return req.user;
  }
}

