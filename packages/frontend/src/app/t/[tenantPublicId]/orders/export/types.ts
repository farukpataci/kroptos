export type RowMode = 'ORDER' | 'LINE_ITEM';
export type ExportFormat = 'XLSX' | 'CSV';
export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

export interface ExportColumnDef {
  key: string;
  label: string;
  group: 'ORDER' | 'CUSTOMER' | 'ITEM' | 'PAYMENT' | 'SHIPPING' | 'FINANCIAL' | 'METADATA';
  type: 'string' | 'number' | 'money' | 'date' | 'boolean' | 'enum';
  rowModes: RowMode[];
  pii?: boolean;
}

export interface OrderExportFilters {
  storeId?: string;
  clientId?: string;
  startDate?: string;
  endDate?: string;
  dateField?: 'createdAt' | 'updatedAt' | 'paidAt' | 'shippedAt' | 'deliveredAt';
  statuses?: string[];
  paymentStatuses?: string[];
  fulfillmentStatuses?: string[];
  source?: string;
  search?: string;
  orderNumbers?: string[];
}

export interface FormatOptions {
  delimiter?: ';' | ',';
  includeBom?: boolean;
  timezone?: string;
  dateFormat?: string;
  headerLanguage?: 'tr' | 'en';
}

export interface OrderExportPreset {
  id: string;
  agencyId: string;
  storeId?: string;
  name: string;
  description?: string;
  isSystemDefault: boolean;
  isShared: boolean;
  rowMode: RowMode;
  format: ExportFormat;
  columns: string[];
  filters: OrderExportFilters;
  formatOptions: FormatOptions;
  createdAt: string;
  updatedAt: string;
}

export interface OrderExportJob {
  id: string;
  agencyId: string;
  storeId: string;
  presetId?: string;
  preset?: { name: string };
  requestedById?: string;
  filters: OrderExportFilters;
  columns: string[];
  rowMode: RowMode;
  format: ExportFormat;
  formatOptions: FormatOptions;
  status: JobStatus;
  progress: number;
  totalRows?: number;
  fileKey?: string;
  fileName?: string;
  fileSize?: number;
  errorMessage?: string;
  includesPii: boolean;
  scheduleId?: string;
  startedAt?: string;
  completedAt?: string;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderExportSchedule {
  id: string;
  agencyId: string;
  storeId: string;
  name: string;
  presetId: string;
  preset?: {
    id: string;
    name: string;
    format: ExportFormat;
    rowMode: RowMode;
  };
  cron: string;
  timezone: string;
  relativeRange: string;
  recipients: string[];
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExportCountResult {
  totalOrders: number;
  totalItems: number;
}

export interface ExportPreviewResult {
  headers: string[];
  rows: any[][];
  totalSampled: number;
}
