import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

export interface IdeasoftOauthState {
  userId: string;
  agencyId: string;
  integrationId: string;
  expiresAt: number;
}

const TTL_MS = 10 * 60 * 1000;

/**
 * OAuth `state` deposu (P14-1, CSRF kilidi). Başlangıçta üretilir; kullanıcı + ajans +
 * entegrasyon + süreye bağlıdır; callback'te doğrulanır ve TÜKETİLİR (tek kullanım).
 * ponytail: süreç içi Map — tek API düğümü varsayımı; çok düğüm olursa Redis'e taşı
 * (PermissionCacheService'in istemcisi), arayüz aynı kalır.
 */
@Injectable()
export class IdeasoftOauthStateService {
  private readonly states = new Map<string, IdeasoftOauthState>();

  issue(input: Omit<IdeasoftOauthState, 'expiresAt'>): string {
    this.sweep();
    const state = randomBytes(32).toString('hex');
    this.states.set(state, { ...input, expiresAt: Date.now() + TTL_MS });
    return state;
  }

  /** Eşleşen ve süresi dolmamış state'i döner ve siler; aksi halde null (tekrar kullanım da null). */
  consume(state: string | undefined): IdeasoftOauthState | null {
    if (!state || typeof state !== 'string' || state.length !== 64) return null;
    const row = this.states.get(state);
    this.states.delete(state);
    if (!row || row.expiresAt < Date.now()) return null;
    return row;
  }

  private sweep() {
    const now = Date.now();
    for (const [k, v] of this.states) if (v.expiresAt < now) this.states.delete(k);
  }
}
