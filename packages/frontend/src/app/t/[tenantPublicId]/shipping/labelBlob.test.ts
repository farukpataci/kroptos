import { labelBlob } from './labelBlob';

/** Reads the blob back, so the assertion is about bytes and not about length. */
const read = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });

describe('labelBlob', () => {
  it('decodes a base64 PDF instead of saving the base64 text', async () => {
    const blob = labelBlob({ format: 'PDF', content: btoa('%PDF-1.4 etiket') });

    expect(blob.type).toBe('application/pdf');
    await expect(read(blob)).resolves.toBe('%PDF-1.4 etiket');
  });

  it('passes ZPL through as text', async () => {
    const blob = labelBlob({ format: 'ZPL', content: '^XA^FDTRK-1^FS^XZ' });

    expect(blob.type).toBe('text/plain');
    await expect(read(blob)).resolves.toBe('^XA^FDTRK-1^FS^XZ');
  });

  it('falls back to a generic type for a format it does not know', () => {
    expect(labelBlob({ format: 'XYZ', content: btoa('x') }).type).toBe('application/octet-stream');
  });
});
