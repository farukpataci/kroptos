import { BadRequestException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request & { requestedTenantId?: string }, _res: Response, next: NextFunction) {
    const tenantId = req.header('x-tenant-id');

    if (tenantId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new BadRequestException('Invalid x-tenant-id header');
    }

    req.requestedTenantId = tenantId;
    next();
  }
}
