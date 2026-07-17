import { Controller, Get, Query, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { SignedUrlService } from '../../common/services/signed-url.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('files')
export class FilesController {
  constructor(
    private signedUrlService: SignedUrlService,
    private prisma: PrismaService,
  ) {}

  @Get('shipping-label')
  async getShippingLabel(@Query('token') token: string, @Res() res: Response) {
    if (!token) {
      throw new NotFoundException('Token parameter is missing');
    }

    // Validate the cryptographically signed token
    const payload = this.signedUrlService.validateToken(token);

    // Retrieve shipping label by publicId and check tenant isolation
    const label = await this.prisma.wmsShippingLabel.findFirst({
      where: {
        publicId: payload.filePublicId,
        agency: { publicId: payload.tenantPublicId },
      },
    });

    if (!label) {
      throw new NotFoundException('Shipping label file not found or tenant mismatch');
    }

    // Write a download transaction audit log event
    await this.prisma.auditLog.create({
      data: {
        action: 'shipping_label.download',
        entityType: 'WmsShippingLabel',
        entityId: label.id,
        tenantId: label.agencyId,
        description: `Shipping label for tracking number ${label.trackingNumber} downloaded successfully via signed URL`,
      },
    });

    // If label has an actual URL path, redirect to it
    if (label.labelUrl && (label.labelUrl.startsWith('http://') || label.labelUrl.startsWith('https://'))) {
      return res.redirect(label.labelUrl);
    }

    // Otherwise, generate and return a mock PDF download attachment
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=shipping-label-${payload.filePublicId}.pdf`);
    
    // Simulate standard PDF header bytes
    const mockPdfBytes = Buffer.from('%PDF-1.4 ... Simulated WMS Shipping Label PDF Content ...');
    return res.send(mockPdfBytes);
  }
}
