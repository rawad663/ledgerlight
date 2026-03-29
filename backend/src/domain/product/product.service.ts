import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import {
  CreateProductDto,
  GetProductsResponseDto,
  ProductQueryParamDto,
  UpdateProductDto,
} from './product.dto';
import { InventoryService } from '../inventory/inventory.service';
import {
  InventoryAdjustment,
  InventoryLevel,
  Product,
  Prisma,
} from '@prisma/generated/client';

@Injectable()
export class ProductService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async getProducts(
    organizationId: string,
    query: ProductQueryParamDto,
  ): Promise<GetProductsResponseDto> {
    const where: Prisma.ProductWhereInput = {
      organizationId,
      active: query.isActive,
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.category) {
      where.category = query.category;
    }

    const [{ data: products, total, nextCursor }, distinctCategories] =
      await Promise.all([
        this.prismaService.paginateMany(
          this.prismaService.product,
          { where },
          {
            limit: query.limit,
            cursor: query.cursor,
            orderBy: query.sortBy
              ? { [query.sortBy]: query.sortOrder || 'desc' }
              : { createdAt: 'desc' },
          },
        ),
        this.prismaService.product.findMany({
          where: { organizationId },
          select: { category: true },
          distinct: ['category'],
        }),
      ]);

    return {
      data: products,
      totalCount: total,
      categories: distinctCategories
        .map((p) => p.category)
        .filter((c): c is string => c !== null)
        .sort(),
      nextCursor,
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

    return this.prismaService.$transaction(async (tx) => {
      const product = await tx.product.create({
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

        const { inventoryLevel, adjustment } =
          await this.inventoryService.createAdjustmentWithTx(tx, {
            organizationId,
            actorUserId,
            productId: product.id,
            locationId,
            delta: quantity,
            reason: 'INITIAL_STOCK',
            note,
          });

        result.inventoryLevel = inventoryLevel;
        result.adjustment = adjustment;
      }

      return result;
    });
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
    return this.prismaService.product.update({
      where: { organizationId, id: productId },
      data: { active: false },
    });
  }
}
