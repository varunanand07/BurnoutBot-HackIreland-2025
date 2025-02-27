import crypto from 'crypto';

// Default encryption key for development (in production, use environment variables)
const DEFAULT_ENCRYPTION_KEY = 'burnoutbot-default-encryption-key-32b';

// Get encryption key from environment or use default for development
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || DEFAULT_ENCRYPTION_KEY;

// Validate key length (must be 32 bytes for AES-256)
if (Buffer.from(ENCRYPTION_KEY).length !== 32) {
  console.warn('Warning: Using default encryption key. This is not secure for production.');
  // Don't throw error in development to allow the app to start
}

// Initialization vector length
const IV_LENGTH = 16;

/**
 * Encrypt data using AES-256-CBC
 * @param {string} text - Text to encrypt
 * @returns {string} - Encrypted data as hex string
 */
export const encryptData = (text) => {
  try {
    // Create initialization vector
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(
      'aes-256-cbc', 
      Buffer.from(ENCRYPTION_KEY), 
      iv
    );
    
    // Encrypt data
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV + encrypted data
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    return text; // Return original text in case of error (for development only)
  }
};

/**
 * Decrypt data using AES-256-CBC
 * @param {string} encryptedData - Encrypted data (IV:encryptedText)
 * @returns {string} - Decrypted text
 */
export const decryptData = (encryptedData) => {
  try {
    // Split IV and encrypted data
    const parts = encryptedData.split(':');
    
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    // Create decipher
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc', 
      Buffer.from(ENCRYPTION_KEY), 
      iv
    );
    
    // Decrypt data
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedData; // Return original data in case of error (for development only)
  }
}; 