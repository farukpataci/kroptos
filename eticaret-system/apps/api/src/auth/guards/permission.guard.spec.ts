import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';

describe('PermissionGuard', () => {
  it('can be instantiated', () => {
    const guard = new PermissionGuard(new Reflector());
    expect(guard).toBeInstanceOf(PermissionGuard);
  });

  it.todo('allows users with wildcard permission');
  it.todo('allows users with all required permissions');
  it.todo('blocks users missing required permissions');
});
