import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { PrismaModule } from '@src/infra/prisma/prisma.module';
import { CustomerService } from './customer.service';

@Module({
  imports: [PrismaModule],
  controllers: [CustomerController],
  providers: [CustomerService],
})
export class CustomerModule {}
