import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  passwordHash: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  isEmailVerified: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

export const UserRegistrationSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export type UserRegistration = z.infer<typeof UserRegistrationSchema>;

export const UserLoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type UserLogin = z.infer<typeof UserLoginSchema>;

export const UserProfileSchema = UserSchema.omit({ passwordHash: true });

export type UserProfile = z.infer<typeof UserProfileSchema>;
