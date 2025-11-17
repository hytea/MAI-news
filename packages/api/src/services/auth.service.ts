import bcrypt from 'bcrypt';
import {
  User,
  UserProfile,
  UserRegistration,
  UserLogin,
  AuthenticationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@news-curator/shared';
import { query, queryOne } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

const SALT_ROUNDS = 10;

export class AuthService {
  async register(data: UserRegistration): Promise<UserProfile> {
    // Check if user already exists
    const existingUser = await queryOne<User>(
      'SELECT * FROM users WHERE email = $1',
      [data.email.toLowerCase()]
    );

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    // Create user
    const userId = uuidv4();
    const user = await queryOne<User>(
      `INSERT INTO users (id, email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        userId,
        data.email.toLowerCase(),
        passwordHash,
        data.firstName || null,
        data.lastName || null,
      ]
    );

    if (!user) {
      throw new Error('Failed to create user');
    }

    // Create default user preferences
    await query(
      `INSERT INTO user_preferences (user_id)
       VALUES ($1)`,
      [userId]
    );

    // Create default style profile
    await query(
      `INSERT INTO style_profiles (user_id, name, predefined_style, is_default)
       VALUES ($1, $2, $3, $4)`,
      [userId, 'Conversational', 'conversational', true]
    );

    return this.toUserProfile(user);
  }

  async login(data: UserLogin): Promise<User> {
    const user = await queryOne<User>(
      'SELECT * FROM users WHERE email = $1',
      [data.email.toLowerCase()]
    );

    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    const isValidPassword = await bcrypt.compare(
      data.password,
      user.passwordHash
    );

    if (!isValidPassword) {
      throw new AuthenticationError('Invalid email or password');
    }

    return user;
  }

  async getUserById(id: string): Promise<UserProfile> {
    const user = await queryOne<User>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    if (!user) {
      throw new NotFoundError('User');
    }

    return this.toUserProfile(user);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return queryOne<User>(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
  }

  async updateUser(
    id: string,
    data: Partial<Pick<User, 'firstName' | 'lastName'>>
  ): Promise<UserProfile> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.firstName !== undefined) {
      updates.push(`first_name = $${paramIndex++}`);
      values.push(data.firstName);
    }

    if (data.lastName !== undefined) {
      updates.push(`last_name = $${paramIndex++}`);
      values.push(data.lastName);
    }

    if (updates.length === 0) {
      return this.getUserById(id);
    }

    values.push(id);
    const user = await queryOne<User>(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (!user) {
      throw new NotFoundError('User');
    }

    return this.toUserProfile(user);
  }

  async verifyEmail(userId: string): Promise<void> {
    await query(
      'UPDATE users SET is_email_verified = TRUE WHERE id = $1',
      [userId]
    );
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await queryOne<User>(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (!user) {
      throw new NotFoundError('User');
    }

    const isValidPassword = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

    if (!isValidPassword) {
      throw new AuthenticationError('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, userId]
    );
  }

  private toUserProfile(user: User): UserProfile {
    const { passwordHash, ...profile } = user;
    return profile;
  }
}
