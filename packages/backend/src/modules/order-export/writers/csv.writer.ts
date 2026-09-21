import { Writable } from 'stream';
import { ExportColumnDef, escapeFormula } from '../columns/column-registry';

export interface CsvWriterOptions {
  delimiter?: ';' | ',';
  useBOM?: boolean;
  customHeaders?: Record<string, string>;
  timezone?: string;
}

export class CsvExportWriter {
  private delimiter: string;
  private useBOM: boolean;
  private customHeaders: Record<string, string>;
  private timezone: string;

  constructor(
    private outputStream: Writable,
    private columns: ExportColumnDef[],
    options?: CsvWriterOptions,
  ) {
    this.delimiter = options?.delimiter || ';';
    this.useBOM = options?.useBOM !== false;
    this.customHeaders = options?.customHeaders || {};
    this.timezone = options?.timezone || 'Europe/Istanbul';
  }

  private quoteCell(val: any): string {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(this.delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  writeHeader(): void {
    if (this.useBOM) {
      this.outputStream.write('\uFEFF');
    }

    const headerLine = this.columns
      .map((col) => this.quoteCell(this.customHeaders[col.key] || col.label))
      .join(this.delimiter);

    this.outputStream.write(headerLine + '\r\n');
  }

  writeRow(order: any, item?: any): void {
    const rowLine = this.columns
      .map((col) => {
        const rawVal = col.resolve(order, item, { timezone: this.timezone });
        const safeVal = escapeFormula(rawVal);
        return this.quoteCell(safeVal);
      })
      .join(this.delimiter);

    this.outputStream.write(rowLine + '\r\n');
  }

  async end(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.outputStream.end(() => resolve());
      this.outputStream.on('error', reject);
    });
  }
}
