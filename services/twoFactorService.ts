import * as OTPAuth from 'otpauth';

// Generate a random base32 secret
export const generateSecret = (): string => {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
};

// Generate the otpauth URL for QR Code
export const generateOtpAuthUrl = (username: string, secret: string): string => {
  const totp = new OTPAuth.TOTP({
    issuer: 'TronShastaWallet',
    label: username,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.toString();
};

// Validate a token against a secret
export const verifyToken = (token: string, secret: string): boolean => {
  if (!token || !secret) return false;
  
  const totp = new OTPAuth.TOTP({
    issuer: 'TronShastaWallet',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  // Returns the delta of the window if valid, or null if invalid
  // We allow a window of 1 (30 seconds before/after) to account for slight clock drift
  const delta = totp.validate({ token, window: 1 });
  
  return delta !== null;
};