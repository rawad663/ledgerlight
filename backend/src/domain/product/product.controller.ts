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
import { CurrentUser } from '@src/common/decorators/current-user.decorator';
import { type UserWithMemberships } from '../auth/strategies/jwt.strategy';
import {
  ApiDoc,
  appendToPaginationQuery,
} from '@src/common/swagger/api-doc.decorator';
import { GetProductsResponseDto, ProductDto } from './product.dto';

@Controller('products')
@OrgProtected()
@ApiTags('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiDoc({
    summary: 'Get products',
    description: 'List products for the active organization with pagination.',
    ok: GetProductsResponseDto,
    queries: appendToPaginationQuery([]),
  })
  getProducts(
    @CurrentOrganization() organization: CurrentOrg,
    @Query() query: PaginationOptionsQueryParamDto,
  ) {
    return this.productService.getProducts(organization.organizationId, query);
  }

  @Get(':id')
  @ApiDoc({
    summary: 'Get product by ID',
    ok: ProductDto,
    notFoundDesc: 'Product not found',
    params: [{ name: 'id', description: 'Product ID', type: String }],
  })
  getProductById(
    @CurrentOrganization() organization: CurrentOrg,
    @Param('id') id: string,
  ) {
    return this.productService.getProductById(organization.organizationId, id);
  }

  @Post()
  @Authorized('ADMIN', 'MANAGER')
  @ApiDoc({
    summary: 'Create product',
    body: CreateProductDto,
    created: ProductDto,
    conflictDesc: 'Duplicate SKU or constraint violation',
  })
  createProduct(
    @Body() productData: CreateProductDto,
    @CurrentOrganization() organization: CurrentOrg,
    @CurrentUser() user: UserWithMemberships,
  ) {
    return this.productService.createProduct(
      organization.organizationId,
      productData,
      user?.id,
    );
  }

  @Patch(':id')
  @Authorized('ADMIN', 'MANAGER')
  @ApiDoc({
    summary: 'Update product',
    body: UpdateProductDto,
    ok: ProductDto,
    notFoundDesc: 'Product not found',
    params: [{ name: 'id', description: 'Product ID', type: String }],
  })
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
  @ApiDoc({
    summary: 'Delete product',
    ok: ProductDto,
    notFoundDesc: 'Product not found',
    params: [{ name: 'id', description: 'Product ID', type: String }],
  })
  deleteProduct(
    @Param('id') id: string,
    @CurrentOrganization() organization: CurrentOrg,
  ) {
    return this.productService.deleteProduct(organization.organizationId, id);
  }
}
