import { Test } from '@nestjs/testing';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import {
  OrganizationContextGuard,
  JwtAuthGuard,
  RolesGuard,
} from '@src/common/guards';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import type { RequestWithUser } from '@src/domain/auth/strategies/jwt.strategy';

describe('CustomerController', () => {
  let controller: CustomerController;
  let service: jest.Mocked<CustomerService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [CustomerController],
      providers: [
        {
          provide: CustomerService,
          useValue: {
            getCustomers: jest.fn(),
            getCustomerById: jest.fn(),
            createCustomer: jest.fn(),
            updateCustomer: jest.fn(),
            deleteCustomer: jest.fn(),
          },
        },
        {
          provide: OrganizationContextGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        {
          provide: JwtAuthGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        {
          provide: RolesGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get(CustomerController);
    service = module.get(CustomerService);
  });

  describe('getCustomers', () => {
    const req = {
      organization: { organizationId: 'org-1' },
    } as unknown as RequestWithUser;

    it('calls service with organizationId and query', async () => {
      const query = { limit: 10, cursor: undefined };
      const result = { data: [], totalCount: 0 };
      service.getCustomers.mockResolvedValue(result);

      const res = await controller.getCustomers(req, query);
      expect(service.getCustomers).toHaveBeenCalledWith({
        organizationId: 'org-1',
        query,
      });
      expect(res).toBe(result);
    });

    it('throws when organization is missing on request', () => {
      const badReq = {} as RequestWithUser;
      expect(() => controller.getCustomers(badReq, {} as any)).toThrow(
        'Organization context is missing',
      );
    });
  });

  describe('getCustomerById', () => {
    const req = {
      organization: { organizationId: 'org-1' },
    } as unknown as RequestWithUser;

    it('calls service with ids', async () => {
      const result = { id: 'c1' } as any;
      service.getCustomerById.mockResolvedValue(result);

      const res = await controller.getCustomerById(req, 'c1');
      expect(service.getCustomerById).toHaveBeenCalledWith({
        organizationId: 'org-1',
        customerId: 'c1',
      });
      expect(res).toBe(result);
    });

    it('throws when organization missing', () => {
      const badReq = {} as RequestWithUser;
      expect(() => controller.getCustomerById(badReq, 'c1')).toThrow(
        'Organization context is missing',
      );
    });
  });

  describe('createCustomer', () => {
    const req = {
      organization: { organizationId: 'org-1' },
    } as unknown as RequestWithUser;

    it('calls service with organizationId and body', async () => {
      const body = {
        name: 'Jane',
        email: 'jane@doe.com',
        phone: null,
        internalNote: null,
      } as any;
      const result = { id: 'c-new' } as any;
      service.createCustomer.mockResolvedValue(result);

      const res = await controller.createCustomer(body, req);
      expect(service.createCustomer).toHaveBeenCalledWith({
        organizationId: 'org-1',
        customerData: body,
      });
      expect(res).toBe(result);
    });

    it('throws when organization missing', () => {
      const badReq = {} as RequestWithUser;
      expect(() => controller.createCustomer({} as any, badReq)).toThrow(
        'Organization context is missing',
      );
    });
  });

  describe('updateCustomer', () => {
    const req = {
      organization: { organizationId: 'org-1' },
    } as unknown as RequestWithUser;

    it('calls service with ids and body', async () => {
      const body = { name: 'Updated' } as any;
      const result = { id: 'c1', name: 'Updated' } as any;
      service.updateCustomer.mockResolvedValue(result);

      const res = await controller.updateCustomer('c1', body, req);
      expect(service.updateCustomer).toHaveBeenCalledWith({
        organizationId: 'org-1',
        customerId: 'c1',
        customerData: body,
      });
      expect(res).toBe(result);
    });

    it('throws when organization missing', () => {
      const badReq = {} as RequestWithUser;
      expect(() => controller.updateCustomer('c1', {} as any, badReq)).toThrow(
        'Organization context is missing',
      );
    });
  });

  describe('deleteCustomer', () => {
    const req = {
      organization: { organizationId: 'org-1' },
    } as unknown as RequestWithUser;

    it('calls service with ids', async () => {
      const result = { id: 'c1' } as any;
      service.deleteCustomer.mockResolvedValue(result);

      const res = await controller.deleteCustomer('c1', req);
      expect(service.deleteCustomer).toHaveBeenCalledWith({
        organizationId: 'org-1',
        customerId: 'c1',
      });
      expect(res).toBe(result);
    });

    it('throws when organization missing', () => {
      const badReq = {} as RequestWithUser;
      expect(() => controller.deleteCustomer('c1', badReq)).toThrow(
        'Organization context is missing',
      );
    });
  });
});
