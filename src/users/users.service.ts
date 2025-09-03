import { Injectable, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(user: Partial<User>) {
    if (!user.password) {
      throw new Error('Password is required');
    }

    // Pre-check for duplicate email
    if (!user.email) {
      throw new Error('Email is required');
    }
    const existing = await this.findByEmail(user.email);
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    user.password = await argon2.hash(user.password);

    try {
      return await this.usersRepository.save(user);
    } catch (err: any) {
      // Handle race condition / DB-level duplicate
      if (err.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Email already exists');
      }
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  async findByEmail(email: string) {
    return this.usersRepository.findOne({ where: { email } });
  }

  async validateUser(email: string, password: string) {
    const user = await this.findByEmail(email);
    if (user && (await argon2.verify(user.password, password))) {
      const { password: _pass, ...result } = user;
      return result;
    }
    return null;
  }
}
