import { Test } from '@nestjs/testing';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import {
  JwtAuthGuard,
  OrganizationContextGuard,
  PermissionsGuard,
} from '@src/common/guards';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';

describe('LocationController', () => {
  let controller: LocationController;
  let service: jest.Mocked<LocationService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [LocationController],
      providers: [
        {
          provide: LocationService,
          useValue: {
            getLocations: jest.fn(),
            getLocationById: jest.fn(),
            createLocation: jest.fn(),
            updateLocation: jest.fn(),
            deleteLocation: jest.fn(),
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
          provide: PermissionsGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get(LocationController);
    service = module.get(LocationService);
  });

  it('lists locations', async () => {
    service.getLocations.mockResolvedValue({ data: [], totalCount: 0 } as any);

    const result = await controller.getLocations(
      { organizationId: 'org-1' } as any,
      { limit: 20 } as any,
    );

    expect(service.getLocations).toHaveBeenCalledWith('org-1', { limit: 20 });
    expect(result).toEqual({ data: [], totalCount: 0 });
  });

  it('fetches one location', async () => {
    service.getLocationById.mockResolvedValue({ id: 'loc-1' } as any);

    const result = await controller.getLocationById(
      { organizationId: 'org-1' } as any,
      'loc-1',
    );

    expect(service.getLocationById).toHaveBeenCalledWith('org-1', 'loc-1');
    expect(result).toEqual({ id: 'loc-1' });
  });

  it('creates a location', async () => {
    service.createLocation.mockResolvedValue({ id: 'loc-1' } as any);

    const body = { name: 'HQ' } as any;
    const result = await controller.createLocation(
      { organizationId: 'org-1' } as any,
      body,
    );

    expect(service.createLocation).toHaveBeenCalledWith('org-1', body);
    expect(result).toEqual({ id: 'loc-1' });
  });

  it('updates a location', async () => {
    service.updateLocation.mockResolvedValue({ id: 'loc-1' } as any);

    const body = { status: 'ARCHIVED' } as any;
    const result = await controller.updateLocation(
      { organizationId: 'org-1' } as any,
      'loc-1',
      body,
    );

    expect(service.updateLocation).toHaveBeenCalledWith('org-1', 'loc-1', body);
    expect(result).toEqual({ id: 'loc-1' });
  });

  it('deletes a location', async () => {
    service.deleteLocation.mockResolvedValue({ id: 'loc-1' } as any);

    const result = await controller.deleteLocation(
      { organizationId: 'org-1' } as any,
      'loc-1',
    );

    expect(service.deleteLocation).toHaveBeenCalledWith('org-1', 'loc-1');
    expect(result).toEqual({ id: 'loc-1' });
  });
});
