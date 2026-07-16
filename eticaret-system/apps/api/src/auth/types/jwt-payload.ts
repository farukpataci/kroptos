export interface SessionRequestUser {
  userId: string;
  sessionId: string;
  tenantId: string | null;
  agencyId: string | null;
  clientId: string | null;
  role: string | null;
  permissions: string[];
  email: string;
}

export type SessionTenantContext = {
  tenantId: string;
  tenantName: string;
  agencyId: string;
  agencyName: string;
  clientId: string;
  clientName: string;
  role: string;
  permissions: string[];
};

export type AuthenticatedRequestUser = SessionRequestUser;
