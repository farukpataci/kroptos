import { Injectable } from '@nestjs/common';
import { MarketplaceRateLimiter } from '../../marketplaces/core/MarketplaceRateLimiter';

/**
 * Dedicated rate limiter for E-Commerce platform API requests.
 * Uses an in-memory sliding window bucket per store/credential set.
 */
@Injectable()
export class EcommerceRateLimiter extends MarketplaceRateLimiter {}
