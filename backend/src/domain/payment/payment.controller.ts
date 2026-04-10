import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrgProtected } from '@src/common/decorators/auth.decorator';
import {
  CurrentOrganization,
  type CurrentOrg,
} from '@src/common/decorators/current-org.decorator';
import { CurrentUser } from '@src/common/decorators/current-user.decorator';
import {
  RequirePermissions,
  RequireAnyPermission,
} from '@src/common/decorators/permissions.decorator';
import { buildAuditContext } from '@src/common/audit/audit-context';
import { type RequestWithContext } from '@src/common/middlewares/request-context.middleware';
import { Permission } from '@src/common/permissions';
import { ApiDoc } from '@src/common/swagger/api-doc.decorator';
import { toOrganizationScopeInput } from '@src/common/organization/location-scope';
import {
  type RequestWithUser,
  type UserWithMemberships,
} from '../auth/strategies/jwt.strategy';
import {
  CreateCardPaymentResponseDto,
  PaymentDto,
  RefundPaymentDto,
} from './payment.dto';
import { PaymentService } from './payment.service';

@ApiTags('payments')
@Controller('payments')
@OrgProtected()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get(':orderId')
  @RequirePermissions(Permission.PAYMENTS_READ)
  @ApiDoc({
    summary: 'Get payment for an order',
    ok: PaymentDto,
    params: [{ name: 'orderId', type: String, in: 'path' }],
  })
  getPayment(
    @CurrentOrganization() org: CurrentOrg,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentService.getPaymentByOrderId(
      toOrganizationScopeInput(org),
      orderId,
    );
  }

  @Post(':orderId/card')
  @RequireAnyPermission(Permission.PAYMENTS_CREATE)
  @ApiDoc({
    summary: 'Start or resume a card payment',
    created: CreateCardPaymentResponseDto,
    params: [{ name: 'orderId', type: String, in: 'path' }],
  })
  initiateCardPayment(
    @CurrentOrganization() org: CurrentOrg,
    @CurrentUser() user: UserWithMemberships,
    @Req() req: RequestWithUser & RequestWithContext,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentService.initiateCardPayment(
      toOrganizationScopeInput(org),
      orderId,
      buildAuditContext(req, user.id),
    );
  }

  @Post(':orderId/card/confirm')
  @RequireAnyPermission(Permission.PAYMENTS_CREATE)
  @ApiDoc({
    summary: 'Sync the latest card attempt from Stripe',
    ok: PaymentDto,
    params: [{ name: 'orderId', type: String, in: 'path' }],
  })
  confirmCardPayment(
    @CurrentOrganization() org: CurrentOrg,
    @CurrentUser() user: UserWithMemberships,
    @Req() req: RequestWithUser & RequestWithContext,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentService.confirmCardPayment(
      toOrganizationScopeInput(org),
      orderId,
      buildAuditContext(req, user.id),
    );
  }

  @Post(':orderId/cash')
  @RequireAnyPermission(Permission.PAYMENTS_CREATE)
  @ApiDoc({
    summary: 'Mark an order as cash paid',
    ok: PaymentDto,
    params: [{ name: 'orderId', type: String, in: 'path' }],
  })
  markCashPaid(
    @CurrentOrganization() org: CurrentOrg,
    @CurrentUser() user: UserWithMemberships,
    @Req() req: RequestWithUser & RequestWithContext,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentService.markCashPaid(
      toOrganizationScopeInput(org),
      orderId,
      buildAuditContext(req, user.id),
    );
  }

  @Post(':orderId/refund')
  @RequirePermissions(Permission.PAYMENTS_REFUND)
  @ApiDoc({
    summary: 'Request a full refund for an order payment',
    ok: PaymentDto,
    body: RefundPaymentDto,
    params: [{ name: 'orderId', type: String, in: 'path' }],
  })
  refundPayment(
    @CurrentOrganization() org: CurrentOrg,
    @CurrentUser() user: UserWithMemberships,
    @Req() req: RequestWithUser & RequestWithContext,
    @Param('orderId') orderId: string,
    @Body() data: RefundPaymentDto,
  ) {
    return this.paymentService.refundPayment(
      toOrganizationScopeInput(org),
      orderId,
      data,
      buildAuditContext(req, user.id),
    );
  }
}
