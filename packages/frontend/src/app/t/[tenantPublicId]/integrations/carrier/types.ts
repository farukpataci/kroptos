/** CarrierIntegrationService.toResponse — credentials always masked. */
export interface CarrierConnection {
  id: string;
  publicId: string;
  provider: string;
  displayName: string;
  credentials: Record<string, string>;
  isActive: boolean;
  isTestMode: boolean;
  senderAddress: Record<string, string> | null;
  settings: Record<string, unknown> | null;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
  createdAt: string;
}

/** GET /api/carriers/providers — what the form may offer and must collect. */
export interface CarrierProviderOption {
  provider: string;
  requiredFields: { name: string; secret: boolean }[];
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  durationMs?: number;
}
