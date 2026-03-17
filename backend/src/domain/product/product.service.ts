import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginationOptionsQueryParamDto } from '@src/common/dto/pagination.dto';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import {
  CreateProductDto,
  GetProductsResponseDto,
  UpdateProductDto,
} from './product.dto';
import { InventoryService } from '../inventory/inventory.service';
import {
  InventoryAdjustment,
  InventoryLevel,
  Product,
} from '@prisma/generated/client';

@Injectable()
export class ProductService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async getProducts(
    organizationId: string,
    query: PaginationOptionsQueryParamDto,
  ): Promise<GetProductsResponseDto> {
    const products = await this.prismaService.paginateMany(
      this.prismaService.product,
      {
        where: { organizationId },
      },
      {
        limit: query.limit,
        cursor: query.cursor,
        orderBy: query.sortBy
          ? { [query.sortBy]: query.sortOrder || 'desc' }
          : { createdAt: 'desc' },
      },
    );

    return {
      data: products,
      totalCount: products.length,
      nextCursor:
        products.length === query.limit
          ? products[products.length - 1].id
          : undefined,
    };
  }

  async getProductById(organizationId: string, productId: string) {
    const product = await this.prismaService.product.findFirst({
      where: { id: productId, organizationId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async createProduct(
    organizationId: string,
    productData: CreateProductDto,
    actorUserId?: string,
  ) {
    const { inventory: inventoryData, ...rest } = productData;
    const product = await this.prismaService.product.create({
      data: {
        ...rest,
        active: true,
        organizationId,
      },
    });

    const result: {
      product: Product;
      inventoryLevel?: InventoryLevel;
      adjustment?: InventoryAdjustment;
    } = { product };

    if (inventoryData !== undefined) {
      const { locationId, quantity, note } = inventoryData;

      const { inventoryLevel: newIntentoryLevel, adjustment } =
        await this.inventoryService.createAdjustment({
          organizationId,
          actorUserId,
          productId: product.id,
          locationId,
          delta: quantity,
          reason: 'Initial stock creation',
          note,
        });

      result.inventoryLevel = newIntentoryLevel;
      result.adjustment = adjustment;
    }

    return result;
  }

  async updateProduct(
    organizationId: string,
    productId: string,
    productData: UpdateProductDto,
  ) {
    return this.prismaService.product.update({
      where: { organizationId, id: productId },
      data: productData,
    });
  }

  async deleteProduct(organizationId: string, productId: string) {
    return this.prismaService.product.delete({
      where: { organizationId, id: productId },
    });
  }
}
