import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ActionType, DryRunStepResult } from '../automation-types';
import { ActionContext, ActionHandler } from './action-handler.interface';

@Injectable()
export class WebhookHandler implements ActionHandler {
  readonly type: ActionType = 'CALL_WEBHOOK';

  private isPrivateIpOrHost(hostname: string): boolean {
    const host = hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return true;
    }

    // Check private IPv4 ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 169.254.x.x
    const parts = host.split('.').map(Number);
    if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
      if (parts[0] === 10) return true;
      if (parts[0] === 127) return true;
      if (parts[0] === 169 && parts[1] === 254) return true;
      if (parts[0] === 192 && parts[1] === 168) return true;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    }

    return false;
  }

  validateConfig(config: any) {
    if (!config || !config.url) {
      return { isValid: false, error: 'Webhook URL zorunludur.' };
    }
    try {
      const parsed = new URL(config.url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return { isValid: false, error: 'Webhook URL yalnızca HTTP/HTTPS olabilir.' };
      }
      if (this.isPrivateIpOrHost(parsed.hostname)) {
        return { isValid: false, error: 'Özel veya yerel ağ adreslerine webhook çağrısı yapılamaz (SSRF koruması).' };
      }
    } catch {
      return { isValid: false, error: 'Geçersiz webhook URL.' };
    }

    return { isValid: true };
  }

  dryRun(order: any, config: any): DryRunStepResult {
    return {
      actionType: this.type,
      index: 0,
      description: `Webhook çağrısı: ${config.url}`,
      beforeValue: null,
      afterValue: { url: config.url },
    };
  }

  async execute(order: any, config: any, context: ActionContext) {
    const validation = this.validateConfig(config);
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }

    const payload = {
      event: 'order_automation',
      ruleId: context.ruleId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      timestamp: new Date().toISOString(),
    };

    const rawBody = JSON.stringify(payload);
    const secret = config.secret || 'kroptos-webhook-secret';
    const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const res = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kroptos-Signature': signature,
          'X-Kroptos-Store-Id': context.storeId,
        },
        body: rawBody,
        signal: controller.signal,
      });

      const responseText = await res.text();
      return {
        status: res.status,
        ok: res.ok,
        bodySnippet: responseText.slice(0, 300),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
