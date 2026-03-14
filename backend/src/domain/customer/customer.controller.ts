import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Authorized,
  OrgProtected,
} from '@src/common/decorators/auth.decorator';
import { CustomerService } from './customer.service';
import { PaginationOptionsQueryParamDto } from '@src/common/dto/pagination.dto';
import {
  CreateCustomerDto,
  CustomerDto,
  GetCustomersResponseDto,
  UpdateCustomerDto,
} from './customer.dto';
import {
  type CurrentOrg,
  CurrentOrganization,
} from '@src/common/decorators/current-org.decorator';

@ApiTags('customers')
@Controller('customers')
@OrgProtected()
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @ApiOperation({ summary: 'Get customers' })
  @ApiOkResponse({ type: GetCustomersResponseDto })
  @Get()
  getCustomers(
    @CurrentOrganization() org: CurrentOrg,
    @Query() query: PaginationOptionsQueryParamDto,
  ) {
    return this.customerService.getCustomers({
      organizationId: org.organizationId,
      query,
    });
  }

  @ApiOperation({ summary: 'Get Individual Customer' })
  @ApiOkResponse({ type: CustomerDto })
  @Get(':id')
  getCustomerById(
    @CurrentOrganization() org: CurrentOrg,
    @Param('id') id: string,
  ): Promise<CustomerDto> {
    return this.customerService.getCustomerById({
      organizationId: org.organizationId,
      customerId: id,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create Individual Customer' })
  @ApiOkResponse({ type: CustomerDto })
  @Authorized('ADMIN', 'MANAGER')
  createCustomer(
    @Body() customerData: CreateCustomerDto,
    @CurrentOrganization() org: CurrentOrg,
  ) {
    return this.customerService.createCustomer({
      organizationId: org.organizationId,
      customerData,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Individual Customer' })
  @ApiOkResponse({ type: CustomerDto })
  @Authorized('ADMIN', 'MANAGER')
  updateCustomer(
    @Param('id') id: string,
    @Body() customerData: UpdateCustomerDto,
    @CurrentOrganization() org: CurrentOrg,
  ) {
    return this.customerService.updateCustomer({
      organizationId: org.organizationId,
      customerId: id,
      customerData,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Individual Customer' })
  @ApiOkResponse({ type: CustomerDto })
  @Authorized('ADMIN')
  deleteCustomer(
    @Param('id') id: string,
    @Request() @CurrentOrganization() org: CurrentOrg,
  ) {
    return this.customerService.deleteCustomer({
      organizationId: org.organizationId,
      customerId: id,
    });
  }
}
