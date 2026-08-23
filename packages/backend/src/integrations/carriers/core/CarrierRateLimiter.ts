import { Injectable } from '@nestjs/common';
import { MarketplaceRateLimiter } from '../../marketplaces/core/MarketplaceRateLimiter';

/**
 * Per-carrier throttling. Same contract as the marketplace limiter — sliding
 * window, one bucket per key — and literally the same implementation, because
 * two copies of a sliding window is two places to fix the next off-by-one.
 *
 * A subclass rather than an alias so the carrier tree keeps its own injection
 * token: carrier buckets must not share state with marketplace buckets, and a
 * shared singleton would let a busy marketplace sync stall a barcode request.
 *
 * ponytail: inherits the limiter's in-process state. Per-pod counters are wrong
 * once the API runs on more than one instance — move to a Redis window when a
 * carrier starts returning 429 under normal load.
 */
@Injectable()
export class CarrierRateLimiter extends MarketplaceRateLimiter {}
