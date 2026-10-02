import { buildEmailProvider, buildSmsProvider } from './providers';

describe('bildirim sağlayıcısı — NOTIFICATIONS_DELIVERY', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  const smtp = { host: 'smtp.example.com', port: 587, fromEmail: 'a@example.com' };

  it('staging varsayılanı: smtp ve netgsm yerine console', () => {
    process.env.APP_ENV = 'staging';
    delete process.env.NOTIFICATIONS_DELIVERY;
    expect(buildEmailProvider('smtp', smtp, {}).name).toBe('console');
    expect(buildSmsProvider('netgsm', {}, {}).name).toBe('console');
  });

  it('production: gerçek sağlayıcı', () => {
    process.env.APP_ENV = 'production';
    delete process.env.NOTIFICATIONS_DELIVERY;
    expect(buildEmailProvider('smtp', smtp, {}).name).toBe('smtp');
    expect(buildSmsProvider('netgsm', {}, {}).name).toBe('netgsm');
  });

  it('staging\'de açıkça send verilirse gerçek sağlayıcı', () => {
    process.env.APP_ENV = 'staging';
    process.env.NOTIFICATIONS_DELIVERY = 'send';
    expect(buildEmailProvider('smtp', smtp, {}).name).toBe('smtp');
  });

  it('bilinmeyen sağlayıcı adı kapalıyken de hata verir', () => {
    process.env.APP_ENV = 'staging';
    expect(() => buildEmailProvider('ses', {}, {})).toThrow(/Unknown e-mail provider/);
  });
});
