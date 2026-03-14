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
import {
  Authorized,
  OrgProtected,
} from '@src/common/decorators/auth.decorator';
import {
  CurrentOrganization,
  type CurrentOrg,
} from '@src/common/decorators/current-org.decorator';
import { ProductService } from './product.service';
import { PaginationOptionsQueryParamDto } from '@src/common/dto/pagination.dto';
import { CreateProductDto, UpdateProductDto } from './product.dto';
import { ApiTags } from '@nestjs/swagger';

@Controller('products')
@OrgProtected()
@ApiTags('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  getProducts(
    @CurrentOrganization() organization: CurrentOrg,
    @Query() query: PaginationOptionsQueryParamDto,
  ) {
    return this.productService.getProducts(organization.organizationId, query);
  }

  @Get(':id')
  getProductById(
    @CurrentOrganization() organization: CurrentOrg,
    @Param('id') id: string,
  ) {
    return this.productService.getProductById(organization.organizationId, id);
  }

  @Post()
  @Authorized('ADMIN', 'MANAGER')
  createProduct(
    @Body() productData: CreateProductDto,
    @CurrentOrganization() organization: CurrentOrg,
  ) {
    return this.productService.createProduct(
      organization.organizationId,
      productData,
    );
  }

  @Patch(':id')
  @Authorized('ADMIN', 'MANAGER')
  updateProduct(
    @Param('id') id: string,
    @CurrentOrganization() organization: CurrentOrg,
    @Body() productData: UpdateProductDto,
  ) {
    return this.productService.updateProduct(
      organization.organizationId,
      id,
      productData,
    );
  }

  @Delete(':id')
  @Authorized('ADMIN')
  deleteProduct(
    @Param('id') id: string,
    @CurrentOrganization() organization: CurrentOrg,
  ) {
    return this.productService.deleteProduct(organization.organizationId, id);
  }
}
