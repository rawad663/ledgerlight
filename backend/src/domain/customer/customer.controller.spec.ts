import { Test } from '@nestjs/testing';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import {
  OrganizationContextGuard,
  JwtAuthGuard,
  RolesGuard,
} from '@src/common/guards';
import { PrismaService } from '@src/infra/prisma/prisma.service';

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
    const organization = { organizationId: 'org-1', role: 'ADMIN' };

    it('calls service with organizationId and query', async () => {
      const query = { limit: 10, cursor: undefined };
      const result = { data: [], totalCount: 0 };
      service.getCustomers.mockResolvedValue(result);

      const res = await controller.getCustomers(organization, query);
      expect(service.getCustomers).toHaveBeenCalledWith({
        organizationId: 'org-1',
        query,
      });
      expect(res).toBe(result);
    });
  });

  describe('getCustomerById', () => {
    const organization = { organizationId: 'org-1', role: 'ADMIN' };

    it('calls service with ids', async () => {
      const result = { id: 'c1' } as any;
      service.getCustomerById.mockResolvedValue(result);

      const res = await controller.getCustomerById(organization, 'c1');
      expect(service.getCustomerById).toHaveBeenCalledWith({
        organizationId: 'org-1',
        customerId: 'c1',
      });
      expect(res).toBe(result);
    });
  });

  describe('createCustomer', () => {
    const organization = { organizationId: 'org-1', role: 'ADMIN' };

    it('calls service with organizationId and body', async () => {
      const body = {
        name: 'Jane',
        email: 'jane@doe.com',
        phone: null,
        internalNote: null,
      } as any;
      const result = { id: 'c-new' } as any;
      service.createCustomer.mockResolvedValue(result);

      const res = await controller.createCustomer(body, organization);
      expect(service.createCustomer).toHaveBeenCalledWith({
        organizationId: 'org-1',
        customerData: body,
      });
      expect(res).toBe(result);
    });
  });

  describe('updateCustomer', () => {
    const organization = { organizationId: 'org-1', role: 'ADMIN' };

    it('calls service with ids and body', async () => {
      const body = { name: 'Updated' } as any;
      const result = { id: 'c1', name: 'Updated' } as any;
      service.updateCustomer.mockResolvedValue(result);

      const res = await controller.updateCustomer('c1', body, organization);
      expect(service.updateCustomer).toHaveBeenCalledWith({
        organizationId: 'org-1',
        customerId: 'c1',
        customerData: body,
      });
      expect(res).toBe(result);
    });
  });

  describe('deleteCustomer', () => {
    const organization = { organizationId: 'org-1', role: 'ADMIN' };

    it('calls service with ids', async () => {
      const result = { id: 'c1' } as any;
      service.deleteCustomer.mockResolvedValue(result);

      const res = await controller.deleteCustomer('c1', organization);
      expect(service.deleteCustomer).toHaveBeenCalledWith({
        organizationId: 'org-1',
        customerId: 'c1',
      });
      expect(res).toBe(result);
    });
  });
});
