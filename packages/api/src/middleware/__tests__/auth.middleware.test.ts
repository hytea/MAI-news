import { FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser, optionalAuth } from '../auth.middleware';
import { JWTService } from '../../services/jwt.service';
import { AuthenticationError } from '@news-curator/shared';

// Mock JWTService
jest.mock('../../services/jwt.service', () => {
  return {
    JWTService: jest.fn().mockImplementation(() => ({
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      generateTokenPair: jest.fn(),
      decodeToken: jest.fn(),
    })),
  };
});

describe('Auth Middleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockJWTService: jest.Mocked<JWTService>;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      user: undefined,
    };

    mockReply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    mockJWTService = new JWTService() as jest.Mocked<JWTService>;
    jest.clearAllMocks();
  });

  describe('authenticateUser', () => {
    it('should authenticate valid token', async () => {
      const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      mockJWTService.verifyAccessToken = jest.fn().mockReturnValue(mockPayload);

      await authenticateUser(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockRequest.user).toEqual(mockPayload);
      expect(mockReply.status).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should reject request without authorization header', async () => {
      mockRequest.headers = {};

      await authenticateUser(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Missing or invalid authorization header',
        },
      });
    });

    it('should reject request with malformed authorization header', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token',
      };

      await authenticateUser(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Missing or invalid authorization header',
        },
      });
    });

    it('should reject request with empty Bearer token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer ',
      };

      await authenticateUser(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(401);
    });

    it('should extract token correctly from Bearer header', async () => {
      const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      mockRequest.headers = {
        authorization: 'Bearer my.jwt.token',
      };

      mockJWTService.verifyAccessToken = jest.fn().mockReturnValue(mockPayload);

      await authenticateUser(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockRequest.user).toEqual(mockPayload);
    });

    it('should handle invalid token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      const AuthenticationError = require('@news-curator/shared').AuthenticationError;
      mockJWTService.verifyAccessToken = jest.fn().mockImplementation(() => {
        throw new AuthenticationError('Invalid token');
      });

      await authenticateUser(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Invalid token',
        },
      });
    });

    it('should handle expired token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer expired-token',
      };

      const AuthenticationError = require('@news-curator/shared').AuthenticationError;
      mockJWTService.verifyAccessToken = jest.fn().mockImplementation(() => {
        throw new AuthenticationError('Invalid or expired access token');
      });

      await authenticateUser(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Invalid or expired access token',
        },
      });
    });

    it('should handle unexpected errors', async () => {
      mockRequest.headers = {
        authorization: 'Bearer some-token',
      };

      mockJWTService.verifyAccessToken = jest.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await authenticateUser(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication failed',
        },
      });
    });
  });

  describe('optionalAuth', () => {
    it('should set user if valid token provided', () => {
      const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      mockJWTService.verifyAccessToken = jest.fn().mockReturnValue(mockPayload);

      optionalAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockRequest.user).toEqual(mockPayload);
      expect(mockReply.status).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should not set user if no authorization header', () => {
      mockRequest.headers = {};

      optionalAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockReply.status).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should not set user if invalid token', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      const AuthenticationError = require('@news-curator/shared').AuthenticationError;
      mockJWTService.verifyAccessToken = jest.fn().mockImplementation(() => {
        throw new AuthenticationError('Invalid token');
      });

      optionalAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockReply.status).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should not set user if malformed header', () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token',
      };

      optionalAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('should silently fail on any error', () => {
      mockRequest.headers = {
        authorization: 'Bearer some-token',
      };

      mockJWTService.verifyAccessToken = jest.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      optionalAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockReply.status).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });
  });
});
