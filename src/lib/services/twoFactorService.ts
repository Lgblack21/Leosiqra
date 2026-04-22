import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';

/**
 * Service for handling Two-Factor Authentication (TOTP)
 */
export const twoFactorService = {
  /**
   * Generates a new TOTP secret
   */
  generateSecret: () => {
    return generateSecret();
  },

  /**
   * Generates an otpauth URI for the authenticator app
   * @param userEmail User's email
   * @param secret TOTP Secret
   * @param issuer App name (default: Leosiqra)
   */
  generateURI: (userEmail: string, secret: string, issuer: string = 'Leosiqra') => {
    return generateURI({
      label: userEmail,
      secret,
      issuer
    });
  },

  /**
   * Generates a QR Code Data URL from an otpauth URI
   */
  generateQRCode: async (uri: string) => {
    try {
      return await QRCode.toDataURL(uri);
    } catch (err) {
      console.error('Failed to generate QR Code:', err);
      throw err;
    }
  },

  /**
   * Verifies a 6-digit TOTP token against a secret
   */
  verifyToken: (token: string, secret: string) => {
    try {
      const result = verifySync({
        token,
        secret
      });
      return result.valid;
    } catch (err) {
      console.error('TOTP verification error:', err);
      return false;
    }
  }
};
