import * as fs from 'fs';
import * as path from 'path';
import * as iconv from 'iconv-lite';
import * as ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';

export interface FileDetectionResult {
  format: 'CSV' | 'XLSX';
  encoding: string;
  delimiter: string;
  headerRow: number;
  sheetNames?: string[];
  headers: string[];
  sampleRows: string[][];
  totalEstimatedRows: number;
}

export interface FileReaderOptions {
  format?: 'CSV' | 'XLSX';
  encoding?: string;
  delimiter?: string;
  headerRow?: number;
  sheetName?: string;
}

/**
 * Detect delimiter by counting occurrences of candidates in lines
 */
export function detectDelimiter(lines: string[]): string {
  const candidates = [';', ',', '\t'];
  const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0 };

  for (const line of lines.slice(0, 10)) {
    if (!line.trim()) continue;
    for (const cand of candidates) {
      counts[cand] += (line.split(cand).length - 1);
    }
  }

  let best = ';';
  let max = -1;
  for (const cand of candidates) {
    if (counts[cand] > max) {
      max = counts[cand];
      best = cand;
    }
  }
  return best;
}

/**
 * Detect encoding: checks for UTF-8 BOM, valid UTF-8 sequences, or defaults to windows-1254 if invalid UTF-8
 */
export function detectEncoding(buffer: Buffer): string {
  // Check UTF-8 BOM
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return 'utf-8';
  }

  // Test UTF-8 validity
  try {
    const utf8Str = buffer.toString('utf8');
    // If it contains replacement character or specific Turkish CP1254 bytes
    if (utf8Str.includes('\uFFFD')) {
      return 'windows-1254';
    }
    return 'utf-8';
  } catch {
    return 'windows-1254';
  }
}

/**
 * Parse a single CSV line respecting quotes
 */
export function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export class OrderFileReader {
  /**
   * Inspect file, detect headers, encoding, delimiter, and return sample rows
   */
  static async inspectFile(filePath: string, options?: FileReaderOptions): Promise<FileDetectionResult> {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.xlsm') {
      throw new BadRequestException('Makro içeren Excel (.xlsm) dosyaları güvenlik nedeniyle desteklenmez.');
    }

    if (ext === '.xlsx' || ext === '.xls') {
      return this.inspectXlsx(filePath, options);
    } else {
      return this.inspectCsv(filePath, options);
    }
  }

  private static async inspectXlsx(filePath: string, options?: FileReaderOptions): Promise<FileDetectionResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheetNames = workbook.worksheets.map((s) => s.name);
    const worksheet = options?.sheetName ? workbook.getWorksheet(options.sheetName) : workbook.worksheets[0];

    if (!worksheet) {
      throw new BadRequestException('Excel çalışma sayfası bulunamadı.');
    }

    const headerRowNum = options?.headerRow || 1;
    const headerRow = worksheet.getRow(headerRowNum);
    const headers: string[] = [];

    headerRow.eachCell({ includeEmpty: false }, (cell) => {
      headers.push(String(cell.value || '').trim());
    });

    const sampleRows: string[][] = [];
    const totalEstimatedRows = Math.max(0, worksheet.rowCount - headerRowNum);

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= headerRowNum) return;
      if (sampleRows.length >= 10) return;

      const rowValues: string[] = [];
      for (let c = 1; c <= headers.length; c++) {
        const val = row.getCell(c).value;
        if (val instanceof Date) {
          rowValues.push(val.toISOString());
        } else if (typeof val === 'object' && val !== null) {
          rowValues.push((val as any).text || (val as any).result || JSON.stringify(val));
        } else {
          rowValues.push(val !== null && val !== undefined ? String(val).trim() : '');
        }
      }
      sampleRows.push(rowValues);
    });

    return {
      format: 'XLSX',
      encoding: 'utf-8',
      delimiter: '',
      headerRow: headerRowNum,
      sheetNames,
      headers,
      sampleRows,
      totalEstimatedRows,
    };
  }

  private static async inspectCsv(filePath: string, options?: FileReaderOptions): Promise<FileDetectionResult> {
    const rawBuffer = fs.readFileSync(filePath);
    const encoding = options?.encoding || detectEncoding(rawBuffer);

    let content = iconv.decode(rawBuffer, encoding);
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1); // remove BOM
    }

    const allLines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (allLines.length === 0) {
      throw new BadRequestException('Dosya boş.');
    }

    const delimiter = options?.delimiter || detectDelimiter(allLines);
    const headerRowNum = options?.headerRow || 1;

    if (allLines.length < headerRowNum) {
      throw new BadRequestException(`Dosyada ${headerRowNum}. satırda başlık bulunamadı.`);
    }

    const headers = parseCsvLine(allLines[headerRowNum - 1], delimiter);
    const sampleRows: string[][] = [];

    for (let i = headerRowNum; i < Math.min(allLines.length, headerRowNum + 10); i++) {
      sampleRows.push(parseCsvLine(allLines[i], delimiter));
    }

    return {
      format: 'CSV',
      encoding,
      delimiter,
      headerRow: headerRowNum,
      headers,
      sampleRows,
      totalEstimatedRows: Math.max(0, allLines.length - headerRowNum),
    };
  }

  /**
   * Stream all rows of the file calling onRow for each parsed record
   */
  static async streamRows(
    filePath: string,
    options: FileReaderOptions,
    onRow: (row: Record<string, any>, rowNumber: number) => Promise<void> | void,
  ): Promise<number> {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.xlsx' || ext === '.xls') {
      return this.streamXlsx(filePath, options, onRow);
    } else {
      return this.streamCsv(filePath, options, onRow);
    }
  }

  private static async streamXlsx(
    filePath: string,
    options: FileReaderOptions,
    onRow: (row: Record<string, any>, rowNumber: number) => Promise<void> | void,
  ): Promise<number> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = options.sheetName ? workbook.getWorksheet(options.sheetName) : workbook.worksheets[0];
    if (!worksheet) return 0;

    const headerRowNum = options.headerRow || 1;
    const headerRow = worksheet.getRow(headerRowNum);
    const headers: string[] = [];

    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      headers[colNumber] = String(cell.value || '').trim();
    });

    let count = 0;
    for (let r = headerRowNum + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      if (!row.hasValues) continue;

      const record: Record<string, any> = {};
      let hasAnyValue = false;

      for (let c = 1; c < headers.length; c++) {
        const header = headers[c];
        if (!header) continue;

        let val = row.getCell(c).value;
        if (val instanceof Date) {
          val = val.toISOString();
        } else if (typeof val === 'object' && val !== null) {
          val = (val as any).text || (val as any).result || String(val);
        }
        if (val !== null && val !== undefined && String(val).trim() !== '') {
          hasAnyValue = true;
        }
        record[header] = val;
      }

      if (hasAnyValue) {
        count++;
        await onRow(record, r);
      }
    }
    return count;
  }

  private static async streamCsv(
    filePath: string,
    options: FileReaderOptions,
    onRow: (row: Record<string, any>, rowNumber: number) => Promise<void> | void,
  ): Promise<number> {
    const rawBuffer = fs.readFileSync(filePath);
    const encoding = options.encoding || detectEncoding(rawBuffer);

    let content = iconv.decode(rawBuffer, encoding);
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const delimiter = options.delimiter || detectDelimiter(lines);
    const headerRowNum = options.headerRow || 1;

    const headers = parseCsvLine(lines[headerRowNum - 1], delimiter);
    let count = 0;

    for (let i = headerRowNum; i < lines.length; i++) {
      const values = parseCsvLine(lines[i], delimiter);
      const record: Record<string, any> = {};
      let hasAnyValue = false;

      for (let c = 0; c < headers.length; c++) {
        const h = headers[c];
        const val = values[c] !== undefined ? values[c] : '';
        if (val !== '') hasAnyValue = true;
        record[h] = val;
      }

      if (hasAnyValue) {
        count++;
        await onRow(record, i + 1);
      }
    }
    return count;
  }
}
