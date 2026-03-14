import { Test } from '@nestjs/testing';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import {
  OrganizationContextGuard,
  JwtAuthGuard,
  RolesGuard,
} from '@src/common/guards';
import { PrismaService } from '@src/infra/prisma/prisma.service';

describe('ProductController', () => {
  let controller: ProductController;
  let service: jest.Mocked<ProductService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        {
          provide: ProductService,
          useValue: {
            getProducts: jest.fn(),
            getProductById: jest.fn(),
            createProduct: jest.fn(),
            updateProduct: jest.fn(),
            deleteProduct: jest.fn(),
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

    controller = module.get(ProductController);
    service = module.get(ProductService);
  });

  describe('getProducts', () => {
    const organization = { organizationId: 'org-1', role: 'ADMIN' } as any;

    it('calls service with organizationId and query', async () => {
      const query = { limit: 10, cursor: undefined } as any;
      const result = { data: [], totalCount: 0 } as any;
      service.getProducts.mockResolvedValue(result);

      const res = await controller.getProducts(organization, query);
      expect(service.getProducts).toHaveBeenCalledWith('org-1', query);
      expect(res).toBe(result);
    });
  });

  describe('getProductById', () => {
    const organization = { organizationId: 'org-1', role: 'ADMIN' } as any;

    it('calls service with ids', async () => {
      const result = { id: 'p1' } as any;
      service.getProductById.mockResolvedValue(result);

      const res = await controller.getProductById(organization, 'p1');
      expect(service.getProductById).toHaveBeenCalledWith('org-1', 'p1');
      expect(res).toBe(result);
    });
  });

  describe('createProduct', () => {
    const organization = { organizationId: 'org-1', role: 'ADMIN' } as any;

    it('calls service with organizationId and body', async () => {
      const body = {
        name: 'Widget',
        sku: 'WID-001',
        priceCents: 1000,
      } as any;
      const result = { id: 'p-new' } as any;
      service.createProduct.mockResolvedValue(result);

      const res = await controller.createProduct(body, organization);
      expect(service.createProduct).toHaveBeenCalledWith('org-1', body);
      expect(res).toBe(result);
    });
  });

  describe('updateProduct', () => {
    const organization = { organizationId: 'org-1', role: 'ADMIN' } as any;

    it('calls service with ids and body', async () => {
      const body = { name: 'Updated' } as any;
      const result = { id: 'p1', name: 'Updated' } as any;
      service.updateProduct.mockResolvedValue(result);

      const res = await controller.updateProduct('p1', organization, body);
      expect(service.updateProduct).toHaveBeenCalledWith('org-1', 'p1', body);
      expect(res).toBe(result);
    });
  });

  describe('deleteProduct', () => {
    const organization = { organizationId: 'org-1', role: 'ADMIN' } as any;

    it('calls service with ids', async () => {
      const result = { id: 'p1' } as any;
      service.deleteProduct.mockResolvedValue(result);

      const res = await controller.deleteProduct('p1', organization);
      expect(service.deleteProduct).toHaveBeenCalledWith('org-1', 'p1');
      expect(res).toBe(result);
    });
  });
});
