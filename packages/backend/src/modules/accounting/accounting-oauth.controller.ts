import {
  Controller,
  Get,
  HttpCode,
  Query,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AccountingService } from './accounting.service';

/**
 * §5 & §5.2 Public OAuth Callback Controller
 * Provider-agnostic: Resolves tenant strictly from stored nonce state.
 * Never logs raw code, state, or tokens.
 */
@ApiTags('Accounting OAuth')
@Controller('/api/accounting/oauth')
export class AccountingOAuthController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('callback')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Public OAuth2 callback endpoint for accounting providers' })
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    // Nonce is strictly validated and single-use inside handleOAuthCallback
    // Code and state are NEVER logged to console or audit
    const result = await this.accountingService.handleOAuthCallback(code, state);

    // Return HTML popup communicator for seamless UX
    const statusClass = result.success ? 'success' : 'error';
    const message = result.message;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>KroptOS - Muhasebe Yetkilendirme</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
    .card { background: #1e293b; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
    .icon { font-size: 48px; margin-bottom: 1rem; }
    .success { color: #22c55e; }
    .error { color: #ef4444; }
    p { color: #94a3b8; font-size: 14px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon ${statusClass}">${result.success ? '✓' : '✗'}</div>
    <h2>${result.success ? 'Bağlantı Başarılı' : 'Yetkilendirme Başarısız'}</h2>
    <p>${message}</p>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({
        type: 'ACCOUNTING_OAUTH_RESULT',
        success: ${result.success},
        message: ${JSON.stringify(message)},
      }, '*');
      setTimeout(() => window.close(), 2000);
    }
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }
}
