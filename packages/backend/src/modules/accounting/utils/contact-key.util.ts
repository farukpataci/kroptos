/**
 * Generates a deterministic unique key for contact/customer identification.
 * Priority: Tax Number / TC No -> Email -> Phone -> Name
 */
export function generateContactKey(contact: {
  taxNumber?: string;
  email?: string;
  phone?: string;
  name: string;
}): string {
  if (contact.taxNumber && contact.taxNumber.trim().length >= 10) {
    const cleanTax = contact.taxNumber.replace(/\D/g, '');
    if (cleanTax.length >= 10) {
      return `TAX-${cleanTax}`;
    }
  }

  if (contact.email && contact.email.includes('@')) {
    return `EMAIL-${contact.email.trim().toLowerCase()}`;
  }

  if (contact.phone && contact.phone.trim().length >= 7) {
    const cleanPhone = contact.phone.replace(/\D/g, '');
    if (cleanPhone.length >= 7) {
      return `PHONE-${cleanPhone}`;
    }
  }

  // Fallback to normalized name
  const cleanName = contact.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, '-');
  return `NAME-${cleanName}`;
}
