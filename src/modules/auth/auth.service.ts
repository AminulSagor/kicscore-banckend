import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { generateFourDigitOtp } from '../../common/utils/otp.util';
import { compareHash, hashValue } from '../../common/utils/password.util';
import { SesService } from '../aws/ses.service';
import { UserProfile } from '../users/entities/user-profile.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { UserStatus } from '../users/enums/user-status.enum';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpCode } from './entities/otp-code.entity';
import { OtpPurpose } from './enums/otp-purpose.enum';
import { AuthResponse, AuthTokenResponse } from './types/auth-response.type';
import { JwtPayload } from './types/jwt-payload.type';
import { PendingRegistration } from '../users/entities/pending-registration.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly sesService: SesService,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(OtpCode)
    private readonly otpCodeRepository: Repository<OtpCode>,

    @InjectRepository(PendingRegistration)
    private readonly pendingRegistrationRepository: Repository<PendingRegistration>,
  ) {}

  private async createOrUpdatePendingRegistration(
    dto: RegisterDto,
  ): Promise<void> {
    const email = dto.email.toLowerCase().trim();

    const existingPending = await this.pendingRegistrationRepository.findOne({
      where: { email },
    });

    if (existingPending) {
      await this.ensurePendingRegistrationOtpCooldown(existingPending);
    }

    const isDevelopment =
      this.configService.get<string>('NODE_ENV') === 'development';

    const shouldBypassEmail =
      this.configService.get<string>('BYPASS_EMAIL') === 'true';

    const bypassOtp = this.configService.get<string>('BYPASS_OTP') ?? '1234';

    const otp =
      isDevelopment && shouldBypassEmail ? bypassOtp : generateFourDigitOtp();

    const otpHash = await hashValue(otp);
    const passwordHash = await hashValue(dto.password);

    const otpExpiresAt = this.getOtpExpiresAt();
    const pendingRegistrationExpiresAt = this.getPendingRegistrationExpiresAt();

    if (existingPending) {
      existingPending.fullName = dto.fullName.trim();
      existingPending.passwordHash = passwordHash;
      existingPending.otpHash = otpHash;
      existingPending.otpExpiresAt = otpExpiresAt;
      existingPending.otpAttemptCount = 0;
      existingPending.lastOtpSentAt = new Date();
      existingPending.expiresAt = pendingRegistrationExpiresAt;

      await this.pendingRegistrationRepository.save(existingPending);
    } else {
      const pendingRegistration = this.pendingRegistrationRepository.create({
        email,
        fullName: dto.fullName.trim(),
        passwordHash,
        otpHash,
        otpExpiresAt,
        otpAttemptCount: 0,
        lastOtpSentAt: new Date(),
        expiresAt: pendingRegistrationExpiresAt,
      });

      await this.pendingRegistrationRepository.save(pendingRegistration);
    }

    if (!isDevelopment || !shouldBypassEmail) {
      await this.sesService.sendOtpEmail(
        email,
        otp,
        OtpPurpose.EMAIL_VERIFICATION,
      );
    }
  }

  private async ensurePendingRegistrationOtpCooldown(
    pendingRegistration: PendingRegistration,
  ): Promise<void> {
    const cooldownSeconds = Number(
      this.configService.get<string>('OTP_RESEND_COOLDOWN_SECONDS') ?? 60,
    );

    const nextAllowedTime =
      pendingRegistration.lastOtpSentAt.getTime() + cooldownSeconds * 1000;

    if (Date.now() < nextAllowedTime) {
      throw new HttpException(
        'Please wait before requesting another OTP',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private getOtpExpiresAt(): Date {
    const expiresInMinutes = Number(
      this.configService.get<string>('OTP_EXPIRES_IN_MINUTES') ?? 10,
    );

    return new Date(Date.now() + expiresInMinutes * 60 * 1000);
  }

  private getPendingRegistrationExpiresAt(): Date {
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  async register(
    dto: RegisterDto,
  ): Promise<{ email: string; requiresVerification: true }> {
    const email = dto.email.toLowerCase().trim();

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    await this.createOrUpdatePendingRegistration(dto);

    return {
      email,
      requiresVerification: true,
    };
  }

  async verifyEmail(dto: VerifyOtpDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase().trim();

    const pendingRegistration =
      await this.pendingRegistrationRepository.findOne({
        where: { email },
      });

    if (!pendingRegistration) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (pendingRegistration.expiresAt.getTime() < Date.now()) {
      await this.pendingRegistrationRepository.delete(pendingRegistration.id);
      throw new BadRequestException('Invalid or expired OTP');
    }

    const maxAttempts = Number(
      this.configService.get<string>('OTP_MAX_ATTEMPTS') ?? 5,
    );

    if (pendingRegistration.otpAttemptCount >= maxAttempts) {
      throw new BadRequestException(
        'Too many OTP attempts. Please request a new code.',
      );
    }

    if (pendingRegistration.otpExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const otpMatched = await compareHash(dto.otp, pendingRegistration.otpHash);

    if (!otpMatched) {
      pendingRegistration.otpAttemptCount += 1;
      await this.pendingRegistrationRepository.save(pendingRegistration);

      throw new BadRequestException('Invalid or expired OTP');
    }

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      await this.pendingRegistrationRepository.delete(pendingRegistration.id);
      throw new ConflictException('Email is already registered');
    }

    const savedUser = await this.userRepository.manager.transaction(
      async (manager) => {
        const user = manager.create(User, {
          email: pendingRegistration.email,
          passwordHash: pendingRegistration.passwordHash,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
          lastLoginAt: new Date(),
        });

        const createdUser = await manager.save(User, user);

        const profile = manager.create(UserProfile, {
          userId: createdUser.id,
          fullName: pendingRegistration.fullName,
          profilePhotoFileId: null,
        });

        const createdProfile = await manager.save(UserProfile, profile);

        await manager.delete(PendingRegistration, pendingRegistration.id);

        createdUser.profile = createdProfile;

        return createdUser;
      },
    );

    return this.buildAuthResponse(savedUser);
  }

  async resendVerificationOtp(dto: ResendOtpDto): Promise<void> {
    const email = dto.email.toLowerCase().trim();

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      return;
    }

    const pendingRegistration =
      await this.pendingRegistrationRepository.findOne({
        where: { email },
      });

    if (!pendingRegistration) {
      return;
    }

    await this.ensurePendingRegistrationOtpCooldown(pendingRegistration);

    const isDevelopment =
      this.configService.get<string>('NODE_ENV') === 'development';

    const shouldBypassEmail =
      this.configService.get<string>('BYPASS_EMAIL') === 'true';

    const bypassOtp = this.configService.get<string>('BYPASS_OTP') ?? '1234';

    const otp =
      isDevelopment && shouldBypassEmail ? bypassOtp : generateFourDigitOtp();

    const otpHash = await hashValue(otp);

    pendingRegistration.otpHash = otpHash;
    pendingRegistration.otpExpiresAt = this.getOtpExpiresAt();
    pendingRegistration.otpAttemptCount = 0;
    pendingRegistration.lastOtpSentAt = new Date();

    // Important: extend pending registration lifetime also
    pendingRegistration.expiresAt = this.getPendingRegistrationExpiresAt();

    await this.pendingRegistrationRepository.save(pendingRegistration);

    if (!isDevelopment || !shouldBypassEmail) {
      await this.sesService.sendOtpEmail(
        email,
        otp,
        OtpPurpose.EMAIL_VERIFICATION,
      );
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase().trim();

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.profile', 'profile')
      .where('user.email = :email', { email })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatched = await compareHash(dto.password, user.passwordHash);

    if (!passwordMatched) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new ForbiddenException('Account is not verified');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Account is not active');
    }

    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    return this.buildAuthResponse(user);
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const email = dto.email.toLowerCase().trim();

    const user = await this.userRepository.findOne({
      where: { email, status: UserStatus.ACTIVE },
    });

    if (!user) {
      return;
    }

    await this.ensureOtpCooldown(email, OtpPurpose.PASSWORD_RESET);

    await this.createAndSendOtp(user.id, email, OtpPurpose.PASSWORD_RESET);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const email = dto.email.toLowerCase().trim();

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .andWhere('user.status = :status', { status: UserStatus.ACTIVE })
      .getOne();

    if (!user) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.verifyOtp(email, dto.otp, OtpPurpose.PASSWORD_RESET);

    user.passwordHash = await hashValue(dto.newPassword);
    await this.userRepository.save(user);
  }

  private async buildAuthResponse(user: User): Promise<AuthResponse> {
    const token = await this.createAccessToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.profile?.fullName ?? '',
        role: user.role,
      },
      token,
    };
  }

  private async createAccessToken(user: User): Promise<AuthTokenResponse> {
    const expiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '7d';

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
    };
  }

  private async createAndSendOtp(
    userId: string,
    email: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    await this.otpCodeRepository.update(
      {
        email,
        purpose,
        consumedAt: IsNull(),
      },
      {
        consumedAt: new Date(),
      },
    );

    const isDevelopment =
      this.configService.get<string>('NODE_ENV') === 'development';

    const shouldBypassEmail =
      this.configService.get<string>('BYPASS_EMAIL') === 'true';

    const bypassOtp = this.configService.get<string>('BYPASS_OTP') ?? '1234';

    const otp =
      isDevelopment && shouldBypassEmail ? bypassOtp : generateFourDigitOtp();

    const otpHash = await hashValue(otp);

    const expiresInMinutes = Number(
      this.configService.get<string>('OTP_EXPIRES_IN_MINUTES') ?? 10,
    );

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

    const otpCode = this.otpCodeRepository.create({
      userId,
      email,
      purpose,
      otpHash,
      expiresAt,
      consumedAt: null,
      attemptCount: 0,
    });

    await this.otpCodeRepository.save(otpCode);

    if (!isDevelopment || !shouldBypassEmail) {
      await this.sesService.sendOtpEmail(email, otp, purpose);
    }
  }

  private async verifyOtp(
    email: string,
    otp: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const otpCode = await this.otpCodeRepository.findOne({
      where: {
        email,
        purpose,
        consumedAt: IsNull(),
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (!otpCode) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const maxAttempts = Number(
      this.configService.get<string>('OTP_MAX_ATTEMPTS') ?? 5,
    );

    if (otpCode.attemptCount >= maxAttempts) {
      throw new BadRequestException(
        'Too many OTP attempts. Please request a new code.',
      );
    }

    if (otpCode.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const matched = await compareHash(otp, otpCode.otpHash);

    if (!matched) {
      otpCode.attemptCount += 1;
      await this.otpCodeRepository.save(otpCode);

      throw new BadRequestException('Invalid or expired OTP');
    }

    otpCode.consumedAt = new Date();
    await this.otpCodeRepository.save(otpCode);
  }

  private async ensureOtpCooldown(
    email: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const latestOtp = await this.otpCodeRepository.findOne({
      where: {
        email,
        purpose,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (!latestOtp) {
      return;
    }

    const cooldownSeconds = Number(
      this.configService.get<string>('OTP_RESEND_COOLDOWN_SECONDS') ?? 60,
    );

    const nextAllowedTime =
      latestOtp.createdAt.getTime() + cooldownSeconds * 1000;

    if (Date.now() < nextAllowedTime) {
      throw new HttpException(
        'Please wait before requesting another OTP',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
