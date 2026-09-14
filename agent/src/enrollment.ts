import { Vault } from './vault';
import { generateAgentKeyPair } from './credential-envelope';
import { PROTOCOL_VERSION } from './protocol';

/**
 * §9.3 — kayıt: tek kullanımlık kod (TTL 15 dk) + makinede üretilen anahtar çifti.
 * Sunucu kodu doğrular, agentId + tünel sırrı (agentSecret) verir, kodu YAKAR.
 * Özel anahtar makineden çıkmaz (kasada, DPAPI ile). Yedekten dönen sunucu yeniden kayıt olur.
 */
export interface EnrollResponse {
  agentId: string;
  agentSecret: string;
  serverUrl?: string;
}

export async function enroll(
  vault: Vault,
  opts: { enrollUrl: string; code: string; name: string; agentVersion: string; osVersion: string },
  fetchFn: (url: string, init: any) => Promise<{ status: number; text(): Promise<string> }> = (u, i) => fetch(u, i) as any,
): Promise<EnrollResponse> {
  const existing = vault.identity;
  const keys = existing.privateKeyPem && existing.publicKeyPem
    ? { privateKeyPem: existing.privateKeyPem, publicKeyPem: existing.publicKeyPem }
    : generateAgentKeyPair();

  const res = await fetchFn(opts.enrollUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: opts.code,
      name: opts.name,
      publicKey: keys.publicKeyPem,
      agentVersion: opts.agentVersion,
      osVersion: opts.osVersion,
      protocolVersion: PROTOCOL_VERSION,
    }),
  });
  const text = await res.text();
  if (res.status !== 201 && res.status !== 200) throw new Error(`kayıt reddedildi (HTTP ${res.status}): ${text.slice(0, 200)}`);
  const body = JSON.parse(text) as EnrollResponse;
  if (!body.agentId || !body.agentSecret) throw new Error('kayıt cevabı eksik');
  vault.setIdentity({ agentId: body.agentId, agentSecret: body.agentSecret, ...keys });
  return body;
}
