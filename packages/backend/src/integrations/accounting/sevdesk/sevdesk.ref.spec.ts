import { BadRequestException } from '@nestjs/common';
import { createSevdeskRef, VALID_SEVDESK_OBJECT_NAMES } from './sevdesk.ref';

describe('SevdeskRef Helper (§5.3)', () => {
  it('creates valid ref envelope with number ID', () => {
    const ref = createSevdeskRef('Contact', 12345);
    expect(ref).toEqual({ id: 12345, objectName: 'Contact' });
  });

  it('creates valid ref envelope with string ID', () => {
    const ref = createSevdeskRef('Unity', '1');
    expect(ref).toEqual({ id: '1', objectName: 'Unity' });
  });

  it('creates valid ref for each allowed SevdeskObjectName', () => {
    for (const name of VALID_SEVDESK_OBJECT_NAMES) {
      const ref = createSevdeskRef(name as any, 1);
      expect(ref.objectName).toBe(name);
      expect(ref.id).toBe(1);
    }
  });

  it('throws BadRequestException for unallowed free-text objectName', () => {
    expect(() => createSevdeskRef('ArbitraryModel' as any, 123)).toThrow(BadRequestException);
    expect(() => createSevdeskRef('CustomObject' as any, 123)).toThrow(BadRequestException);
    expect(() => createSevdeskRef('' as any, 123)).toThrow(BadRequestException);
  });

  it('throws BadRequestException for null, undefined, or empty string ID', () => {
    expect(() => createSevdeskRef('Contact', null as any)).toThrow(BadRequestException);
    expect(() => createSevdeskRef('Contact', undefined as any)).toThrow(BadRequestException);
    expect(() => createSevdeskRef('Contact', '')).toThrow(BadRequestException);
    expect(() => createSevdeskRef('Contact', '   ')).toThrow(BadRequestException);
  });
});
