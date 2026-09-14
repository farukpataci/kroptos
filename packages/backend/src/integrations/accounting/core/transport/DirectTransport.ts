import { NotImplementedException } from '@nestjs/common';
import { AccountingTransport, TransportOperation, TransportResult } from './AccountingTransport';

/** Bulut/LAN'a doğrudan HTTP ile giden rota. Sağlayıcı bir executor vermezse iş yapılmaz. */
export type DirectExecutor = <T>(op: TransportOperation) => Promise<T>;

export class DirectTransport implements AccountingTransport {
  readonly kind = 'DIRECT' as const;
  private calls = 0;

  constructor(private readonly executor?: DirectExecutor) {}

  get callCount(): number {
    return this.calls;
  }

  async execute<T = unknown>(op: TransportOperation): Promise<TransportResult<T>> {
    if (!this.executor) {
      throw new NotImplementedException(
        `DirectTransport için '${op.type}' yürütücüsü tanımlı değil — bu sağlayıcı DIRECT rotayı desteklemiyor.`,
      );
    }
    this.calls++;
    const started = Date.now();
    const data = await this.executor<T>(op);
    return { data, fromCache: false, durationMs: Date.now() - started };
  }
}

/** Uygunluk paketi: ağ/iş çağrılarını SAYAR; "ağ isteği yapılmadı" iddiası sayaçla kanıtlanır. */
export class SpyTransport implements AccountingTransport {
  readonly kind = 'AGENT' as const;
  calls = 0;
  readonly operations: TransportOperation[] = [];

  get callCount(): number {
    return this.calls;
  }

  async execute<T = unknown>(op: TransportOperation): Promise<TransportResult<T>> {
    this.calls++;
    this.operations.push(op);
    return { data: undefined as T, fromCache: false, durationMs: 0 };
  }
}
