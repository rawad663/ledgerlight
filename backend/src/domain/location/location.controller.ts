import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrgProtected } from '@src/common/decorators/auth.decorator';
import { RequirePermissions } from '@src/common/decorators/permissions.decorator';
import { Permission } from '@src/common/permissions';
import {
  CurrentOrganization,
  type CurrentOrg,
} from '@src/common/decorators/current-org.decorator';
import {
  ApiDoc,
  appendToPaginationQuery,
} from '@src/common/swagger/api-doc.decorator';
import { toOrganizationScopeInput } from '@src/common/organization/location-scope';
import {
  CreateLocationDto,
  GetLocationsQueryDto,
  GetLocationsResponseDto,
  LocationDto,
  UpdateLocationDto,
} from './location.dto';
import { LocationService } from './location.service';

@ApiTags('locations')
@Controller('locations')
@OrgProtected()
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get()
  @RequirePermissions(Permission.LOCATIONS_READ)
  @ApiDoc({
    summary: 'Get locations',
    description: 'List locations for the active organization with pagination.',
    ok: GetLocationsResponseDto,
    queries: appendToPaginationQuery([
      {
        name: 'search',
        description: 'Search by name, code, address, or city',
        type: String,
      },
      {
        name: 'status',
        description: 'Filter by location status',
        type: String,
      },
      {
        name: 'type',
        description: 'Filter by location type',
        type: String,
      },
    ]),
  })
  getLocations(
    @CurrentOrganization() org: CurrentOrg,
    @Query() query: GetLocationsQueryDto,
  ) {
    return this.locationService.getLocations(
      toOrganizationScopeInput(org),
      query,
    );
  }

  @Get(':id')
  @RequirePermissions(Permission.LOCATIONS_READ)
  @ApiDoc({
    summary: 'Get location by ID',
    ok: LocationDto,
    notFoundDesc: 'Location not found',
    params: [{ name: 'id', description: 'Location ID', type: String }],
  })
  getLocationById(
    @CurrentOrganization() org: CurrentOrg,
    @Param('id') id: string,
  ) {
    return this.locationService.getLocationById(
      toOrganizationScopeInput(org),
      id,
    );
  }

  @Post()
  @RequirePermissions(Permission.LOCATIONS_CREATE)
  @ApiDoc({
    summary: 'Create location',
    body: CreateLocationDto,
    created: LocationDto,
    conflictDesc: 'Duplicate location name or code',
  })
  createLocation(
    @CurrentOrganization() org: CurrentOrg,
    @Body() locationData: CreateLocationDto,
  ) {
    return this.locationService.createLocation(
      toOrganizationScopeInput(org),
      locationData,
    );
  }

  @Patch(':id')
  @RequirePermissions(Permission.LOCATIONS_UPDATE)
  @ApiDoc({
    summary: 'Update location',
    body: UpdateLocationDto,
    ok: LocationDto,
    badRequestDesc: 'Cannot archive a location with inventory on hand',
    notFoundDesc: 'Location not found',
    params: [{ name: 'id', description: 'Location ID', type: String }],
  })
  updateLocation(
    @CurrentOrganization() org: CurrentOrg,
    @Param('id') id: string,
    @Body() locationData: UpdateLocationDto,
  ) {
    return this.locationService.updateLocation(
      toOrganizationScopeInput(org),
      id,
      locationData,
    );
  }

  @Delete(':id')
  @RequirePermissions(Permission.LOCATIONS_ARCHIVE)
  @ApiDoc({
    summary: 'Delete location',
    ok: LocationDto,
    conflictDesc:
      'Cannot delete the only location in an organization, a location with inventory on hand, or a location with history',
    notFoundDesc: 'Location not found',
    params: [{ name: 'id', description: 'Location ID', type: String }],
  })
  deleteLocation(
    @CurrentOrganization() org: CurrentOrg,
    @Param('id') id: string,
  ) {
    return this.locationService.deleteLocation(
      toOrganizationScopeInput(org),
      id,
    );
  }
}
