import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/, {
    message: 'OTP must be a 4 digit code',
  })
  otp: string;
}
