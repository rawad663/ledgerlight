import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import {
  CreateAdjustmentBodyDto,
  CreateInventoryLevelDto,
  GetInventoryLevelsResponseDto,
  GetLevelsQueryDto,
  UpdateInventoryLevelDto,
} from './inventory.dto';
import { InventoryLevel, Location, Product } from '@prisma/generated/client';

@Injectable()
export class InventoryService {
  constructor(private readonly prismaService: PrismaService) {}

  async getInventory(organizationId: string) {
    const productWithInventory = await this.prismaService.product.findMany({
      where: { organizationId },
      include: { inventoryLevels: true },
    });

    const aggregateByProduct = productWithInventory.reduce(
      (acc, currentProduct) => {
        const levels = currentProduct.inventoryLevels;
        const aggregate = levels.reduce(
          (a, c) => {
            return {
              totalQuantity: a.totalQuantity + c.quantity,
              locations: [
                ...a.locations,
                { locationId: c.locationId, quantity: c.quantity },
              ],
            };
          },
          { totalQuantity: 0, locations: [] },
        );

        return [
          ...acc,
          {
            productId: currentProduct.id,
            name: currentProduct.name,
            sku: currentProduct.sku,
            totalQuantity: aggregate.totalQuantity,
            locations: aggregate.locations,
          },
        ];
      },
      [],
    );

    return aggregateByProduct;
  }

  async getLevels(
    query: GetLevelsQueryDto,
  ): Promise<GetInventoryLevelsResponseDto> {
    const levels = (await this.prismaService.paginateMany(
      this.prismaService.inventoryLevel,
      {
        where: {
          product: { id: query.productId },
          location: { id: query.locationId },
        },
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
    )) as (InventoryLevel & {
      product: Product;
      location: Location;
    })[];

    return {
      data: levels,
      totalCount: levels.length,
      nextCursor:
        levels.length === query.limit
          ? levels[levels.length - 1].id
          : undefined,
    };
  }

  async createAdjustment(
    data: CreateAdjustmentBodyDto & {
      organizationId: string;
      actorUserId?: string;
    },
  ) {
    const inventoryLevel = await this.prismaService.inventoryLevel.findFirst({
      where: { productId: data.productId, locationId: data.locationId },
    });

    if (!inventoryLevel) {
      throw new NotFoundException(
        'Inventory associated to given product/location is not found',
      );
    }

    const newQuantity = inventoryLevel.quantity + data.delta;

    if (newQuantity < 0) {
      throw new BadRequestException(
        'Attempting to reduce product stock below zero',
      );
    }

    // We update the inventoryLevel we found with the delta requested
    const newIntentoryLevel = await this.prismaService.inventoryLevel.update({
      where: { id: inventoryLevel.id },
      data: { quantity: newQuantity },
    });

    const adjustment = await this.prismaService.inventoryAdjustment.create({
      data,
    });

    return {
      inventoryLevel: newIntentoryLevel,
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
