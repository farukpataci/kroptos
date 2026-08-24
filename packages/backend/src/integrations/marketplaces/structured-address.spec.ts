import { CicekSepetiMapper } from './ciceksepeti/CicekSepetiMapper';
import { HepsiburadaMapper } from './hepsiburada/HepsiburadaMapper';
import { IdefixMapper } from './idefix/IdefixMapper';
import { N11Mapper } from './n11/N11Mapper';
import { PazaramaMapper } from './pazarama/PazaramaMapper';
import { PttAvmMapper } from './pttavm/PttAvmMapper';

/**
 * The six Turkish marketplaces now carry the address apart, not only joined.
 *
 * They were all doing the same thing: taking a district the provider had sent
 * as its own field and folding it into one string with `join(', ')`. A courier
 * sorts on the district, so the parcel could not be routed from what survived.
 *
 * The free-text line is asserted alongside the parts on purpose — it is written
 * as well, not instead, and every consumer built so far reads it.
 */
describe('structured shipping address, six Turkish marketplaces', () => {
  const parts = (order: any) => ({
    fullName: order.shippingFullName,
    phone: order.shippingPhone,
    line1: order.shippingLine1,
    line2: order.shippingLine2,
    district: order.shippingDistrict,
    city: order.shippingCity,
    postalCode: order.shippingPostalCode,
    countryCode: order.shippingCountryCode,
  });

  it('CicekSepeti', () => {
    const order = CicekSepetiMapper.toUnifiedOrder({
      id: 1,
      orderCode: 'CS-1',
      receiverName: 'Ada Yilmaz',
      receiverPhone: '05551112233',
      address: 'Bahce sok. 3',
      city: 'Istanbul',
      district: 'Kadikoy',
      neighborhood: 'Caferaga Mah.',
      postalCode: '34710',
      status: 'Created',
      totalPrice: 100,
      currency: 'TRY',
      items: [],
    });

    expect(parts(order)).toEqual({
      fullName: 'Ada Yilmaz',
      phone: '05551112233',
      line1: 'Bahce sok. 3',
      line2: 'Caferaga Mah.',
      district: 'Kadikoy',
      city: 'Istanbul',
      postalCode: '34710',
      countryCode: 'TR',
    });
    expect(order.shippingAddress).toBe('Bahce sok. 3, Kadikoy, Istanbul');
  });

  it('Idefix', () => {
    const order = IdefixMapper.toUnifiedOrder({
      id: 'i-1',
      orderNumber: 'IDF-1',
      customerName: 'Ada Yilmaz',
      customerPhone: '05551112233',
      address: 'Bahce sok. 3',
      city: 'Istanbul',
      district: 'Kadikoy',
      neighborhood: 'Caferaga Mah.',
      postalCode: '34710',
      status: 'Created',
      totalPrice: 100,
      currency: 'TRY',
      items: [],
    });

    expect(parts(order)).toMatchObject({ district: 'Kadikoy', postalCode: '34710', countryCode: 'TR' });
    expect(order.shippingAddress).toBe('Bahce sok. 3, Kadikoy, Istanbul');
  });

  it('Pazarama', () => {
    const order = PazaramaMapper.toUnifiedOrder({
      id: 'p-1',
      orderNumber: 'PZR-1',
      customerName: 'Ada Yilmaz',
      customerPhone: '05551112233',
      address: 'Bahce sok. 3',
      city: 'Istanbul',
      district: 'Kadikoy',
      neighborhood: 'Caferaga Mah.',
      postalCode: '34710',
      status: 'New',
      totalPrice: 100,
      currency: 'TRY',
      items: [],
    });

    expect(parts(order)).toMatchObject({ district: 'Kadikoy', line2: 'Caferaga Mah.', countryCode: 'TR' });
  });

  it('PttAVM', () => {
    const order = PttAvmMapper.toUnifiedOrder({
      id: 'pt-1',
      orderNumber: 'PTT-1',
      customerName: 'Ada Yilmaz',
      customerPhone: '05551112233',
      address: 'Bahce sok. 3',
      city: 'Istanbul',
      district: 'Kadikoy',
      status: 'New',
      totalPrice: 100,
      currency: 'TRY',
      items: [],
    });

    expect(parts(order)).toMatchObject({ district: 'Kadikoy', city: 'Istanbul', countryCode: 'TR' });
    // Absent in the payload stays absent: nothing is parsed out of the line.
    expect(order.shippingPostalCode).toBeUndefined();
    expect(order.shippingLine2).toBeUndefined();
  });

  it('Hepsiburada maps town to the district, not to a second city', () => {
    const order = HepsiburadaMapper.toUnifiedOrder({
      id: 'h-1',
      orderNumber: 'HB-1',
      customer: { name: 'Ada Yilmaz', phone: '05551112233' },
      shippingAddress: {
        address: 'Bahce sok. 3',
        city: 'Istanbul',
        town: 'Kadikoy',
        postalCode: '34710',
      },
      items: [],
      status: 'created',
      totalAmount: 100,
      currency: 'TRY',
    });

    expect(order.shippingDistrict).toBe('Kadikoy');
    expect(order.shippingCity).toBe('Istanbul');
    expect(order.shippingPostalCode).toBe('34710');
    expect(order.shippingCountryCode).toBe('TR');
  });

  it('n11 keeps the neighbourhood apart from the district and rescues the postcode', () => {
    const order = N11Mapper.toUnifiedOrder({
      id: 1,
      orderNumber: 'N11-1',
      shipmentPackageStatus: 'Created',
      customerfullName: 'Ada Yilmaz',
      shippingAddress: {
        address: 'Bahce sok. 3',
        neighborhood: 'Caferaga Mah.',
        district: 'Kadikoy',
        city: 'Istanbul',
        postalCode: '34710',
        fullName: 'Ada Yilmaz',
        gsm: '05551112233',
      },
      lines: [],
      totalAmount: 100,
    } as any);

    expect(parts(order)).toMatchObject({
      line1: 'Bahce sok. 3',
      // Different levels; folding them together loses the one a courier sorts on.
      line2: 'Caferaga Mah.',
      district: 'Kadikoy',
      city: 'Istanbul',
      // n11 sent this all along and nothing read it.
      postalCode: '34710',
      countryCode: 'TR',
    });
  });

  it('leaves the parts undefined when the marketplace sends none', () => {
    const order = CicekSepetiMapper.toUnifiedOrder({
      id: 2,
      orderCode: 'CS-2',
      receiverName: 'Ada Yilmaz',
      address: 'Bahce sok. 3',
      city: 'Istanbul',
      district: '',
      status: 'Created',
      totalPrice: 100,
      currency: 'TRY',
      items: [],
    });

    // Empty rather than invented; the label request names it as missing.
    expect(order.shippingDistrict).toBe('');
    expect(order.shippingPostalCode).toBeUndefined();
    expect(order.shippingLine2).toBeUndefined();
  });
});
