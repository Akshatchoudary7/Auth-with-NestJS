import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/user.entity';
import { SignupDto } from './dto/signup.dto';

import { ConfigService } from '@nestjs/config';
import { MailerService } from '../mailer/mailer.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
  ) {}

  //  Register user & send email confirmation
  async register(dto: SignupDto) {
    const existing = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Email already exists');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepo.create({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
    });
    await this.usersRepo.save(user);

    // generate email confirmation token
    const token = uuidv4();
    user.resetToken = token; // reusing resetToken field for email confirm
    user.resetTokenExpiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
    await this.usersRepo.save(user);

    const confirmUrl = `http://localhost:3000/auth/confirm-email?token=${token}`;
    await this.mailerService.sendMail(
      user.email,
      'Confirm your email',
      `<p>Click to confirm your email: <a href="${confirmUrl}">Confirm</a></p>`,
    );

    return user;
  }

  //  Validate user credentials
  async validateUser(email: string, password: string) {
    const user = await this.usersRepo.findOne({ where: { email } });
    if (!user) return null;

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) return null;

    if (!user.isEmailConfirmed) throw new BadRequestException('Email not confirmed');
    return user;
  }

  // Login & generate JWT
  async login(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }

  //  Confirm email
  async confirmEmail(token: string) {
    const user = await this.usersRepo.findOne({ where: { resetToken: token } });
    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) return false;

    user.isEmailConfirmed = true;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await this.usersRepo.save(user);
    return true;
  }

  //  Forgot password
  async forgotPassword(email: string) {
    const user = await this.usersRepo.findOne({ where: { email } });
    if (!user) return; // silently fail

    const token = uuidv4();
    user.resetToken = token;
    user.resetTokenExpiry = new Date(Date.now() + 1000 * 60 * 15); // 15 mins
    await this.usersRepo.save(user);

    const resetUrl = `http://localhost:3000/auth/reset-password?token=${token}`;
    await this.mailerService.sendMail(
      user.email,
      'Reset your password',
      `<p>Click to reset your password: <a href="${resetUrl}">Reset Password</a></p>`,
    );
  }


  async resetPassword(token: string, newPassword: string) {
    const user = await this.usersRepo.findOne({ where: { resetToken: token } });
    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) return false;

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await this.usersRepo.save(user);
    return true;
  }
}
