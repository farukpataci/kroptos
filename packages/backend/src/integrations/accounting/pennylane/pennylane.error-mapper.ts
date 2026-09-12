/**
 * Pennylane Hata Eşleyicisi ve Hassas Veri Maskeleme (§4, §9.15)
 */
export class PennylaneErrorMapper {
  /**
   * Sırları, API token'larını ve kimlik bilgilerini hata mesajlarından ve loglardan temizler (§9.15).
   */
  static maskSensitive(input: string | any): string {
    if (!input) return '';
    let str = typeof input === 'string' ? input : JSON.stringify(input);

    // Bearer token maskeleme
    str = str.replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, 'Bearer [REDACTED]');

    // apiToken / token alanları maskeleme
    str = str.replace(
      /"(?:apiToken|token|apiKey|secret)"\s*:\s*"[^"]+"/gi,
      '"apiToken":"[REDACTED]"',
    );

    return str;
  }

  static toReadableMessage(err: any): string {
    if (!err) return 'Bilinmeyen Pennylane API hatası';
    const raw = err.message || String(err);
    return this.maskSensitive(raw);
  }
}
