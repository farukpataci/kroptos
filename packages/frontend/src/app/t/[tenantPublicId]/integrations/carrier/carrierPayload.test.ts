import { CREDENTIAL_MASK } from '@kroptos/shared';
import { carrierPayload, CarrierFormState } from './carrierPayload';

const form = (over: Partial<CarrierFormState> = {}): CarrierFormState => ({
  provider: 'MOCK',
  displayName: 'Depo bağlantısı',
  credentials: { username: 'depo', password: 'gercek-sifre' },
  isActive: true,
  isTestMode: true,
  senderAddress: {
    fullName: 'Kroptos Depo',
    phone: '02120000000',
    line1: 'Depo cad. 1',
    line2: '',
    district: 'Tuzla',
    city: 'İstanbul',
    postalCode: '',
    countryCode: 'TR',
  },
  settings: { labelFormat: 'PDF', desiDivisor: '3000', cutoffTime: '', defaultServiceLevel: '' },
  ...over,
});

describe('carrierPayload', () => {
  it('never sends a masked secret back', () => {
    const body = carrierPayload(
      form({ credentials: { username: 'depo', password: CREDENTIAL_MASK } }),
      'update',
    );

    // Sent through, this would replace a live credential with bullets.
    expect(body.credentials).toEqual({ username: 'depo' });
    expect(JSON.stringify(body)).not.toContain(CREDENTIAL_MASK);
  });

  it('never sends a secret the user left blank', () => {
    const body = carrierPayload(form({ credentials: { username: 'depo', password: '' } }), 'update');

    expect(body.credentials).toEqual({ username: 'depo' });
  });

  it('omits credentials entirely when nothing was retyped', () => {
    const body = carrierPayload(form({ credentials: { password: CREDENTIAL_MASK } }), 'update');

    expect(body).not.toHaveProperty('credentials');
  });

  it('sends the provider on create and never on update', () => {
    expect(carrierPayload(form(), 'create').provider).toBe('MOCK');
    expect(carrierPayload(form(), 'update')).not.toHaveProperty('provider');
  });

  it('drops a half-filled sender address instead of saving a broken one', () => {
    const body = carrierPayload(
      form({ senderAddress: { fullName: 'Depo', phone: '', line1: '', district: '', city: '', countryCode: 'TR' } }),
      'update',
    );

    expect(body).not.toHaveProperty('senderAddress');
  });

  it('keeps the optional address fields only when filled', () => {
    const complete = carrierPayload(form(), 'update').senderAddress as Record<string, string>;
    expect(complete).not.toHaveProperty('line2');
    expect(complete).not.toHaveProperty('postalCode');
    expect(complete.city).toBe('İstanbul');
  });

  it('refuses a desi divisor of zero rather than dividing by it', () => {
    const body = carrierPayload(
      form({ settings: { labelFormat: '', desiDivisor: '0', cutoffTime: '', defaultServiceLevel: '' } }),
      'update',
    );

    expect(body).not.toHaveProperty('settings');
  });

  it('sends the settings that are set', () => {
    const body = carrierPayload(
      form({
        settings: {
          labelFormat: 'ZPL',
          desiDivisor: '5000',
          cutoffTime: '17:00',
          defaultServiceLevel: 'express',
        },
      }),
      'update',
    );

    expect(body.settings).toEqual({
      labelFormat: 'ZPL',
      desiDivisor: 5000,
      cutoffTime: '17:00',
      defaultServiceLevel: 'express',
    });
  });
});
