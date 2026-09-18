import { z } from 'zod';

export const signInSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your email address or username.').max(160),
  password: z.string().min(1, 'Enter your password.').max(72),
  next: z.string().optional(),
});

export const requestResetSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter the email address on your account.').max(160),
});

const passwordPair = {
  new_password: z.string().min(8, 'Use at least 8 characters.').max(72),
  confirm_password: z.string().min(1, 'Repeat the new password.'),
};

const matchingPasswords = (value: { new_password: string; confirm_password: string }) =>
  value.new_password === value.confirm_password;

export const setNewPasswordSchema = z
  .object(passwordPair)
  .refine(matchingPasswords, { message: 'The two passwords do not match.', path: ['confirm_password'] });

export const changePasswordSchema = z
  .object({ current_password: z.string().min(1, 'Enter your current password.'), ...passwordPair })
  .refine(matchingPasswords, { message: 'The two passwords do not match.', path: ['confirm_password'] });
