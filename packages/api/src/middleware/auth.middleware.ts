import { FastifyRequest, FastifyReply } from 'fastify';
import { JWTService, TokenPayload } from '../services/jwt.service';
import { AuthenticationError } from '@news-curator/shared';

const jwtService = new JWTService();

declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

export async function authenticateUser(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const payload = jwtService.verifyAccessToken(token);

    request.user = payload;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      reply.status(401).send({
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: error.message,
        },
      });
    } else {
      reply.status(401).send({
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication failed',
        },
      });
    }
  }
}

export function optionalAuth(
  request: FastifyRequest,
  reply: FastifyReply
): void {
  try {
    const authHeader = request.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = jwtService.verifyAccessToken(token);
      request.user = payload;
    }
  } catch {
    // Silently fail for optional auth
  }
}

// Alias for convenience
export const authMiddleware = authenticateUser;
