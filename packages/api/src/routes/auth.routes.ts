import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../services/auth.service';
import { JWTService } from '../services/jwt.service';
import { UserRegistration, UserLogin, ValidationError } from '@news-curator/shared';
import { authenticateUser } from '../middleware/auth.middleware';

const authService = new AuthService();
const jwtService = new JWTService();

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Register
  app.post('/register', async (
    request: FastifyRequest<{ Body: UserRegistration }>,
    reply: FastifyReply
  ) => {
    const { email, password, firstName, lastName } = request.body;

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const user = await authService.register({
      email,
      password,
      firstName,
      lastName,
    });

    const tokens = jwtService.generateTokenPair({
      userId: user.id,
      email: user.email,
    });

    reply.status(201).send({
      user,
      ...tokens,
    });
  });

  // Login
  app.post('/login', async (
    request: FastifyRequest<{ Body: UserLogin }>,
    reply: FastifyReply
  ) => {
    const { email, password } = request.body;

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const user = await authService.login({ email, password });

    const tokens = jwtService.generateTokenPair({
      userId: user.id,
      email: user.email,
    });

    const { passwordHash, ...userProfile } = user;

    reply.send({
      user: userProfile,
      ...tokens,
    });
  });

  // Refresh token
  app.post('/refresh', async (
    request: FastifyRequest<{ Body: { refreshToken: string } }>,
    reply: FastifyReply
  ) => {
    const { refreshToken } = request.body;

    if (!refreshToken) {
      throw new ValidationError('Refresh token is required');
    }

    const payload = jwtService.verifyRefreshToken(refreshToken);
    const tokens = jwtService.generateTokenPair(payload);

    reply.send(tokens);
  });

  // Get current user
  app.get('/me', {
    preHandler: authenticateUser,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw new Error('User not authenticated');
    }

    const user = await authService.getUserById(request.user.userId);

    reply.send({ user });
  });

  // Change password
  app.post<{
    Body: { currentPassword: string; newPassword: string };
  }>('/change-password', {
    preHandler: authenticateUser,
  }, async (request, reply) => {
    if (!request.user) {
      throw new Error('User not authenticated');
    }

    const { currentPassword, newPassword } = request.body;

    if (!currentPassword || !newPassword) {
      throw new ValidationError('Current and new passwords are required');
    }

    if (newPassword.length < 8) {
      throw new ValidationError('New password must be at least 8 characters');
    }

    await authService.changePassword(
      request.user.userId,
      currentPassword,
      newPassword
    );

    reply.send({ message: 'Password changed successfully' });
  });
}
