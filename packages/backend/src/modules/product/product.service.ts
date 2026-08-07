import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateProductDto, UpdateProductDto, BulkActionDto } from './dto/product.dto';
import { Prisma } from '@prisma/client';
import { IntegrationQueueService } from '../integration/integration-queue.service';
import { generatePublicId } from '../../common/utils/id-generator';


@Injectable()
export class ProductService {
  constructor(
    private prisma: PrismaService,
    private integrationQueueService: IntegrationQueueService,
  ) {}

  // Alan adlari sema ile hizali olmak zorunda: AuditLog'da `performedBy`, `agencyId` ve
  // `changes` alanlari YOK (schema.prisma › model AuditLog). Buraya once o adlar yaziliyordu;
  // Prisma her cagriyi PrismaClientValidationError ile reddediyor, asagidaki catch da hatayi
  // yutuyordu - yani urun create/update/delete kayitlarinin hicbiri hic yazilmadi. Dogru
  // adlar: userId, tenantId (@map("agencyId")) ve newValue. Kalip: OrderService.writeAuditLog.
  private async writeAuditLog(
    tx: Prisma.TransactionClient,
    action: string,
    entityId: string,
    performedBy: string,
    agencyId: string,
    ipAddress?: string,
    changes: any = {},
  ) {
    try {
      await tx.auditLog.create({
        data: {
          action,
          entityType: 'Product',
          entityId,
          userId: performedBy,
          tenantId: agencyId,
          ipAddress: ipAddress || null,
          newValue: changes ? JSON.parse(JSON.stringify(changes)) : undefined,
        },
      });
    } catch (error) {
      console.error('Failed to write audit log in ProductService:', error);
    }
  }

  async list(
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    isSuperAdmin?: boolean,
  ) {
    if (!activeStoreId && !isSuperAdmin) {
      throw new BadRequestException('Active store context is required (x-store-id header)');
    }

    const whereClause: any = { deletedAt: null };

    if (activeStoreId) {
      whereClause.storeId = activeStoreId;
    }
    if (activeClientId) {
      whereClause.clientId = activeClientId;
    }
    if (activeAgencyId) {
      whereClause.agencyId = activeAgencyId;
    }

    const products = await this.prisma.product.findMany({
      where: whereClause,
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        location: {
          include: {
            warehouse: {
              select: { id: true, name: true, code: true },
            },
            zone: {
              select: { id: true, name: true, code: true, type: true },
            },
          },
        },
        bundleItems: {
          include: {
            childProduct: {
              select: { id: true, publicId: true, name: true, sku: true, price: true }
            }
          }
        },
        crossSellSources: {
          include: {
            targetProduct: {
              select: { id: true, publicId: true, name: true, sku: true, price: true }
            }
          }
        },
        variants: {
          where: { deletedAt: null }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    return products.map((p) => this.mapProductResponse(p));
  }

  async get(
    id: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    isSuperAdmin?: boolean,
  ) {
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [
          { id },
          { publicId: id },
        ],
        deletedAt: null,
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        location: {
          include: {
            warehouse: {
              select: { id: true, name: true, code: true },
            },
            zone: {
              select: { id: true, name: true, code: true, type: true },
            },
          },
        },
        bundleItems: {
          include: {
            childProduct: true
          }
        },
        crossSellSources: {
          include: {
            targetProduct: true
          }
        },
        variants: {
          where: { deletedAt: null }
        }
      }
    });

    if (!product) {
      throw new NotFoundException(`Product with ID '${id}' not found or soft-deleted`);
    }

    if (!activeStoreId && !isSuperAdmin) {
      throw new BadRequestException('Active store context is required (x-store-id header)');
    }

    if (!isSuperAdmin) {
      if (product.storeId !== activeStoreId) {
        throw new ForbiddenException('Access denied. Product belongs to a different store context.');
      }
    }

    return this.mapProductResponse(product);
  }

  async create(
    dto: CreateProductDto,
    userId: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    isSuperAdmin?: boolean,
    ipAddress?: string,
  ) {
    if (!activeStoreId && !isSuperAdmin) {
      throw new BadRequestException('Active store context is required (x-store-id header)');
    }

    // Determine the context fields. Use values from active context
    const agencyId = activeAgencyId;
    const clientId = activeClientId;
    const storeId = activeStoreId;

    if (!agencyId || !clientId || !storeId) {
      throw new BadRequestException(
        'Missing active tenant context headers (x-agency-id, x-client-id, and x-store-id are required)',
      );
    }

    // Validate categoryId if provided
    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, deletedAt: null },
      });
      if (!category) {
        throw new BadRequestException(`Category '${dto.categoryId}' does not exist or is soft-deleted`);
      }
      // Ensure category belongs to the same agency
      if (category.agencyId !== agencyId) {
        throw new BadRequestException('Category belongs to a different agency context');
      }
    }

    // Verify SKU uniqueness inside the store
    const existingProduct = await this.prisma.product.findFirst({
      where: {
        storeId,
        sku: dto.sku,
        deletedAt: null,
      },
    });

    if (existingProduct) {
      throw new BadRequestException(`Product with SKU '${dto.sku}' already exists in this store`);
    }

    let defaultCurrency = 'TRY';
    try {
      const sysSettings = await this.prisma.systemSettings.findFirst();
      if (sysSettings?.defaultCurrency) {
        defaultCurrency = sysSettings.defaultCurrency;
      }
    } catch (_) {}

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          agencyId,
          clientId,
          storeId,
          categoryId: dto.categoryId || null,
          sku: dto.sku,
          name: dto.name,
          description: dto.description || null,
          price: new Prisma.Decimal(dto.price),
          basePrice: new Prisma.Decimal(dto.basePrice !== undefined && dto.basePrice !== null ? dto.basePrice : dto.price),
          costPrice: dto.costPrice !== undefined ? new Prisma.Decimal(dto.costPrice) : null,
          barcode: dto.barcode || null,
          currency: dto.currency || defaultCurrency,
          stockQuantity: dto.stockQuantity !== undefined ? dto.stockQuantity : 0,
          status: dto.status || 'active',
          weight: dto.weight !== undefined ? new Prisma.Decimal(dto.weight) : null,
          width: dto.width !== undefined ? new Prisma.Decimal(dto.width) : null,
          height: dto.height !== undefined ? new Prisma.Decimal(dto.height) : null,
          depth: dto.depth !== undefined ? new Prisma.Decimal(dto.depth) : null,
          image: dto.image || null,
          erpCode: dto.erpCode || null,
          erpId: dto.erpId || null,
          taxRate: dto.taxRate !== undefined ? dto.taxRate : 20,
          publicId: generatePublicId('prd', 12),
          isActive: true,
          type: dto.type || 'SIMPLE',
          variantAttributes: dto.variantAttributes || undefined,
          parentId: dto.parentId || null,
          locationId: dto.locationId || null,
          locationCode: dto.locationCode || null,
        },
      });

      if (dto.bundleItems && dto.bundleItems.length > 0) {
        await tx.bundleItem.createMany({
          data: dto.bundleItems.map((item) => ({
            bundleProductId: product.id,
            childProductId: item.childProductId,
            quantity: item.quantity,
            discountRate: item.discountRate !== undefined ? new Prisma.Decimal(item.discountRate) : null,
          })),
        });
      }

      if (dto.crossSellProducts && dto.crossSellProducts.length > 0) {
        await tx.crossSellProduct.createMany({
          data: dto.crossSellProducts.map((item) => ({
            sourceProductId: product.id,
            targetProductId: item.targetProductId,
            displayOrder: item.displayOrder !== undefined ? item.displayOrder : 0,
          })),
        });
      }
      if (dto.variants && dto.variants.length > 0) {
        for (const variant of dto.variants) {
          await tx.product.create({
            data: {
              agencyId,
              clientId,
              storeId,
              categoryId: product.categoryId,
              sku: variant.sku,
              name: `${product.name} - ${Object.values(variant.variantAttributes).join(' / ')}`,
              price: new Prisma.Decimal(variant.price),
              basePrice: new Prisma.Decimal(variant.price),
              stockQuantity: variant.stockQuantity,
              type: 'VARIANT_CHILD',
              variantAttributes: variant.variantAttributes,
              parentId: product.id,
              publicId: generatePublicId('prd', 12),
              isActive: true,
              currency: product.currency,
              taxRate: product.taxRate,
            },
          });
        }
      }

      // Audit Log
      await this.writeAuditLog(
        tx,
        'create',
        product.id,
        userId,
        agencyId,
        ipAddress,
        { sku: product.sku, name: product.name, price: product.price },
      );

      return product;
    });
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    userId: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    isSuperAdmin?: boolean,
    ipAddress?: string,
  ) {
    const product = await this.get(id, activeAgencyId, activeClientId, activeStoreId, isSuperAdmin);

    // Validate categoryId if provided
    if (dto.categoryId !== undefined) {
      if (dto.categoryId === null) {
        // Clearing category
      } else {
        const category = await this.prisma.category.findFirst({
          where: { id: dto.categoryId, deletedAt: null },
        });
        if (!category) {
          throw new BadRequestException(`Category '${dto.categoryId}' does not exist or is soft-deleted`);
        }
        if (category.agencyId !== product.agencyId) {
          throw new BadRequestException('Category belongs to a different agency context');
        }
      }
    }

    // Verify SKU uniqueness inside the store if SKU is being changed
    if (dto.sku !== undefined && dto.sku !== product.sku) {
      const existingProduct = await this.prisma.product.findFirst({
        where: {
          storeId: product.storeId,
          sku: dto.sku,
          deletedAt: null,
          id: { not: product.id },
        },
      });

      if (existingProduct) {
        throw new BadRequestException(`Product with SKU '${dto.sku}' already exists in this store`);
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: {
          categoryId: dto.categoryId !== undefined ? dto.categoryId : undefined,
          sku: dto.sku || undefined,
          name: dto.name || undefined,
          description: dto.description !== undefined ? dto.description : undefined,
          price: dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined,
          basePrice: dto.basePrice !== undefined ? new Prisma.Decimal(dto.basePrice) : undefined,
          costPrice: dto.costPrice !== undefined ? new Prisma.Decimal(dto.costPrice) : undefined,
          barcode: dto.barcode !== undefined ? dto.barcode : undefined,
          currency: dto.currency || undefined,
          stockQuantity: dto.stockQuantity !== undefined ? dto.stockQuantity : undefined,
          status: dto.status || undefined,
          weight: dto.weight !== undefined ? new Prisma.Decimal(dto.weight) : undefined,
          width: dto.width !== undefined ? new Prisma.Decimal(dto.width) : undefined,
          height: dto.height !== undefined ? new Prisma.Decimal(dto.height) : undefined,
          depth: dto.depth !== undefined ? new Prisma.Decimal(dto.depth) : undefined,
          image: dto.image !== undefined ? dto.image : undefined,
          erpCode: dto.erpCode !== undefined ? dto.erpCode : undefined,
          erpId: dto.erpId !== undefined ? dto.erpId : undefined,
          taxRate: dto.taxRate !== undefined ? dto.taxRate : undefined,
          isActive: dto.isActive !== undefined ? dto.isActive : undefined,
          type: dto.type || undefined,
          variantAttributes: dto.variantAttributes || undefined,
          parentId: dto.parentId !== undefined ? dto.parentId : undefined,
          locationId: dto.locationId !== undefined ? dto.locationId : undefined,
          locationCode: dto.locationCode !== undefined ? dto.locationCode : undefined,
        },
      });

      if (dto.bundleItems !== undefined) {
        await tx.bundleItem.deleteMany({ where: { bundleProductId: product.id } });
        if (dto.bundleItems && dto.bundleItems.length > 0) {
          await tx.bundleItem.createMany({
            data: dto.bundleItems.map((item) => ({
              bundleProductId: product.id,
              childProductId: item.childProductId,
              quantity: item.quantity,
              discountRate: item.discountRate !== undefined ? new Prisma.Decimal(item.discountRate) : null,
            })),
          });
        }
      }

      if (dto.crossSellProducts !== undefined) {
        await tx.crossSellProduct.deleteMany({ where: { sourceProductId: product.id } });
        if (dto.crossSellProducts && dto.crossSellProducts.length > 0) {
          await tx.crossSellProduct.createMany({
            data: dto.crossSellProducts.map((item) => ({
              sourceProductId: product.id,
              targetProductId: item.targetProductId,
              displayOrder: item.displayOrder !== undefined ? item.displayOrder : 0,
            })),
          });
        }
      }
      if (dto.variants !== undefined) {
        await tx.product.deleteMany({ where: { parentId: product.id } });
        if (dto.variants && dto.variants.length > 0) {
          for (const variant of dto.variants) {
            await tx.product.create({
              data: {
                agencyId: product.agencyId,
                clientId: product.clientId,
                storeId: product.storeId,
                categoryId: product.categoryId,
                sku: variant.sku,
                name: `${updatedProduct.name} - ${Object.values(variant.variantAttributes).join(' / ')}`,
                price: new Prisma.Decimal(variant.price),
                basePrice: new Prisma.Decimal(variant.price),
                stockQuantity: variant.stockQuantity,
                type: 'VARIANT_CHILD',
                variantAttributes: variant.variantAttributes,
                parentId: product.id,
                publicId: generatePublicId('prd', 12),
                isActive: true,
                currency: product.currency,
                taxRate: product.taxRate,
              },
            });
          }
        }
      }

      // Audit Log
      await this.writeAuditLog(
        tx,
        'update',
        id,
        userId,
        product.agencyId,
        ipAddress,
        {
          before: { sku: product.sku, name: product.name, price: product.price, status: product.status },
          after: { sku: updatedProduct.sku, name: updatedProduct.name, price: updatedProduct.price, status: updatedProduct.status },
        },
      );

      return updatedProduct;
    });

    // Enqueue stock sync job for active integrations
    if (dto.stockQuantity !== undefined && dto.stockQuantity !== product.stockQuantity) {
      try {
        const activeIntegrations = await this.prisma.integration.findMany({
          where: {
            providerType: 'marketplace',
            status: 'active',
            deletedAt: null,
            OR: [
              { storeId: product.storeId },
              { storeId: null, clientId: product.clientId, agencyId: product.agencyId },
              { storeId: null, clientId: null, agencyId: product.agencyId },
            ],
          },
        });

        for (const integration of activeIntegrations) {
          await this.integrationQueueService.addSyncJob(
            integration.id,
            'sync_stock',
            { sku: result.sku, quantity: result.stockQuantity },
          );
        }
      } catch (err) {
        console.error('Failed to enqueue stock sync jobs:', err);
      }
    }

    return result;
  }

  async delete(
    id: string,
    userId: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    isSuperAdmin?: boolean,
    ipAddress?: string,
  ) {
    const product = await this.get(id, activeAgencyId, activeClientId, activeStoreId, isSuperAdmin);

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();

      // Free up SKU constraint by appending deleted timestamp to SKU
      const deletedSku = `${product.sku}_deleted_${Date.now()}`;

      await tx.product.update({
        where: { id: product.id },
        data: {
          sku: deletedSku,
          deletedAt: now,
          isActive: false,
          status: 'suspended',
        },
      });

      // Audit Log
      await this.writeAuditLog(
        tx,
        'delete',
        id,
        userId,
        product.agencyId,
        ipAddress,
        { sku: product.sku, deletedAt: now },
      );
    });
  }

  async parseUrl(url: string) {
    if (!url) {
      throw new BadRequestException('URL gereklidir.');
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      if (!response.ok) {
        throw new BadRequestException(`HTTP hatası! Durum: ${response.status}`);
      }

      const html = await response.text();

      // Extract title/name
      const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i)?.[1] ||
                       html.match(/<meta\s+name=["']title["']\s+content=["'](.*?)["']/i)?.[1] ||
                       html.match(/<title>(.*?)<\/title>/i)?.[1] || '';

      // Extract description
      const ogDescription = html.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i)?.[1] ||
                             html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i)?.[1] || '';

      // Extract primary image
      const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i)?.[1] || '';

      const images: string[] = [];
      if (ogImage) {
        images.push(ogImage);
      }

      // Match other og:image tags
      const imageRegex = /<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/gi;
      let match;
      while ((match = imageRegex.exec(html)) !== null) {
        const imgUrl = match[1];
        if (imgUrl && !images.includes(imgUrl)) {
          images.push(imgUrl);
        }
      }

      // Try matching other general product images
      const imgTagRegex = /<img[^>]+src=["'](https:\/\/[^"']+\.(?:png|jpg|jpeg|webp)(?:\?[^"']+)?)["']/gi;
      let imgMatch;
      let count = 0;
      while ((imgMatch = imgTagRegex.exec(html)) !== null && count < 8) {
        const src = imgMatch[1];
        if (
          src &&
          !images.includes(src) &&
          !src.includes('logo') &&
          !src.includes('icon') &&
          !src.includes('avatar') &&
          !src.includes('banner') &&
          !src.includes('sprite') &&
          !src.includes('tracker')
        ) {
          images.push(src);
          count++;
        }
      }

      // Try matching price
      let price = 0;
      const priceMeta = html.match(/<meta\s+property=["']product:price:amount["']\s+content=["'](.*?)["']/i)?.[1] ||
                        html.match(/<meta\s+property=["']og:price:amount["']\s+content=["'](.*?)["']/i)?.[1] ||
                        html.match(/["']price["']\s*:\s*["']?([\d.,]+)["']?/i)?.[1];
      if (priceMeta) {
        price = parseFloat(priceMeta.replace(/,/g, ''));
      }

      // Generate a clean SKU from domain and title
      let domain = 'PRD';
      try {
        const parsedUrl = new URL(url);
        domain = parsedUrl.hostname.replace('www.', '').split('.')[0].toUpperCase();
      } catch (_) {}

      const cleanTitle = ogTitle
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim()
        .split(/\s+/)
        .slice(0, 3)
        .join('-')
        .toUpperCase();

      const randomId = Math.floor(1000 + Math.random() * 9000);
      const sku = `${domain}-${cleanTitle || 'ITEM'}-${randomId}`;

      return {
        name: ogTitle ? decodeHtmlEntity(ogTitle) : '',
        sku,
        description: ogDescription ? decodeHtmlEntity(ogDescription) : '',
        price: price || 99.90,
        basePrice: price ? price * 1.2 : 119.90,
        images: images.filter(Boolean),
      };
    } catch (e: any) {
      throw new BadRequestException(`Ürün bilgileri URL'den çekilemedi: ${e.message}`);
    }
  }

  // TODO: gerçek ERP entegrasyonu; şimdilik boş dönüyor.
  //
  // Bu uç, controller'daki @Get(':id') gölgelemesi nedeniyle bugüne kadar hiç
  // çalışmadı (istek ProductController.get'e düşüp 404 üretiyordu). Gölgeleme
  // düzeltildi, ancak aşağıdaki mock katalog kullanıcıya gerçek muhasebe kalemi
  // gibi görüneceği için yayına açılmadı. Beklenen yanıt şekli — gerçek
  // entegrasyon yazılırken uyulacak sözleşme — korunsun diye burada bırakıldı:
  //
  // const mockErpItems = [
  //   { id: 'erp-001', code: '150.01.001', name: 'Apple iPhone 13 128GB (Siyah)', stock: 42, price: 28999.00, barcode: '868000000123' },
  //   { id: 'erp-002', code: '150.01.002', name: 'Samsung Galaxy S22 256GB', stock: 28, price: 24999.00, barcode: '868000000124' },
  //   { id: 'erp-003', code: '150.02.015', name: 'Sony WH-1000XM4 Kablosuz Kulaklık', stock: 15, price: 8499.00, barcode: '868000000125' },
  //   { id: 'erp-004', code: '150.03.004', name: 'Dell XPS 13 9310 Core i7', stock: 7, price: 45999.00, barcode: '868000000126' },
  //   { id: 'erp-005', code: '150.04.088', name: 'Logitech MX Master 3S Mouse', stock: 65, price: 3299.00, barcode: '868000000127' },
  //   { id: 'erp-006', code: '150.05.002', name: 'Xiaomi Mi Band 7 Akıllı Bileklik', stock: 120, price: 999.00, barcode: '868000000128' },
  // ];
  //
  // if (!query) return mockErpItems;
  //
  // const q = query.toLowerCase();
  // return mockErpItems.filter(
  //   (item) =>
  //     item.name.toLowerCase().includes(q) ||
  //     item.code.toLowerCase().includes(q) ||
  //     item.barcode.includes(q),
  // );
  async searchErpItems(query?: string) {
    return [];
  }

  private mapProductResponse(product: any) {
    if (!product) return product;
    return {
      ...product,
      price: product.price ? Number(product.price) : 0,
      basePrice: product.basePrice ? Number(product.basePrice) : 0,
      costPrice: product.costPrice ? Number(product.costPrice) : undefined,
      weight: product.weight ? Number(product.weight) : undefined,
      width: product.width ? Number(product.width) : undefined,
      height: product.height ? Number(product.height) : undefined,
      depth: product.depth ? Number(product.depth) : undefined,
      locationId: product.locationId || product.location?.id,
      locationCode: product.locationCode || product.location?.code,
      locationBarcode: product.location?.barcode,
      warehouseName: product.location?.warehouse?.name,
      zoneName: product.location?.zone?.name,
    };
  }

  async bulkAction(
    dto: BulkActionDto,
    userId: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    isSuperAdmin?: boolean,
    ipAddress?: string,
  ) {
    if (!dto.productIds || dto.productIds.length === 0) {
      throw new BadRequestException('No products selected for bulk action.');
    }

    // Baglam zorunlu. Onceden tenant filtresi kosullu kuruluyordu; ucu de bos gelirse
    // where yalnizca { id: { in: … } } kaliyor ve toplu islem butun kiracilarin
    // urunlerine dokunuyordu. Tenant header'i gondermemek istemcide erisilebilir bir
    // durum (lib/api.ts, selected_tenant bos olabilir), dolayisiyla "baglam yok" asla
    // "tum kiracilar" demek olamaz. Kontroller create() ile birebir ayni.
    if (!activeStoreId && !isSuperAdmin) {
      throw new BadRequestException('Active store context is required (x-store-id header)');
    }

    const productIds = Array.from(new Set(dto.productIds));

    const now = new Date();
    let auditAction: string;
    let updateData: any;
    let auditChangesFor: (product: any) => any;

    if (dto.action === 'delete') {
      auditAction = 'bulk_delete';
      updateData = { deletedAt: now };
      auditChangesFor = (product) => ({ sku: product.sku, deletedAt: now });
    } else if (dto.action === 'update_status' && dto.data?.status) {
      auditAction = 'bulk_update_status';
      updateData = { status: dto.data.status };
      auditChangesFor = (product) => ({
        before: { status: product.status },
        after: { status: dto.data.status },
      });
    } else if (dto.action === 'update_location') {
      const locationCode = dto.data?.locationCode || null;
      const locationId = dto.data?.locationId || null;
      auditAction = 'bulk_update_location';
      updateData = { locationCode, locationId };
      auditChangesFor = (product) => ({
        before: { locationId: product.locationId, locationCode: product.locationCode },
        after: { locationId, locationCode },
      });
    } else {
      throw new BadRequestException(`Unsupported bulk action '${dto.action}'`);
    }

    const whereClause: any = {
      id: { in: productIds },
      deletedAt: null,
    };
    if (!isSuperAdmin) {
      // storeId kosulsuz: yukaridaki 400 dolu olmasini garanti ediyor ve izolasyonu tek
      // basina o sagliyor - Store satiri agency/client'i sabitliyor. clientId ve agencyId
      // ek guvence; middleware ikisini de magazadan turetiyor ama client'siz magazalarda
      // (store.clientId = null, tenant.middleware.ts:165) activeClient hic kurulmuyor.
      // Onceki hata "hicbiri yoksa filtre de yok"tu; storeId'yi kosulsuz yazmak onu kapatir.
      whereClause.storeId = activeStoreId;
      if (activeClientId) whereClause.clientId = activeClientId;
      if (activeAgencyId) whereClause.agencyId = activeAgencyId;
    }

    const scopedProducts = await this.prisma.product.findMany({
      where: whereClause,
      select: {
        id: true,
        sku: true,
        status: true,
        agencyId: true,
        locationId: true,
        locationCode: true,
      },
    });

    // Hepsi ya da hicbiri. updateMany kapsam disi id'leri sessizce atlasaydi donen
    // updatedCount, bir id'nin baska bir kiracida var olup olmadigini soyleyen bir
    // oracle olurdu. 403, get()'in yanlis baglam icin verdigi cevapla ayni.
    if (scopedProducts.length !== productIds.length) {
      throw new ForbiddenException(
        'Access denied. One or more products belong to a different tenant context.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.product.updateMany({
        where: { id: { in: scopedProducts.map((product) => product.id) } },
        data: updateData,
      });

      for (const product of scopedProducts) {
        await this.writeAuditLog(
          tx,
          auditAction,
          product.id,
          userId,
          product.agencyId,
          ipAddress,
          auditChangesFor(product),
        );
      }

      return { success: true, updatedCount: result.count };
    });
  }
}

function decodeHtmlEntity(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
