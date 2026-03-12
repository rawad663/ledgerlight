import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import {
  Authorized,
  OrgProtected,
} from '@src/common/decorators/auth.decorator';
import { CustomerService } from './customer.service';
import type { RequestWithUser } from '@src/domain/auth/strategies/jwt.strategy';
import {
  CreateCustomerDto,
  CustomersDto,
  GetCustomersQueryParamDto,
  GetCustomersResponseDto,
  UpdateCustomerDto,
} from './customer.dto';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('customers')
@Controller('customers')
@OrgProtected()
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @ApiOperation({ summary: 'Get customers' })
  @ApiOkResponse({ type: GetCustomersResponseDto })
  @Get()
  getCustomers(
    @Request() req: RequestWithUser,
    @Query() query: GetCustomersQueryParamDto,
  ): Promise<GetCustomersResponseDto> {
    if (!req.organization) {
      throw new ForbiddenException('Organization context is missing');
    }

    return this.customerService.getCustomers({
      organizationId: req.organization?.organizationId,
      query,
    });
  }

  @ApiOperation({ summary: 'Get Individual Customer' })
  @ApiOkResponse({ type: CustomersDto })
  @Get(':id')
  getCustomerById(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<CustomersDto> {
    if (!req.organization) {
      throw new ForbiddenException('Organization context is missing');
    }

    return this.customerService.getCustomerById({
      organizationId: req.organization?.organizationId,
      customerId: id,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create Individual Customer' })
  @ApiOkResponse({ type: CustomersDto })
  @Authorized('ADMIN', 'MANAGER')
  createCustomer(
    @Body() customerData: CreateCustomerDto,
    @Request() req: RequestWithUser,
  ) {
    if (!req.organization) {
      throw new ForbiddenException('Organization context is missing');
    }

    return this.customerService.createCustomer({
      organizationId: req.organization?.organizationId,
      customerData,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Individual Customer' })
  @ApiOkResponse({ type: CustomersDto })
  @Authorized('ADMIN', 'MANAGER')
  updateCustomer(
    @Param('id') id: string,
    @Body() customerData: UpdateCustomerDto,
    @Request() req: RequestWithUser,
  ) {
    if (!req.organization) {
      throw new ForbiddenException('Organization context is missing');
    }

    return this.customerService.updateCustomer({
      organizationId: req.organization?.organizationId,
      customerId: id,
      customerData,
    });
  }
}
