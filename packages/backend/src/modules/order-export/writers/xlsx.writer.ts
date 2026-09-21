import { Writable } from 'stream';
import * as ExcelJS from 'exceljs';
import { ExportColumnDef, escapeFormula } from '../columns/column-registry';

export interface XlsxWriterOptions {
  customHeaders?: Record<string, string>;
  timezone?: string;
  metadata?: {
    filtersSummary?: string;
    requestedBy?: string;
    storeName?: string;
    createdAt?: Date;
  };
}

export class XlsxExportWriter {
  private workbook: ExcelJS.stream.xlsx.WorkbookWriter;
  private worksheet: ExcelJS.Worksheet;
  private customHeaders: Record<string, string>;
  private timezone: string;
  private metadata?: XlsxWriterOptions['metadata'];
  private rowCount = 0;

  constructor(
    outputStream: Writable,
    private columns: ExportColumnDef[],
    options?: XlsxWriterOptions,
  ) {
    this.customHeaders = options?.customHeaders || {};
    this.timezone = options?.timezone || 'Europe/Istanbul';
    this.metadata = options?.metadata;

    this.workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: outputStream,
      useStyles: true,
      useSharedStrings: true,
    });

    this.worksheet = this.workbook.addWorksheet('Siparişler', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
    });
  }

  writeHeader(): void {
    const headerRow = this.worksheet.addRow(
      this.columns.map((c) => this.customHeaders[c.key] || c.label),
    );

    // Apply bold style and background color to header
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // slate-800
    };
    headerRow.commit();

    // Set estimated column widths
    this.worksheet.columns = this.columns.map((col) => {
      let width = 15;
      if (col.type === 'date') width = 20;
      if (col.key === 'orderNumber' || col.key === 'publicId') width = 22;
      if (col.key === 'itemsSummary' || col.key === 'shippingLine1' || col.key === 'notes') width = 35;
      if (col.key === 'customerEmail' || col.key === 'customerName') width = 25;
      return { width };
    });

    // Enable auto filter
    this.worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: this.columns.length },
    };
  }

  writeRow(order: any, item?: any): void {
    const rowValues = this.columns.map((col) => {
      const raw = col.resolve(order, item, { timezone: this.timezone });
      if (raw === null || raw === undefined) return '';

      if (col.type === 'money' || col.type === 'number') {
        const num = Number(raw);
        return isNaN(num) ? raw : num;
      }
      return escapeFormula(raw);
    });

    const row = this.worksheet.addRow(rowValues);

    // Apply number formats to money/number columns
    this.columns.forEach((col, idx) => {
      const cell = row.getCell(idx + 1);
      if (col.type === 'money') {
        cell.numFmt = '#,##0.00';
      } else if (col.type === 'number') {
        cell.numFmt = '#,##0';
      }
    });

    row.commit();
    this.rowCount++;
  }

  async end(): Promise<void> {
    this.worksheet.commit();

    // Add Metadata / Summary sheet (docs/export.md §3)
    const infoSheet = this.workbook.addWorksheet('Özet ve Bilgiler');
    infoSheet.addRow(['KroptOS Sipariş Dışa Aktarma Raporu']).font = { bold: true, size: 14 };
    infoSheet.addRow([]);
    infoSheet.addRow(['Oluşturulma Zamanı', new Date().toLocaleString('tr-TR', { timeZone: this.timezone })]);
    infoSheet.addRow(['Saat Dilimi', this.timezone]);
    infoSheet.addRow(['Toplam Dışa Aktarılan Satır', this.rowCount]);
    if (this.metadata?.requestedBy) {
      infoSheet.addRow(['İsteyen Kullanıcı', this.metadata.requestedBy]);
    }
    if (this.metadata?.storeName) {
      infoSheet.addRow(['Mağaza', this.metadata.storeName]);
    }
    if (this.metadata?.filtersSummary) {
      infoSheet.addRow(['Filtre Özeti', this.metadata.filtersSummary]);
    }

    infoSheet.columns = [{ width: 25 }, { width: 50 }];
    infoSheet.commit();

    await this.workbook.commit();
  }
}
