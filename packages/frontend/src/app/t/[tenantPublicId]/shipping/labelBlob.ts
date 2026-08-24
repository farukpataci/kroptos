/**
 * The label as the API returns it: base64 for the binary formats, plain text
 * for ZPL and HTML. The carrier's own `url` is deliberately absent from this
 * type — it is usually unauthenticated and enumerable, and the label the
 * operator opens is always built from these bytes.
 */
export interface CarrierLabelContent {
  format: string;
  content: string;
}

const MIME: Record<string, string> = {
  PDF: 'application/pdf',
  PNG: 'image/png',
  HTML: 'text/html',
  ZPL: 'text/plain',
};

export function labelBlob(label: CarrierLabelContent): Blob {
  const type = MIME[label.format] ?? 'application/octet-stream';
  if (label.format === 'ZPL' || label.format === 'HTML') {
    return new Blob([label.content], { type });
  }
  // Base64 to bytes. Handing the string straight to Blob would produce a file
  // of the base64 text itself — a PDF that opens as garbage.
  const binary = atob(label.content);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new Blob([bytes], { type });
}
