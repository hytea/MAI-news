import { JWTService, TokenPayload } from '../jwt.service';
import { AuthenticationError } from '@news-curator/shared';
import jwt from 'jsonwebtoken';

describe('JWTService', () => {
  let jwtService: JWTService;
  const mockPayload: TokenPayload = {
    userId: 'user-123',
    email: 'test@example.com',
  };

  beforeEach(() => {
    jwtService = new JWTService();
  });

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = jwtService.generateAccessToken(mockPayload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token structure
      const decoded = jwt.decode(token) as TokenPayload;
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.email).toBe(mockPayload.email);
    });

    it('should generate different tokens for the same payload (due to timestamp)', async () => {
      const token1 = jwtService.generateAccessToken(mockPayload);
      await new Promise(resolve => setTimeout(resolve, 1100)); // Wait at least 1 second for different iat
      const token2 = jwtService.generateAccessToken(mockPayload);

      expect(token1).not.toBe(token2);
    });

    it('should include expiration in the token', () => {
      const token = jwtService.generateAccessToken(mockPayload);
      const decoded = jwt.decode(token, { complete: true }) as any;

      expect(decoded.payload.exp).toBeDefined();
      expect(decoded.payload.iat).toBeDefined();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = jwtService.generateRefreshToken(mockPayload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.decode(token) as TokenPayload;
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.email).toBe(mockPayload.email);
    });

    it('should generate different tokens from access tokens', () => {
      const accessToken = jwtService.generateAccessToken(mockPayload);
      const refreshToken = jwtService.generateRefreshToken(mockPayload);

      expect(accessToken).not.toBe(refreshToken);
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', () => {
      const tokenPair = jwtService.generateTokenPair(mockPayload);

      expect(tokenPair).toBeDefined();
      expect(tokenPair.accessToken).toBeDefined();
      expect(tokenPair.refreshToken).toBeDefined();
      expect(tokenPair.accessToken).not.toBe(tokenPair.refreshToken);
    });

    it('should generate tokens with correct payload', () => {
      const tokenPair = jwtService.generateTokenPair(mockPayload);

      const accessDecoded = jwt.decode(tokenPair.accessToken) as TokenPayload;
      const refreshDecoded = jwt.decode(tokenPair.refreshToken) as TokenPayload;

      expect(accessDecoded.userId).toBe(mockPayload.userId);
      expect(refreshDecoded.userId).toBe(mockPayload.userId);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const token = jwtService.generateAccessToken(mockPayload);
      const verified = jwtService.verifyAccessToken(token);

      expect(verified).toBeDefined();
      expect(verified.userId).toBe(mockPayload.userId);
      expect(verified.email).toBe(mockPayload.email);
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => {
        jwtService.verifyAccessToken(invalidToken);
      }).toThrow(AuthenticationError);
    });

    it('should throw error for expired token', () => {
      // Generate token with very short expiration
      const shortLivedToken = jwt.sign(
        mockPayload,
        process.env.JWT_SECRET!,
        { expiresIn: '0s' }
      );

      expect(() => {
        jwtService.verifyAccessToken(shortLivedToken);
      }).toThrow(AuthenticationError);
    });

    it('should throw error for token signed with wrong secret', () => {
      const wrongToken = jwt.sign(mockPayload, 'wrong-secret');

      expect(() => {
        jwtService.verifyAccessToken(wrongToken);
      }).toThrow(AuthenticationError);
    });

    it('should not verify refresh token as access token', () => {
      const refreshToken = jwtService.generateRefreshToken(mockPayload);

      expect(() => {
        jwtService.verifyAccessToken(refreshToken);
      }).toThrow(AuthenticationError);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const token = jwtService.generateRefreshToken(mockPayload);
      const verified = jwtService.verifyRefreshToken(token);

      expect(verified).toBeDefined();
      expect(verified.userId).toBe(mockPayload.userId);
      expect(verified.email).toBe(mockPayload.email);
    });

    it('should throw error for invalid refresh token', () => {
      const invalidToken = 'invalid.refresh.token';

      expect(() => {
        jwtService.verifyRefreshToken(invalidToken);
      }).toThrow(AuthenticationError);
    });

    it('should not verify access token as refresh token', () => {
      const accessToken = jwtService.generateAccessToken(mockPayload);

      expect(() => {
        jwtService.verifyRefreshToken(accessToken);
      }).toThrow(AuthenticationError);
    });
  });

  describe('decodeToken', () => {
    it('should decode a valid token without verification', () => {
      const token = jwtService.generateAccessToken(mockPayload);
      const decoded = jwtService.decodeToken(token);

      expect(decoded).toBeDefined();
      expect(decoded?.userId).toBe(mockPayload.userId);
      expect(decoded?.email).toBe(mockPayload.email);
    });

    it('should decode expired token without error', () => {
      const expiredToken = jwt.sign(
        mockPayload,
        process.env.JWT_SECRET!,
        { expiresIn: '0s' }
      );

      const decoded = jwtService.decodeToken(expiredToken);
      expect(decoded).toBeDefined();
      expect(decoded?.userId).toBe(mockPayload.userId);
    });

    it('should return null for invalid token', () => {
      const decoded = jwtService.decodeToken('not.a.token');
      expect(decoded).toBeNull();
    });

    it('should decode token signed with different secret', () => {
      const token = jwt.sign(mockPayload, 'different-secret');
      const decoded = jwtService.decodeToken(token);

      // Should decode without verification
      expect(decoded).toBeDefined();
      expect(decoded?.userId).toBe(mockPayload.userId);
    });
  });
});
