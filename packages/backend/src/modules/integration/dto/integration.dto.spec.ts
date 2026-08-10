import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { INTEGRATION_STATUSES } from '@kroptos/shared';
import { UpdateIntegrationDto } from './integration.dto';

/**
 * `status` used to be an unvalidated string, so PATCH wrote whatever the client
 * sent straight into the column — the way a value no consumer has styling for
 * reaches the UI.
 */
describe('UpdateIntegrationDto.status', () => {
  const validateStatus = async (status: unknown) => {
    const dto = plainToInstance(UpdateIntegrationDto, { status });
    const errors = await validate(dto);
    return errors.filter((e) => e.property === 'status');
  };

  it.each(INTEGRATION_STATUSES)('accepts the canonical status %s', async (status) => {
    expect(await validateStatus(status)).toHaveLength(0);
  });

  it('rejects a status outside the canonical set', async () => {
    const errors = await validateStatus('banana');
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isIn');
  });

  it('rejects pending, which nothing in the codebase persists', async () => {
    expect(await validateStatus('pending')).toHaveLength(1);
  });

  it('still allows status to be omitted entirely', async () => {
    const dto = plainToInstance(UpdateIntegrationDto, { name: 'Renamed only' });
    expect(await validate(dto)).toHaveLength(0);
  });
});
