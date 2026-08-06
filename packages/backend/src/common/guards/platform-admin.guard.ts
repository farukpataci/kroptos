import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { isPlatformAdmin } from '../constants/platform-admin';

/**
 * Gate for actions on distributor firms themselves. The UI hides these actions,
 * but the UI is not the boundary — anything that can create or delete an
 * Agency has to be checked here as well.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;

    if (!isPlatformAdmin(user)) {
      throw new ForbiddenException(
        'Access denied. Distributor firms can only be managed by the platform administrator.',
      );
    }

    return true;
  }
}
