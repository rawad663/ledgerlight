import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { OrgProtected } from '@src/common/decorators/auth.decorator';
import { RequirePermissions } from '@src/common/decorators/permissions.decorator';
import { Permission } from '@src/common/permissions';
import {
  CurrentOrganization,
  type CurrentOrg,
} from '@src/common/decorators/current-org.decorator';
import { ProductService } from './product.service';
import {
  CreateProductDto,
  ProductQueryParamDto,
  UpdateProductDto,
} from './product.dto';
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
  @RequirePermissions(Permission.PRODUCTS_READ)
  @ApiDoc({
    summary: 'Get products',
    description: 'List products for the active organization with pagination.',
    ok: GetProductsResponseDto,
    queries: appendToPaginationQuery([
      { name: 'search', description: 'Search by name or SKU', type: String },
      { name: 'category', description: 'Filter by category', type: String },
    ]),
  })
  getProducts(
    @CurrentOrganization() organization: CurrentOrg,
    @Query() query: ProductQueryParamDto,
  ) {
    Logger.debug(query);
    return this.productService.getProducts(organization.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.PRODUCTS_READ)
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
  @RequirePermissions(Permission.PRODUCTS_CREATE)
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
  @RequirePermissions(Permission.PRODUCTS_UPDATE)
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
  @RequirePermissions(Permission.PRODUCTS_ARCHIVE)
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
