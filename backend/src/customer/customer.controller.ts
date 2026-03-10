import { Controller, Get, Param, Query, Request } from '@nestjs/common';
import { OrgProtected } from '@src/auth/decorators/auth.decorator';
import { CustomerService } from './customer.service';
import type { RequestWithUser } from '@src/auth/strategies/jwt.strategy';
import {
  CustomersDto,
  GetCustomersQueryParamDto,
  GetCustomersResponseDto,
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
      throw new Error('Organization context is missing');
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
      throw new Error('Organization context is missing');
    }

    return this.customerService.getCustomerById({
      organizationId: req.organization?.organizationId,
      customerId: id,
    });
  }
}
