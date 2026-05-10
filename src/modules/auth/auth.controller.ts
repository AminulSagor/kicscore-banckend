import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';
import { ControllerResponse } from '../../common/interfaces/api-response.interface';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AuthService } from './auth.service';
import { AuthResponse } from './types/auth-response.type';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
  ): Promise<
    ControllerResponse<{ email: string; requiresVerification: true }>
  > {
    const data = await this.authService.register(dto);

    return {
      message: 'Account created successfully. Please verify your email.',
      data,
    };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body() dto: VerifyOtpDto,
  ): Promise<ControllerResponse<AuthResponse>> {
    const data = await this.authService.verifyEmail(dto);

    return {
      message: 'Email verified successfully',
      data,
    };
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  async resendOtp(
    @Body() dto: ResendOtpDto,
  ): Promise<ControllerResponse<null>> {
    await this.authService.resendVerificationOtp(dto);

    return {
      message: 'OTP sent successfully',
      data: null,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
  ): Promise<ControllerResponse<AuthResponse>> {
    const data = await this.authService.login(dto);

    return {
      message: 'Signed in successfully',
      data,
    };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<ControllerResponse<null>> {
    await this.authService.forgotPassword(dto);

    return {
      message: 'If this email exists, a reset code has been sent.',
      data: null,
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<ControllerResponse<null>> {
    await this.authService.resetPassword(dto);

    return {
      message: 'Password changed successfully',
      data: null,
    };
  }
}
