import * as ExcelJS from 'exceljs';
import { EXPORT_COLUMNS } from '../../order-export/columns/column-registry';

export class ImportTemplateGenerator {
  /**
   * Generate sample template workbook with sample data and guide sheet
   */
  static async generateWorkbook(rowMode: 'ORDER' | 'LINE_ITEM' = 'LINE_ITEM'): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'KroptOS E-Commerce';
    workbook.created = new Date();

    // Select relevant columns based on rowMode
    const columns = EXPORT_COLUMNS.filter((c) => c.rowModes.includes(rowMode));

    // Sheet 1: Siparişler
    const sheet1 = workbook.addWorksheet('Siparişler', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet1.columns = columns.map((col) => ({
      header: col.label,
      key: col.key,
      width: Math.max(col.label.length + 4, 16),
    }));

    // Style header row
    const headerRow = sheet1.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Slate 800
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 24;

    // Sample Data
    if (rowMode === 'LINE_ITEM') {
      sheet1.addRow({
        orderNumber: 'SIP-2026-001',
        publicId: '',
        orderDate: '21.09.2026 14:30',
        status: 'pending',
        paymentStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
        source: 'manual',
        currency: 'TRY',
        totalAmount: 1250.0,
        notes: 'Hediye paketi rica olunur',
        tags: 'yeni,vip',
        priority: 'normal',
        isHold: 'Hayır',
        customerName: 'Ahmet Yılmaz',
        customerEmail: 'ahmet.yilmaz@example.com',
        customerPhone: '+905551234567',
        shippingLine1: 'Bağdat Caddesi No:123 D:4',
        shippingDistrict: 'Kadıköy',
        shippingCity: 'İstanbul',
        shippingPostalCode: '34710',
        shippingCountryCode: 'TR',
        carrierName: 'Aras Kargo',
        trackingNumber: '',
        totalDesi: 2.5,
        itemName: 'Kablosuz Kulaklık Siyah',
        itemSku: 'KULAK-001-BLK',
        itemBarcode: '8680001234567',
        itemQuantity: 1,
        itemUnitPrice: 750.0,
        itemTaxRate: 20,
        itemDiscount: 0,
        itemTotal: 750.0,
        invoiceNumber: '',
        shippingFee: 50.0,
        paymentMethod: 'Kredi Kartı',
        marketplaceOrderNumber: '',
      });

      sheet1.addRow({
        orderNumber: 'SIP-2026-001',
        publicId: '',
        orderDate: '21.09.2026 14:30',
        status: 'pending',
        paymentStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
        source: 'manual',
        currency: 'TRY',
        totalAmount: 1250.0,
        notes: 'Hediye paketi rica olunur',
        tags: 'yeni,vip',
        priority: 'normal',
        isHold: 'Hayır',
        customerName: 'Ahmet Yılmaz',
        customerEmail: 'ahmet.yilmaz@example.com',
        customerPhone: '+905551234567',
        shippingLine1: 'Bağdat Caddesi No:123 D:4',
        shippingDistrict: 'Kadıköy',
        shippingCity: 'İstanbul',
        shippingPostalCode: '34710',
        shippingCountryCode: 'TR',
        carrierName: 'Aras Kargo',
        trackingNumber: '',
        totalDesi: 2.5,
        itemName: 'Kulaklık Koruma Kılıfı',
        itemSku: 'KILIF-002-GRY',
        itemBarcode: '8680007654321',
        itemQuantity: 1,
        itemUnitPrice: 450.0,
        itemTaxRate: 20,
        itemDiscount: 0,
        itemTotal: 450.0,
        invoiceNumber: '',
        shippingFee: 50.0,
        paymentMethod: 'Kredi Kartı',
        marketplaceOrderNumber: '',
      });

      sheet1.addRow({
        orderNumber: 'SIP-2026-002',
        publicId: '',
        orderDate: '21.09.2026 15:15',
        status: 'shipped',
        paymentStatus: 'paid',
        fulfillmentStatus: 'fulfilled',
        source: 'trendyol',
        currency: 'TRY',
        totalAmount: 980.0,
        notes: '',
        tags: '',
        priority: 'high',
        isHold: 'Hayır',
        customerName: 'Ayşe Demir',
        customerEmail: 'ayse.demir@example.com',
        customerPhone: '+905329876543',
        shippingLine1: 'Atatürk Bulvarı No:45',
        shippingDistrict: 'Çankaya',
        shippingCity: 'Ankara',
        shippingPostalCode: '06690',
        shippingCountryCode: 'TR',
        carrierName: 'Yurtiçi Kargo',
        trackingNumber: 'YK123456789TR',
        totalDesi: 1.0,
        itemName: 'Deri Cüzdan Kahverengi',
        itemSku: 'CUZ-003-BRW',
        itemBarcode: '8680009988776',
        itemQuantity: 1,
        itemUnitPrice: 980.0,
        itemTaxRate: 20,
        itemDiscount: 0,
        itemTotal: 980.0,
        invoiceNumber: 'GIB2026000001234',
        shippingFee: 0,
        paymentMethod: 'Kredi Kartı',
        marketplaceOrderNumber: 'TY-987654321',
      });
    } else {
      // ORDER mode (one row per order, itemsSummary column)
      sheet1.addRow({
        orderNumber: 'SIP-2026-001',
        publicId: '',
        orderDate: '21.09.2026 14:30',
        status: 'pending',
        paymentStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
        source: 'manual',
        currency: 'TRY',
        totalAmount: 1250.0,
        notes: 'Hediye paketi rica olunur',
        tags: 'yeni,vip',
        priority: 'normal',
        isHold: 'Hayır',
        customerName: 'Ahmet Yılmaz',
        customerEmail: 'ahmet.yilmaz@example.com',
        customerPhone: '+905551234567',
        shippingLine1: 'Bağdat Caddesi No:123 D:4',
        shippingDistrict: 'Kadıköy',
        shippingCity: 'İstanbul',
        shippingPostalCode: '34710',
        shippingCountryCode: 'TR',
        carrierName: 'Aras Kargo',
        trackingNumber: '',
        totalDesi: 2.5,
        itemsSummary: 'KULAK-001-BLK x1; KILIF-002-GRY x1',
        itemCount: 2,
        invoiceNumber: '',
        shippingFee: 50.0,
        paymentMethod: 'Kredi Kartı',
        marketplaceOrderNumber: '',
      });

      sheet1.addRow({
        orderNumber: 'SIP-2026-002',
        publicId: '',
        orderDate: '21.09.2026 15:15',
        status: 'shipped',
        paymentStatus: 'paid',
        fulfillmentStatus: 'fulfilled',
        source: 'trendyol',
        currency: 'TRY',
        totalAmount: 980.0,
        notes: '',
        tags: '',
        priority: 'high',
        isHold: 'Hayır',
        customerName: 'Ayşe Demir',
        customerEmail: 'ayse.demir@example.com',
        customerPhone: '+905329876543',
        shippingLine1: 'Atatürk Bulvarı No:45',
        shippingDistrict: 'Çankaya',
        shippingCity: 'Ankara',
        shippingPostalCode: '06690',
        shippingCountryCode: 'TR',
        carrierName: 'Yurtiçi Kargo',
        trackingNumber: 'YK123456789TR',
        totalDesi: 1.0,
        itemsSummary: 'CUZ-003-BRW x1',
        itemCount: 1,
        invoiceNumber: 'GIB2026000001234',
        shippingFee: 0,
        paymentMethod: 'Kredi Kartı',
        marketplaceOrderNumber: 'TY-987654321',
      });
    }

    // Sheet 2: Açıklamalar (Field Guide)
    const sheet2 = workbook.addWorksheet('Açıklamalar');
    sheet2.columns = [
      { header: 'Kolon Adı', key: 'label', width: 28 },
      { header: 'Sistem Anahtarı', key: 'key', width: 24 },
      { header: 'Zorunlu mu?', key: 'required', width: 16 },
      { header: 'Veri Tipi', key: 'type', width: 16 },
      { header: 'Kabul Edilen Format / Değerler', key: 'format', width: 45 },
      { header: 'Örnek', key: 'example', width: 30 },
    ];

    const guideHeader = sheet2.getRow(1);
    guideHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    guideHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0284C7' }, // Sky 600
    };
    guideHeader.height = 24;

    const descriptions: Record<string, { required: string; format: string; example: string }> = {
      orderNumber: { required: 'Opsiyonel (Oluşturma) / Zorunlu (Güncelleme)', format: 'Metin', example: 'SIP-2026-001' },
      marketplaceOrderNumber: { required: 'Opsiyonel', format: 'Metin (Pazaryeri sipariş no)', example: 'TY-123456789' },
      orderDate: { required: 'Önerilen', format: 'dd.MM.yyyy HH:mm veya yyyy-MM-dd', example: '21.09.2026 14:30' },
      status: { required: 'Önerilen (Varsayılan: pending)', format: 'pending, processing, shipped, delivered, cancelled', example: 'pending' },
      paymentStatus: { required: 'Önerilen (Varsayılan: pending)', format: 'pending, paid, failed, refunded', example: 'paid' },
      fulfillmentStatus: { required: 'Opsiyonel', format: 'unfulfilled, partially_fulfilled, fulfilled', example: 'unfulfilled' },
      source: { required: 'Opsiyonel (Varsayılan: manual)', format: 'manual, trendyol, hepsiburada, shopify...', example: 'manual' },
      currency: { required: 'Opsiyonel (Varsayılan: TRY)', format: 'TRY, USD, EUR...', example: 'TRY' },
      totalAmount: { required: 'Önerilen', format: 'Sayı / Para (1250,50 veya 1250.50)', example: '1250.00' },
      customerName: { required: 'Zorunlu (Yeni siparişte)', format: 'Metin (Ad Soyad)', example: 'Ahmet Yılmaz' },
      customerEmail: { required: 'Önerilen', format: 'Geçerli e-posta adresi', example: 'ahmet@example.com' },
      customerPhone: { required: 'Önerilen', format: 'Telefon (+905551234567)', example: '+905551234567' },
      shippingLine1: { required: 'Zorunlu (Yeni siparişte)', format: 'Açık adres metni', example: 'Bağdat Cad. No:12' },
      shippingDistrict: { required: 'Önerilen', format: 'İlçe metni', example: 'Kadıköy' },
      shippingCity: { required: 'Zorunlu (Yeni siparişte)', format: 'İl / Şehir metni', example: 'İstanbul' },
      carrierName: { required: 'Opsiyonel', format: 'Kargo firması adı', example: 'Aras Kargo' },
      trackingNumber: { required: 'Opsiyonel (Kargo güncellemede)', format: 'Kargo takip no', example: '123456789012' },
      itemSku: { required: 'Zorunlu (Kalem modunda)', format: 'Ürün Stok Kodu (SKU)', example: 'KULAK-001-BLK' },
      itemBarcode: { required: 'Opsiyonel', format: 'Barkod / EAN / GTIN', example: '8680001234567' },
      itemName: { required: 'Önerilen', format: 'Ürün Adı', example: 'Kablosuz Kulaklık' },
      itemQuantity: { required: 'Zorunlu (Varsayılan: 1)', format: 'Pozitif tam sayı', example: '1' },
      itemUnitPrice: { required: 'Zorunlu', format: 'Birim Fiyat (KDV Dahil/Hariç)', example: '750.00' },
    };

    for (const col of columns) {
      const desc = descriptions[col.key] || {
        required: 'Opsiyonel',
        format: col.type === 'money' || col.type === 'number' ? 'Sayı' : col.type === 'date' ? 'Tarih' : 'Metin',
        example: '',
      };
      sheet2.addRow({
        label: col.label,
        key: col.key,
        required: desc.required,
        type: col.type,
        format: desc.format,
        example: desc.example,
      });
    }

    return workbook;
  }

  /**
   * Generate CSV content with BOM and headers
   */
  static async generateCsv(rowMode: 'ORDER' | 'LINE_ITEM' = 'LINE_ITEM'): Promise<string> {
    const workbook = await this.generateWorkbook(rowMode);
    const sheet = workbook.getWorksheet('Siparişler')!;

    const lines: string[] = [];
    sheet.eachRow((row) => {
      const values: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        let val = cell.value;
        if (val === null || val === undefined) val = '';
        if (typeof val === 'object' && 'text' in (val as any)) val = (val as any).text;
        let str = String(val).replace(/"/g, '""');
        if (str.includes(';') || str.includes('\n') || str.includes('"')) {
          str = `"${str}"`;
        }
        values.push(str);
      });
      lines.push(values.join(';'));
    });

    // UTF-8 BOM
    return '\ufeff' + lines.join('\r\n');
  }
}
