import { Controller, Get, Patch, Post, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { WmsPrinterService } from './wms-printer.service';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';

@ApiTags('WMS Printer')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID context' })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/wms')
export class WmsPrinterController {
  constructor(private printerService: WmsPrinterService) {}

  @Get('printer/settings')
  @RequirePermission('wms.view')
  @ApiOperation({ summary: 'Get WMS printer settings' })
  async getSettings(@Req() req: Request) {
    const activeAgency = (req as any).activeAgency;
    return this.printerService.getPrinterSettings(activeAgency.id);
  }

  @Patch('printer/settings')
  @RequirePermission('wms.settings.update')
  @ApiOperation({ summary: 'Update WMS printer settings' })
  async updateSettings(@Body() body: any, @Req() req: Request) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    return this.printerService.updatePrinterSettings(
      activeAgency.id,
      body,
      user.userId,
      req.ip,
    );
  }

  @Get('printer/driver')
  @RequirePermission('wms.view')
  @ApiOperation({ summary: 'Check printer driver status' })
  async checkDriver(@Req() req: Request) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    return this.printerService.checkDriverStatus(activeAgency.id, user.userId, req.ip);
  }

  @Post('printer/test')
  @HttpCode(200)
  @RequirePermission('wms.print')
  @ApiOperation({ summary: 'Send test print label' })
  async testPrint(@Req() req: Request) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    return this.printerService.sendTestPrint(activeAgency.id, user.userId, req.ip);
  }

  @Get('print-jobs')
  @RequirePermission('wms.view')
  @ApiOperation({ summary: 'List recent print jobs' })
  async getPrintJobs(@Req() req: Request) {
    const activeAgency = (req as any).activeAgency;
    return this.printerService.getPrintJobs(activeAgency.id);
  }
}
