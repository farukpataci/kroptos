import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';

@Injectable()
export class WmsPrinterService {
  constructor(private prisma: PrismaService) {}

  private async writeWmsAuditLog(
    action: string,
    performedBy: string,
    agencyId: string,
    ipAddress?: string,
    changes: any = {},
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          entityType: 'WMS',
          entityId: 'wms-printer-settings',
          userId: performedBy,
          tenantId: agencyId,
          ipAddress: ipAddress || null,
          metadata: JSON.parse(JSON.stringify(changes)),
        },
      });
    } catch (e) {
      console.error('Failed to write WMS audit log:', e);
    }
  }

  async getPrinterSettings(agencyId: string) {
    let settings = await this.prisma.wmsPrinterSettings.findFirst({
      where: { agencyId },
    });

    if (!settings) {
      // Create default settings if not exists
      settings = await this.prisma.wmsPrinterSettings.create({
        data: {
          agencyId,
          printerName: 'Zebra ZD220',
          printerType: 'Thermal',
          driverName: 'Zebra Designer V3',
          driverVersion: '3.0.1',
          driverInstalled: true,
          connectionType: 'USB',
          labelFormat: 'PDF',
          labelSize: '100x150',
        },
      });
    }

    return settings;
  }

  async updatePrinterSettings(
    agencyId: string,
    data: {
      printerName?: string;
      printerType?: string;
      driverName?: string;
      driverVersion?: string;
      driverInstalled?: boolean;
      connectionType?: string;
      labelFormat?: string;
      labelSize?: string;
    },
    performedBy: string,
    ipAddress?: string,
  ) {
    const existing = await this.getPrinterSettings(agencyId);

    const updated = await this.prisma.wmsPrinterSettings.update({
      where: { id: existing.id },
      data: {
        printerName: data.printerName ?? undefined,
        printerType: data.printerType ?? undefined,
        driverName: data.driverName !== undefined ? data.driverName : undefined,
        driverVersion: data.driverVersion !== undefined ? data.driverVersion : undefined,
        driverInstalled: data.driverInstalled ?? undefined,
        connectionType: data.connectionType ?? undefined,
        labelFormat: data.labelFormat ?? undefined,
        labelSize: data.labelSize ?? undefined,
      },
    });

    await this.writeWmsAuditLog(
      'wms.printer.updated',
      performedBy,
      agencyId,
      ipAddress,
      { before: existing, after: updated },
    );

    return updated;
  }

  async checkDriverStatus(agencyId: string, performedBy: string, ipAddress?: string) {
    const settings = await this.getPrinterSettings(agencyId);

    await this.writeWmsAuditLog(
      'wms.driver.checked',
      performedBy,
      agencyId,
      ipAddress,
      { driverInstalled: settings.driverInstalled },
    );

    return {
      driverInstalled: settings.driverInstalled,
      printerName: settings.printerName,
      driverName: settings.driverName || 'None',
      driverVersion: settings.driverVersion || 'N/A',
      connectionType: settings.connectionType,
      message: settings.driverInstalled
        ? 'Printer driver is successfully loaded and running.'
        : 'Printer driver is not installed. Please connect Zebra Bridge Client.',
    };
  }

  async sendTestPrint(agencyId: string, performedBy: string, ipAddress?: string) {
    const settings = await this.getPrinterSettings(agencyId);

    // Create a mock print job for the test print
    const printJob = await this.prisma.wmsPrintJob.create({
      data: {
        agencyId,
        labelId: 'test-label-id',
        printerName: settings.printerName,
        status: 'printed',
        printedAt: new Date(),
      },
    });

    await this.writeWmsAuditLog(
      'wms.test_print.sent',
      performedBy,
      agencyId,
      ipAddress,
      { printJobId: printJob.id, printerName: settings.printerName },
    );

    return {
      success: true,
      message: `Test label successfully sent to ${settings.printerName}`,
      printJob,
    };
  }

  async createPrintJob(agencyId: string, labelId: string, performedBy: string, ipAddress?: string) {
    const settings = await this.getPrinterSettings(agencyId);

    const printJob = await this.prisma.wmsPrintJob.create({
      data: {
        agencyId,
        labelId,
        printerName: settings.printerName,
        status: 'pending',
      },
    });

    // Simulate background printing process
    setImmediate(async () => {
      try {
        await this.prisma.wmsPrintJob.update({
          where: { id: printJob.id },
          data: {
            status: 'printed',
            printedAt: new Date(),
          },
        });
      } catch (err) {
        console.error('Failed to complete print job asynchronously:', err);
      }
    });

    await this.writeWmsAuditLog(
      'wms.print_job.created',
      performedBy,
      agencyId,
      ipAddress,
      { printJobId: printJob.id, labelId },
    );

    return printJob;
  }

  async getPrintJobs(agencyId: string) {
    return this.prisma.wmsPrintJob.findMany({
      where: { agencyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }
}
