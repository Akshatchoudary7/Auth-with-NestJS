import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';

// Mock repository
const mockRepository = () => ({
  save: jest.fn(),
  findOne: jest.fn(),
});

// Mock argon2
jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useFactory: mockRepository },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(getRepositoryToken(User));
  });

  describe('create', () => {
    it('should throw error if password is missing', async () => {
      await expect(service.create({ email: 'test@test.com' })).rejects.toThrow(
        'Password is required',
      );
    });

    it('should throw error if email is missing', async () => {
      await expect(service.create({ password: '1234' })).rejects.toThrow(
        'Email is required',
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      repository.findOne.mockResolvedValue({ id: 1, email: 'test@test.com' } as User);

      await expect(
        service.create({ email: 'test@test.com', password: '1234' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should hash password and save user', async () => {
      repository.findOne.mockResolvedValue(null);
      (argon2.hash as jest.Mock).mockResolvedValue('hashedPassword');
      repository.save.mockResolvedValue({ id: 1, email: 'new@test.com', password: 'hashedPassword' } as User);

      const result = await service.create({ email: 'new@test.com', password: '1234' });

      expect(argon2.hash).toHaveBeenCalledWith('1234');
      expect(repository.save).toHaveBeenCalledWith({
        email: 'new@test.com',
        password: 'hashedPassword',
      });
      expect(result).toHaveProperty('id');
    });

    it('should handle duplicate DB error', async () => {
      repository.findOne.mockResolvedValue(null);
      (argon2.hash as jest.Mock).mockResolvedValue('hashedPassword');
      repository.save.mockRejectedValue({ code: 'ER_DUP_ENTRY' });

      await expect(
        service.create({ email: 'dup@test.com', password: '1234' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw InternalServerErrorException for other DB errors', async () => {
      repository.findOne.mockResolvedValue(null);
      (argon2.hash as jest.Mock).mockResolvedValue('hashedPassword');
      repository.save.mockRejectedValue({ code: 'SOME_OTHER_ERROR' });

      await expect(
        service.create({ email: 'error@test.com', password: '1234' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findByEmail', () => {
    it('should call repository.findOne with email', async () => {
      repository.findOne.mockResolvedValue({ id: 1, email: 'test@test.com' } as User);
      const result = await service.findByEmail('test@test.com');
      expect(repository.findOne).toHaveBeenCalledWith({ where: { email: 'test@test.com' } });
    expect(result).not.toBeNull();
    expect(result?.email).toBe('test@test.com');
    });
  });

    describe('validateUser', () => {
    it('should return user data without password if credentials are correct', async () => {
        const mockUser = { id: 1, email: 'test@test.com', password: 'hashedPassword' } as User;
        repository.findOne.mockResolvedValue(mockUser);
        (argon2.verify as jest.Mock).mockResolvedValue(true);

        const result = await service.validateUser('test@test.com', 'plainPassword');
        expect(result).toEqual({ id: 1, email: 'test@test.com' }); // password removed
    });

    it('should return null if user does not exist', async () => {
        repository.findOne.mockResolvedValue(null);

        const result = await service.validateUser('notfound@test.com', '1234');
        expect(result).toBeNull();
    });

    it('should return null if password is incorrect', async () => {
        const mockUser = { id: 1, email: 'test@test.com', password: 'hashedPassword' } as User;
        repository.findOne.mockResolvedValue(mockUser);
        (argon2.verify as jest.Mock).mockResolvedValue(false);

        const result = await service.validateUser('test@test.com', 'wrongPassword');
        expect(result).toBeNull();
    });
    });

});
