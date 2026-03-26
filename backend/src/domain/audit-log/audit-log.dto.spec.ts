import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AuditLogDto,
  GetAuditLogsQueryDto,
  GetAuditLogsResponseDto,
} from './audit-log.dto';
import { AuditAction, AuditEntityType } from '@prisma/generated/enums';

const uuid = 'a5b2b7f0-ec1b-4a0a-9e08-7e2dd6e7d5a0';
const uuid2 = '0b5f7ae8-5835-4ef4-bfb7-7d1b2d8d9d1a';

describe('AuditLogDto', () => {
  const valid = {
    id: uuid,
    organizationId: uuid2,
    actorUserId: uuid,
    entityType: AuditEntityType.ORDER,
    entityId: uuid,
    action: AuditAction.CREATE,
    createdAt: new Date(),
    actor: {
      id: uuid,
      firstName: 'John',
      lastName: 'Doe',
      email: 'j@test.com',
    },
  };

  it('accepts a valid audit log', async () => {
    const dto = plainToInstance(AuditLogDto, valid);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts null optional fields', async () => {
    const dto = plainToInstance(AuditLogDto, {
      ...valid,
      actorUserId: null,
      beforeJson: null,
      afterJson: null,
      requestId: null,
      ip: null,
      userAgent: null,
      actor: null,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid entityType', async () => {
    const dto = plainToInstance(AuditLogDto, {
      ...valid,
      entityType: 'INVALID',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid action', async () => {
    const dto = plainToInstance(AuditLogDto, {
      ...valid,
      action: 'INVALID',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('GetAuditLogsQueryDto', () => {
  it('accepts empty object with defaults', async () => {
    const dto = plainToInstance(GetAuditLogsQueryDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts valid entityType filter', async () => {
    const dto = plainToInstance(GetAuditLogsQueryDto, {
      entityType: AuditEntityType.ORDER,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts entityId filter', async () => {
    const dto = plainToInstance(GetAuditLogsQueryDto, {
      entityId: uuid,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid entityType', async () => {
    const dto = plainToInstance(GetAuditLogsQueryDto, {
      entityType: 'INVALID',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('GetAuditLogsResponseDto', () => {
  it('validates paginated response', async () => {
    const payload = {
      data: [
        {
          id: uuid,
          organizationId: uuid2,
          entityType: AuditEntityType.ORDER,
          entityId: uuid,
          action: AuditAction.CREATE,
          createdAt: new Date(),
        },
      ],
      totalCount: 1,
    };
    const dto = plainToInstance(GetAuditLogsResponseDto, payload);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
