import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const rawKey = process.env.ENCRYPTION_KEY || 'kroptos-dev-secret-encryption-key-32';
  // Pad or slice rawKey to exactly 32 bytes
  const buffer = Buffer.alloc(32);
  buffer.write(rawKey, 'utf-8');
  return buffer;
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted text format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const key = getEncryptionKey();
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString('utf8');
}
