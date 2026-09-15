import { isPlatformAdmin, isSuperAdminRole } from './platform-admin';

describe('isSuperAdminRole', () => {
  it('requires BOTH key === super_admin AND isSystem', () => {
    expect(isSuperAdminRole({ role: 'super_admin', roleIsSystem: true })).toBe(true);
    // Tenant rolü: key super_admin ama sistem rolü değil → bypass YOK (P7 sonrası ajans böyle rol açabilir)
    expect(isSuperAdminRole({ role: 'super_admin', roleIsSystem: false })).toBe(false);
    expect(isSuperAdminRole({ role: 'super_admin' })).toBe(false);
    expect(isSuperAdminRole({ role: 'agency_owner', roleIsSystem: true })).toBe(false);
    expect(isSuperAdminRole(null)).toBe(false);
    expect(isSuperAdminRole(undefined)).toBe(false);
  });

  it('isPlatformAdmin needs allowlisted email and the system super_admin role', () => {
    expect(isPlatformAdmin({ email: 'faruk.pataci@gmail.com', role: 'super_admin', roleIsSystem: true })).toBe(true);
    expect(isPlatformAdmin({ email: 'faruk.pataci@gmail.com', role: 'super_admin', roleIsSystem: false })).toBe(false);
    expect(isPlatformAdmin({ email: 'x@y.z', role: 'super_admin', roleIsSystem: true })).toBe(false);
  });
});
