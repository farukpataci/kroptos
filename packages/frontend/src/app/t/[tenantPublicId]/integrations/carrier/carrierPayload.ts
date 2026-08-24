import { stripMaskedCredentials } from '@kroptos/shared';

export interface CarrierFormState {
  provider: string;
  displayName: string;
  credentials: Record<string, string>;
  isActive: boolean;
  isTestMode: boolean;
  senderAddress: Record<string, string>;
  settings: { labelFormat: string; desiDivisor: string; cutoffTime: string; defaultServiceLevel: string };
}

/** Only the address fields the API accepts; blank optional ones are dropped. */
const ADDRESS_REQUIRED = ['fullName', 'phone', 'line1', 'district', 'city', 'countryCode'];
const ADDRESS_OPTIONAL = ['line2', 'postalCode', 'email', 'taxId'];

function addressPayload(address: Record<string, string>) {
  const filled = ADDRESS_REQUIRED.every((key) => address[key]?.trim());
  // All or nothing: a half-filled sender address is rejected by the DTO, and
  // sending one field would replace a complete stored address with a broken one.
  if (!filled) return undefined;

  const out: Record<string, string> = {};
  for (const key of ADDRESS_REQUIRED) out[key] = address[key].trim();
  for (const key of ADDRESS_OPTIONAL) {
    const value = address[key]?.trim();
    if (value) out[key] = value;
  }
  return out;
}

function settingsPayload(settings: CarrierFormState['settings']) {
  const out: Record<string, unknown> = {};
  if (settings.labelFormat) out.labelFormat = settings.labelFormat;
  if (settings.defaultServiceLevel) out.defaultServiceLevel = settings.defaultServiceLevel;
  if (settings.cutoffTime) out.cutoffTime = settings.cutoffTime;
  const divisor = Number(settings.desiDivisor);
  // Zero would be a division by zero on the desi calculation, not "no tariff".
  if (settings.desiDivisor.trim() && Number.isFinite(divisor) && divisor > 0) {
    out.desiDivisor = divisor;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * The body the carrier API receives.
 *
 * Credentials go through `stripMaskedCredentials` rather than a local check:
 * the server strips the same way, using the same module, so the form cannot
 * develop its own idea of what counts as a placeholder. A secret the user did
 * not retype arrives here as the mask (what the API handed back) or as an empty
 * string, and both must be absent from the payload — sent through, they would
 * overwrite a live credential with bullets or with nothing.
 *
 * On create the caller still has to reject missing secrets; the server does too.
 */
export function carrierPayload(form: CarrierFormState, mode: 'create' | 'update') {
  const { credentials } = stripMaskedCredentials(form.credentials);

  const body: Record<string, unknown> = {
    displayName: form.displayName.trim(),
    isActive: form.isActive,
    isTestMode: form.isTestMode,
  };

  // Provider is set once. Changing it would keep credentials belonging to a
  // different carrier, so the update DTO does not accept the field at all.
  if (mode === 'create') body.provider = form.provider;
  if (mode === 'create' || Object.keys(credentials).length) body.credentials = credentials;

  const address = addressPayload(form.senderAddress);
  if (address) body.senderAddress = address;

  const settings = settingsPayload(form.settings);
  if (settings) body.settings = settings;

  return body;
}
