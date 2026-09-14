import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

/**
 * Yerel kimlik kasası (K2). Sunucuda ERP kimliği YOKTUR; burada da yalnızca korunmuş (DPAPI,
 * makine kapsamı) biçimde durur. Kasa içeriği hiçbir log satırına yazılmaz (§9.7 son madde).
 */
export interface Protector {
  protect(plain: Buffer): Buffer;
  unprotect(cipher: Buffer): Buffer;
}

/** Windows DPAPI (LocalMachine) — .NET ProtectedData üzerinden; ek bağımlılık yok. */
export class DpapiProtector implements Protector {
  private run(method: 'Protect' | 'Unprotect', data: Buffer): Buffer {
    const script =
      `Add-Type -AssemblyName System.Security; ` +
      `$in=[Convert]::FromBase64String([Console]::In.ReadToEnd()); ` +
      `$out=[System.Security.Cryptography.ProtectedData]::${method}($in,$null,[System.Security.Cryptography.DataProtectionScope]::LocalMachine); ` +
      `[Console]::Out.Write([Convert]::ToBase64String($out))`;
    const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      input: data.toString('base64'),
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    });
    return Buffer.from(out.toString('utf8').trim(), 'base64');
  }
  protect(plain: Buffer): Buffer {
    return this.run('Protect', plain);
  }
  unprotect(cipher: Buffer): Buffer {
    return this.run('Unprotect', cipher);
  }
}

/** Testler için — koruma yok, bellek içi. */
export class MemoryProtector implements Protector {
  protect(plain: Buffer): Buffer {
    return Buffer.from(plain);
  }
  unprotect(cipher: Buffer): Buffer {
    return Buffer.from(cipher);
  }
}

export interface VaultData {
  agentId?: string;
  /** Tünel kimliği — kayıt anında sunucu verir, HMAC ile hello imzalanır */
  agentSecret?: string;
  /** K2: credential zarfı bu anahtarla çözülür; özel anahtar makineden çıkmaz */
  privateKeyPem?: string;
  publicKeyPem?: string;
  /** integrationId → ERP credential alanları (AGENT_LOCAL) */
  credentials: Record<string, Record<string, string>>;
}

export class Vault {
  private data: VaultData = { credentials: {} };

  constructor(
    private readonly file: string,
    private readonly protector: Protector,
  ) {}

  load(): void {
    if (!fs.existsSync(this.file)) return;
    const cipher = fs.readFileSync(this.file);
    this.data = JSON.parse(this.protector.unprotect(cipher).toString('utf8'));
    this.data.credentials ??= {};
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, this.protector.protect(Buffer.from(JSON.stringify(this.data), 'utf8')));
  }

  get identity(): Pick<VaultData, 'agentId' | 'agentSecret' | 'privateKeyPem' | 'publicKeyPem'> {
    const { agentId, agentSecret, privateKeyPem, publicKeyPem } = this.data;
    return { agentId, agentSecret, privateKeyPem, publicKeyPem };
  }

  setIdentity(id: Pick<VaultData, 'agentId' | 'agentSecret' | 'privateKeyPem' | 'publicKeyPem'>): void {
    Object.assign(this.data, id);
    this.persist();
  }

  getCredentials(integrationId: string): Record<string, string> | undefined {
    return this.data.credentials[integrationId];
  }

  setCredentials(integrationId: string, fields: Record<string, string>): void {
    this.data.credentials[integrationId] = { ...fields };
    this.persist();
  }

  /** §9.3: REVOKED → kasa silinir. Bellekteki kopya da sıfırlanır. */
  wipe(): void {
    this.data = { credentials: {} };
    if (fs.existsSync(this.file)) fs.rmSync(this.file, { force: true });
  }

  get isEmpty(): boolean {
    return !this.data.agentId && Object.keys(this.data.credentials).length === 0;
  }
}
