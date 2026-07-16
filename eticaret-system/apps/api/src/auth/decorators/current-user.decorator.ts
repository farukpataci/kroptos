import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequestUser } from '../types/jwt-payload';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedRequestUser => {
    const request = context.switchToHttp().getRequest<{ user: AuthenticatedRequestUser }>();
    return request.user;
  },
);
