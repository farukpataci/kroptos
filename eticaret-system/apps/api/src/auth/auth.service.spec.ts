import { AuthService } from './auth.service';

describe('AuthService', () => {
  const database = {
    client: {
      user: {
        findUnique: jest.fn(),
      },
    },
  };

  it('can be instantiated', () => {
    const service = new AuthService(database as never, {} as never);
    expect(service).toBeInstanceOf(AuthService);
  });

  it.todo('hashes passwords with bcrypt during register');
  it.todo('returns only the raw session token during login');
  it.todo('stores only SHA-256 token hash in sessions');
  it.todo('revokes sessions during logout');
  it.todo('blocks select-tenant for inaccessible tenants');
});
