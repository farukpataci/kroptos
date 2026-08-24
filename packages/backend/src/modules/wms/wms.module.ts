import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ShipmentModule } from '../shipment/shipment.module';
import { WmsPrinterController } from './printer/wms-printer.controller';
import { WmsPrinterService } from './printer/wms-printer.service';
import { WmsLabelController } from './labels/wms-label.controller';
import { WmsLabelService } from './labels/wms-label.service';
import { WmsShipmentController } from './shipments/wms-shipment.controller';
import { WmsShipmentService } from './shipments/wms-shipment.service';

@Module({
  // ShipmentModule exports ShipmentService and CarrierIntegrationService: the
  // label is a derivative of a real shipment now, not a row invented here.
  imports: [PrismaModule, ShipmentModule],
  controllers: [
    WmsPrinterController,
    WmsLabelController,
    WmsShipmentController,
  ],
  providers: [
    WmsPrinterService,
    WmsLabelService,
    WmsShipmentService,
  ],
  exports: [
    WmsPrinterService,
    WmsLabelService,
    WmsShipmentService,
  ],
})
export class WmsModule {}
