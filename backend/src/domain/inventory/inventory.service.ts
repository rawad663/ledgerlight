import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import { PaginationOptionsQueryParamDto } from '@src/common/dto/pagination.dto';
import {
  CreateAdjustmentBodyDto,
  CreateInventoryLevelDto,
  GetAggregatedInventoryResponseDto,
  GetInventoryLevelsResponseDto,
  GetLevelsQueryDto,
  UpdateInventoryLevelDto,
} from './inventory.dto';
import {
  InventoryLevel,
  Location,
  Prisma,
  Product,
} from '@prisma/generated/client';

export const LOW_STOCK_THRESHOLD = 10;

@Injectable()
export class InventoryService {
  constructor(private readonly prismaService: PrismaService) {}

  async getInventory(
    organizationId: string,
    query: PaginationOptionsQueryParamDto,
  ): Promise<GetAggregatedInventoryResponseDto> {
    const { data: products, total } = await this.prismaService.paginateMany(
      this.prismaService.product,
      {
        where: { organizationId },
        include: { inventoryLevels: true },
      },
      {
        limit: query.limit,
        cursor: query.cursor,
        orderBy: query.sortBy
          ? { [query.sortBy]: query.sortOrder || 'desc' }
          : { name: 'asc' },
      },
    );

    const data = products.map((product) => {
      const levels = (
        product as Product & { inventoryLevels: InventoryLevel[] }
      ).inventoryLevels;
      const totalQuantity = levels.reduce((sum, l) => sum + l.quantity, 0);
      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        totalQuantity,
        locations: levels.map((l) => ({
          locationId: l.locationId,
          quantity: l.quantity,
        })),
      };
    });

    return {
      data,
      totalCount: total,
      nextCursor:
        products.length === query.limit
          ? products[products.length - 1].id
          : undefined,
    };
  }

  async getLevels(
    organizationId: string,
    query: GetLevelsQueryDto,
  ): Promise<GetInventoryLevelsResponseDto> {
    const where: Prisma.InventoryLevelWhereInput = {
      product: { organizationId },
    };

    if (query.locationId) {
      where.locationId = query.locationId;
    }

    if (query.search) {
      where.product = {
        ...(where.product as Prisma.ProductWhereInput),
        OR: [
          { name: { contains: query.search as string, mode: 'insensitive' } },
          { sku: { contains: query.search as string, mode: 'insensitive' } },
        ],
      };
    }

    if (query.lowStockOnly) {
      where.quantity = { lte: LOW_STOCK_THRESHOLD };
    }

    const [result, locations, lowStockCount] = await Promise.all([
      this.prismaService.paginateMany(
        this.prismaService.inventoryLevel,
        {
          where,
          include: { product: true, location: true },
          omit: { productId: true, locationId: true },
        },
        {
          limit: query.limit,
          cursor: query.cursor,
          orderBy: query.sortBy
            ? { [query.sortBy]: query.sortOrder || 'desc' }
            : { updatedAt: 'desc' },
        },
      ),
      this.prismaService.location.findMany({
        where: { organizationId },
      }),
      this.prismaService.inventoryLevel.count({
        where: {
          product: { organizationId },
          quantity: { lte: LOW_STOCK_THRESHOLD },
        },
      }),
    ]);

    const levels = result.data as (InventoryLevel & {
      product: Product;
      location: Location;
    })[];

    return {
      data: levels,
      totalCount: result.total,
      nextCursor:
        levels.length === query.limit
          ? levels[levels.length - 1].id
          : undefined,
      locations,
      lowStockCount,
    };
  }

  async createAdjustment(
    data: CreateAdjustmentBodyDto & {
      organizationId: string;
      actorUserId?: string;
    },
  ) {
    return this.prismaService.$transaction((tx) =>
      this.createAdjustmentWithTx(tx, data),
    );
  }

  async createAdjustmentWithTx(
    tx: Prisma.TransactionClient,
    data: CreateAdjustmentBodyDto & {
      organizationId: string;
      actorUserId?: string;
    },
  ) {
    let inventoryLevel = await tx.inventoryLevel.findFirst({
      where: { productId: data.productId, locationId: data.locationId },
    });

    if (!inventoryLevel) {
      inventoryLevel = await tx.inventoryLevel.create({
        data: {
          productId: data.productId,
          locationId: data.locationId,
          quantity: 0,
        },
      });
    }

    const newQuantity = inventoryLevel.quantity + data.delta;

    if (newQuantity < 0) {
      throw new BadRequestException(
        'Attempting to reduce product stock below zero',
      );
    }

    const newInventoryLevel = await tx.inventoryLevel.update({
      where: { id: inventoryLevel.id },
      data: { quantity: newQuantity },
    });

    const adjustment = await tx.inventoryAdjustment.create({
      data,
    });

    return {
      inventoryLevel: newInventoryLevel,
      adjustment,
    };
  }

  async createLevel(organizationId: string, data: CreateInventoryLevelDto) {
    const product = await this.prismaService.product.findFirst({
      where: { id: data.productId, organizationId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const location = await this.prismaService.location.findFirst({
      where: { id: data.locationId, organizationId },
    });
    if (!location) throw new NotFoundException('Location not found');

    return this.prismaService.inventoryLevel.create({
      data: {
        productId: data.productId,
        locationId: data.locationId,
        quantity: data.quantity ?? 0,
      },
    });
  }

  async updateLevel(
    organizationId: string,
    id: string,
    data: UpdateInventoryLevelDto,
  ) {
    const existing = await this.prismaService.inventoryLevel.findFirst({
      where: { id, product: { organizationId }, location: { organizationId } },
    });
    if (!existing) throw new NotFoundException('Inventory level not found');

    return this.prismaService.inventoryLevel.update({
      where: { id },
      data,
    });
  }

  async deleteLevel(organizationId: string, id: string) {
    const existing = await this.prismaService.inventoryLevel.findFirst({
      where: { id, product: { organizationId }, location: { organizationId } },
    });
    if (!existing) throw new NotFoundException('Inventory level not found');

    return this.prismaService.inventoryLevel.delete({ where: { id } });
  }
}
