import { AuthService } from '../auth.service';
import {
  UserRegistration,
  UserLogin,
  AuthenticationError,
  ConflictError,
  NotFoundError,
} from '@news-curator/shared';
import * as database from '../../config/database';
import bcrypt from 'bcrypt';

// Mock database functions
jest.mock('../../config/database');

const mockQuery = database.query as jest.MockedFunction<typeof database.query>;
const mockQueryOne = database.queryOne as jest.MockedFunction<typeof database.queryOne>;

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registrationData: UserRegistration = {
      email: 'test@example.com',
      password: 'SecurePassword123!',
      firstName: 'Test',
      lastName: 'User',
    };

    it('should successfully register a new user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('SecurePassword123!', 10),
        firstName: 'Test',
        lastName: 'User',
        isEmailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock: no existing user
      mockQueryOne.mockResolvedValueOnce(null);
      // Mock: user creation
      mockQueryOne.mockResolvedValueOnce(mockUser);
      // Mock: preferences creation
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
      // Mock: style profile creation
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      const result = await authService.register(registrationData);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe('test@example.com');
      expect(result.firstName).toBe('Test');
      expect(result.lastName).toBe('User');
      expect((result as any).passwordHash).toBeUndefined(); // Should not expose password hash

      // Verify database calls
      expect(mockQueryOne).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1',
        ['test@example.com']
      );
      expect(mockQuery).toHaveBeenCalledTimes(2); // preferences + style profile
    });

    it('should convert email to lowercase', async () => {
      mockQueryOne.mockResolvedValueOnce(null);
      mockQueryOne.mockResolvedValueOnce({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hash',
        firstName: 'Test',
        lastName: 'User',
        isEmailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await authService.register({
        ...registrationData,
        email: 'TEST@EXAMPLE.COM',
      });

      expect(mockQueryOne).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1',
        ['test@example.com']
      );
    });

    it('should hash the password', async () => {
      mockQueryOne.mockResolvedValueOnce(null);
      mockQueryOne.mockResolvedValueOnce({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        firstName: 'Test',
        lastName: 'User',
        isEmailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await authService.register(registrationData);

      // Check that password was hashed (second call, fourth parameter)
      const insertCall = mockQueryOne.mock.calls[1];
      const passwordHash = insertCall?.[1]?.[2]; // Third parameter in VALUES

      expect(passwordHash).not.toBe(registrationData.password);
      expect(typeof passwordHash).toBe('string');
      expect(passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt hash format
    });

    it('should throw ConflictError if user already exists', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'existing-user',
        email: 'test@example.com',
      });

      await expect(authService.register(registrationData)).rejects.toThrow(
        ConflictError
      );
      await expect(authService.register(registrationData)).rejects.toThrow(
        'User with this email already exists'
      );
    });

    it('should create default user preferences', async () => {
      mockQueryOne.mockResolvedValueOnce(null);
      mockQueryOne.mockResolvedValueOnce({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hash',
        firstName: 'Test',
        lastName: 'User',
        isEmailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await authService.register(registrationData);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_preferences'),
        expect.any(Array)
      );
    });

    it('should create default style profile', async () => {
      mockQueryOne.mockResolvedValueOnce(null);
      mockQueryOne.mockResolvedValueOnce({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hash',
        firstName: 'Test',
        lastName: 'User',
        isEmailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await authService.register(registrationData);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO style_profiles'),
        expect.arrayContaining(['user-123', 'Conversational', 'conversational', true])
      );
    });
  });

  describe('login', () => {
    const loginData: UserLogin = {
      email: 'test@example.com',
      password: 'SecurePassword123!',
    };

    it('should successfully login with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('SecurePassword123!', 10);
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        isEmailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockQueryOne.mockResolvedValueOnce(mockUser);

      const result = await authService.login(loginData);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
    });

    it('should convert email to lowercase during login', async () => {
      const hashedPassword = await bcrypt.hash('SecurePassword123!', 10);
      mockQueryOne.mockResolvedValueOnce({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        isEmailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await authService.login({
        email: 'TEST@EXAMPLE.COM',
        password: 'SecurePassword123!',
      });

      expect(mockQueryOne).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1',
        ['test@example.com']
      );
    });

    it('should throw AuthenticationError if user not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(authService.login(loginData)).rejects.toThrow(
        AuthenticationError
      );
      await expect(authService.login(loginData)).rejects.toThrow(
        'Invalid email or password'
      );
    });

    it('should throw AuthenticationError if password is incorrect', async () => {
      const hashedPassword = await bcrypt.hash('DifferentPassword', 10);
      mockQueryOne.mockResolvedValueOnce({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        isEmailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(authService.login(loginData)).rejects.toThrow(
        AuthenticationError
      );
    });
  });

  describe('getUserById', () => {
    it('should return user profile by id', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hash',
        firstName: 'Test',
        lastName: 'User',
        isEmailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockQueryOne.mockResolvedValueOnce(mockUser);

      const result = await authService.getUserById('user-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('user-123');
      expect((result as any).passwordHash).toBeUndefined();
    });

    it('should throw NotFoundError if user does not exist', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(authService.getUserById('nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by email', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hash',
        firstName: 'Test',
        lastName: 'User',
        isEmailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockQueryOne.mockResolvedValueOnce(mockUser);

      const result = await authService.getUserByEmail('test@example.com');

      expect(result).toBeDefined();
      expect(result?.id).toBe('user-123');
    });

    it('should return null if user not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await authService.getUserByEmail('notfound@example.com');

      expect(result).toBeNull();
    });
  });

  describe('changePassword', () => {
    it('should successfully change password', async () => {
      const currentPasswordHash = await bcrypt.hash('OldPassword123!', 10);
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: currentPasswordHash,
        firstName: 'Test',
        lastName: 'User',
        isEmailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockQueryOne.mockResolvedValueOnce(mockUser);
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      await authService.changePassword(
        'user-123',
        'OldPassword123!',
        'NewPassword456!'
      );

      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        expect.any(Array)
      );
    });

    it('should throw NotFoundError if user does not exist', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(
        authService.changePassword('nonexistent', 'old', 'new')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthenticationError if current password is wrong', async () => {
      const currentPasswordHash = await bcrypt.hash('OldPassword123!', 10);
      mockQueryOne.mockResolvedValueOnce({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: currentPasswordHash,
        firstName: 'Test',
        lastName: 'User',
        isEmailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        authService.changePassword('user-123', 'WrongPassword', 'NewPassword456!')
      ).rejects.toThrow(AuthenticationError);
      await expect(
        authService.changePassword('user-123', 'WrongPassword', 'NewPassword456!')
      ).rejects.toThrow('Current password is incorrect');
    });
  });

  describe('verifyEmail', () => {
    it('should mark email as verified', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      await authService.verifyEmail('user-123');

      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE users SET is_email_verified = TRUE WHERE id = $1',
        ['user-123']
      );
    });
  });

  describe('updateUser', () => {
    it('should update user firstName and lastName', async () => {
      const updatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hash',
        firstName: 'Updated',
        lastName: 'Name',
        isEmailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockQueryOne.mockResolvedValueOnce(updatedUser);

      const result = await authService.updateUser('user-123', {
        firstName: 'Updated',
        lastName: 'Name',
      });

      expect(result.firstName).toBe('Updated');
      expect(result.lastName).toBe('Name');
    });

    it('should return current user if no updates provided', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hash',
        firstName: 'Test',
        lastName: 'User',
        isEmailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockQueryOne.mockResolvedValueOnce(mockUser);

      const result = await authService.updateUser('user-123', {});

      expect(mockQueryOne).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        ['user-123']
      );
    });

    it('should throw NotFoundError if user does not exist', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(
        authService.updateUser('nonexistent', { firstName: 'Test' })
      ).rejects.toThrow(NotFoundError);
    });
  });
});
