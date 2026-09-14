import { createDecipheriv, createHash, createPublicKey, generateKeyPairSync, privateDecrypt, constants, publicEncrypt, randomBytes, createCipheriv } from 'crypto';

/**
 * K2 / §9.4 — kimlik girişi sunucu görmeden:
 *   1. Panel Agent'ın AÇIK anahtarını çeker
 *   2. Tarayıcıda credential hibrit şifrelenir (rastgele AES-256-GCM anahtarı + RSA-OAEP ile sarmalama)
 *   3. Sunucuya YALNIZCA blob gider — sunucunun özel anahtarı YOK
 *   4. Agent çözer, yerel kasasına yazar; teslim onayında sunucudaki blob SİLİNİR
 *
 * Blob biçimi (base64 JSON): { v:1, alg:'RSA-OAEP-256+A256GCM', ek, iv, ct, tag }
 * Aynı `seal` fonksiyonu tarayıcıda WebCrypto ile birebir üretilir; burada test ve panel için referans.
 */
export interface SealedEnvelope {
  v: 1;
  alg: 'RSA-OAEP-256+A256GCM';
  ek: string; // RSA-OAEP ile sarılmış AES anahtarı (base64)
  iv: string;
  ct: string;
  tag: string;
}

export function generateAgentKeyPair(): { publicKeyPem: string; privateKeyPem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 3072 });
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
}

export function fingerprintOf(blob: string): string {
  return createHash('sha256').update(blob, 'utf8').digest('hex');
}

/** Tarayıcı tarafının referans uygulaması — sunucu bunu ÇAĞIRMAZ (sunucu düz metni görmez). */
export function seal(publicKeyPem: string, fields: Record<string, string>): string {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(fields), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ek = publicEncrypt(
    { key: createPublicKey(publicKeyPem), padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    key,
  );
  const env: SealedEnvelope = {
    v: 1,
    alg: 'RSA-OAEP-256+A256GCM',
    ek: ek.toString('base64'),
    iv: iv.toString('base64'),
    ct: ct.toString('base64'),
    tag: tag.toString('base64'),
  };
  return Buffer.from(JSON.stringify(env), 'utf8').toString('base64');
}

export function open(privateKeyPem: string, blob: string): Record<string, string> {
  const env = JSON.parse(Buffer.from(blob, 'base64').toString('utf8')) as SealedEnvelope;
  if (env.v !== 1 || env.alg !== 'RSA-OAEP-256+A256GCM') throw new Error('desteklenmeyen zarf biçimi');
  const key = privateDecrypt(
    { key: privateKeyPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(env.ek, 'base64'),
  );
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(env.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(env.tag, 'base64'));
  const plain = Buffer.concat([decipher.update(Buffer.from(env.ct, 'base64')), decipher.final()]);
  const fields = JSON.parse(plain.toString('utf8'));
  plain.fill(0);
  key.fill(0);
  return fields;
}
