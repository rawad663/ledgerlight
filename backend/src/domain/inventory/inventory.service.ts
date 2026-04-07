import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type CurrentOrg } from '@src/common/decorators/current-org.decorator';
import {
  ensureLocationAccessible,
  getLocationScopeWhere,
  hasRestrictedLocations,
  resolveOrganizationScope,
} from '@src/common/organization/location-scope';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import {
  CreateAdjustmentBodyDto,
  CreateInventoryLevelDto,
  GetAggregatedInventoryResponseDto,
  GetInventoryQueryDto,
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

type AggregatedInventoryRow = GetAggregatedInventoryResponseDto['data'][number];
type InventoryLevelRow = GetInventoryLevelsResponseDto['data'][number];
type ProductWithInventory = Product & {
  inventoryLevels: Array<
    InventoryLevel & {
      location: Pick<Location, 'id' | 'name'>;
    }
  >;
};

@Injectable()
export class InventoryService {
  constructor(private readonly prismaService: PrismaService) {}

  async getInventory(
    organization: CurrentOrg | string,
    query: GetInventoryQueryDto,
  ): Promise<GetAggregatedInventoryResponseDto> {
    const org = resolveOrganizationScope(organization);
    const rows = await this.getAggregatedInventorySnapshot(org);
    const filteredRows = query.lowStockOnly
      ? rows.filter((row) => row.isLowStock)
      : rows;
    const sortedRows = this.sortAggregatedInventoryRows(
      filteredRows,
      query.sortBy,
      query.sortOrder,
    );
    const { data, nextCursor } = this.paginateAggregatedInventoryRows(
      sortedRows,
      query.limit,
      query.cursor,
    );

    return {
      data,
      totalCount: filteredRows.length,
      nextCursor,
    };
  }

  async getLowStockProductCount(
    organization: CurrentOrg | string,
  ): Promise<number> {
    const org = resolveOrganizationScope(organization);

    if (!hasRestrictedLocations(org)) {
      const rows = (await this.prismaService.$queryRaw<
        Array<{ count: bigint | number | string }>
      >`
        SELECT COUNT(*)::bigint AS count
        FROM (
          SELECT p.id
          FROM "Product" p
          LEFT JOIN "InventoryLevel" il ON il."productId" = p.id
          WHERE p."organizationId" = ${org.organizationId}
          GROUP BY p.id, p."reorderThreshold"
          HAVING COALESCE(SUM(il.quantity), 0) <= p."reorderThreshold"
        ) low_stock_products
      `) ?? [{ count: 0n }];

      const rawCount = rows[0]?.count ?? 0;
      return Number(rawCount);
    }

    const rows = await this.getAggregatedInventorySnapshot(org);
    return rows.filter((row) => row.isLowStock).length;
  }

  async getLevels(
    organization: CurrentOrg | string,
    query: GetLevelsQueryDto,
  ): Promise<GetInventoryLevelsResponseDto> {
    const org = resolveOrganizationScope(organization);
    const { locationId, search, lowStockOnly, productId, ...paginationQuery } =
      query;

    if (locationId) {
      ensureLocationAccessible(org, locationId, {
        forbiddenMessage: 'You do not have access to this location',
      });
    }

    const where: Prisma.InventoryLevelWhereInput = {
      product: { organizationId: org.organizationId, id: productId },
      ...getLocationScopeWhere(org),
    };

    if (locationId) {
      where.locationId = query.locationId;
    }

    if (search) {
      where.product = {
        ...(where.product as Prisma.ProductWhereInput),
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { sku: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const levelOrderBy = this.buildLevelOrderBy(
      paginationQuery.sortBy,
      paginationQuery.sortOrder,
    );

    type LevelWithRelations = InventoryLevel & {
      product: Product;
      location: Location;
    };

    const [levelsResult, locations, lowStockCount] = await Promise.all([
      lowStockOnly
        ? this.prismaService.inventoryLevel
            .findMany({
              where,
              include: { product: true, location: true },
              orderBy: levelOrderBy,
            })
            .then((rows) => {
              const filtered = (rows as LevelWithRelations[]).filter(
                (level) => level.quantity <= level.product.reorderThreshold,
              );
              const paginated = this.paginateRows(
                filtered,
                paginationQuery.limit,
                paginationQuery.cursor,
                (level) => level.id,
              );
              return {
                data: paginated.data,
                total: filtered.length,
                nextCursor: paginated.nextCursor,
              };
            })
        : this.prismaService
            .paginateMany(
              this.prismaService.inventoryLevel,
              { where, include: { product: true, location: true } },
              {
                limit: paginationQuery.limit,
                cursor: paginationQuery.cursor,
                orderBy: levelOrderBy,
              },
            )
            .then(({ data, total, nextCursor }) => ({
              data: data as LevelWithRelations[],
              total,
              nextCursor,
            })),
      this.prismaService.location.findMany({
        where: {
          organizationId: org.organizationId,
          ...getLocationScopeWhere(org),
        },
      }),
      this.getLowStockProductCount(org),
    ]);

    const data = levelsResult.data.map((level) => ({
      id: level.id,
      quantity: level.quantity,
      createdAt: level.createdAt,
      updatedAt: level.updatedAt,
      product: level.product,
      location: level.location,
    })) as InventoryLevelRow[];

    return {
      data,
      totalCount: levelsResult.total,
      nextCursor: levelsResult.nextCursor,
      locations,
      lowStockCount,
    };
  }

  async getAggregatedInventorySnapshot(
    organization: CurrentOrg | string,
  ): Promise<AggregatedInventoryRow[]> {
    const org = resolveOrganizationScope(organization);
    const products = ((await this.prismaService.product.findMany({
      where: { organizationId: org.organizationId },
      include: {
        inventoryLevels: {
          ...(hasRestrictedLocations(org)
            ? { where: getLocationScopeWhere(org) }
            : {}),
          include: {
            location: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })) ?? []) as ProductWithInventory[];

    return products.map((product) => {
      const totalQuantity = product.inventoryLevels.reduce(
        (sum, level) => sum + level.quantity,
        0,
      );
      const stockGap = Math.max(product.reorderThreshold - totalQuantity, 0);

      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        totalQuantity,
        reorderThreshold: product.reorderThreshold,
        stockGap,
        isLowStock: totalQuantity <= product.reorderThreshold,
        locations: [...product.inventoryLevels]
          .sort((left, right) =>
            left.location.name.localeCompare(right.location.name),
          )
          .map((level) => ({
            locationId: level.location.id,
            locationName: level.location.name,
            quantity: level.quantity,
          })),
      };
    });
  }

  private sortAggregatedInventoryRows(
    rows: AggregatedInventoryRow[],
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'desc',
  ): AggregatedInventoryRow[] {
    const direction = sortOrder === 'asc' ? 1 : -1;

    return [...rows].sort((left, right) => {
      switch (sortBy) {
        case 'stockGap':
          return (
            this.compareNumbers(left.stockGap, right.stockGap, direction) ||
            left.name.localeCompare(right.name)
          );
        case 'totalQuantity':
          return (
            this.compareNumbers(
              left.totalQuantity,
              right.totalQuantity,
              direction,
            ) || left.name.localeCompare(right.name)
          );
        case 'reorderThreshold':
          return (
            this.compareNumbers(
              left.reorderThreshold,
              right.reorderThreshold,
              direction,
            ) || left.name.localeCompare(right.name)
          );
        case 'sku':
          return direction * left.sku.localeCompare(right.sku);
        case 'name':
          return direction * left.name.localeCompare(right.name);
        default:
          return left.name.localeCompare(right.name);
      }
    });
  }

  private compareNumbers(
    left: number,
    right: number,
    direction: 1 | -1,
  ): number {
    if (left === right) {
      return 0;
    }

    return left > right ? direction : -direction;
  }

  private paginateAggregatedInventoryRows(
    rows: AggregatedInventoryRow[],
    limit: number,
    cursor?: string,
  ) {
    return this.paginateRows(rows, limit, cursor, (row) => row.productId);
  }

  private buildLevelOrderBy(
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Record<string, 'asc' | 'desc' | Record<string, 'asc' | 'desc'>>[] {
    const dir = sortOrder;
    switch (sortBy) {
      case 'quantity':
        return [{ quantity: dir }, { product: { name: 'asc' } }];
      case 'updatedAt':
        return [{ updatedAt: dir }, { product: { name: 'asc' } }];
      case 'createdAt':
        return [{ createdAt: dir }, { product: { name: 'asc' } }];
      case 'name':
        return [{ product: { name: dir } }];
      default:
        return [{ product: { name: 'asc' } }];
    }
  }

  private paginateRows<T>(
    rows: T[],
    limit: number,
    cursor: string | undefined,
    getCursor: (row: T) => string,
  ) {
    const startIndex = cursor
      ? Math.max(rows.findIndex((row) => getCursor(row) === cursor) + 1, 0)
      : 0;
    const data = rows.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < rows.length;

    return {
      data,
      nextCursor: hasMore ? getCursor(data[data.length - 1]) : undefined,
    };
  }

  async createAdjustment(
    data: CreateAdjustmentBodyDto & {
      organizationId: string;
      organization?: CurrentOrg;
      actorUserId?: string;
    },
  ) {
    if (data.organization) {
      ensureLocationAccessible(data.organization, data.locationId, {
        allowUnspecified: false,
      });
    }

    return this.prismaService.$transaction((tx) =>
      this.createAdjustmentWithTx(tx, data),
    );
  }

  async createAdjustmentWithTx(
    tx: Prisma.TransactionClient,
    data: CreateAdjustmentBodyDto & {
      organizationId: string;
      organization?: CurrentOrg;
      actorUserId?: string;
    },
  ) {
    if (data.organization) {
      ensureLocationAccessible(data.organization, data.locationId, {
        allowUnspecified: false,
      });
    }

    const inventoryLevel = await tx.inventoryLevel.upsert({
      where: {
        productId_locationId: {
          productId: data.productId,
          locationId: data.locationId,
        },
      },
      create: {
        productId: data.productId,
        locationId: data.locationId,
        quantity: 0,
      },
      update: {},
    });

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
      data: {
        organizationId: data.organizationId,
        productId: data.productId,
        locationId: data.locationId,
        actorUserId: data.actorUserId,
        delta: data.delta,
        reason: data.reason,
        note: data.note,
      },
    });

    return {
      inventoryLevel: newInventoryLevel,
      adjustment,
    };
  }

  async createLevel(
    organization: CurrentOrg | string,
    data: CreateInventoryLevelDto,
  ) {
    const org = resolveOrganizationScope(organization);
    ensureLocationAccessible(org, data.locationId, {
      allowUnspecified: false,
    });

    const [product, location] = await Promise.all([
      this.prismaService.product.findFirst({
        where: { id: data.productId, organizationId: org.organizationId },
      }),
      this.prismaService.location.findFirst({
        where: {
          id: data.locationId,
          organizationId: org.organizationId,
          ...getLocationScopeWhere(org),
        },
      }),
    ]);

    if (!product) throw new NotFoundException('Product not found');
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
    organization: CurrentOrg | string,
    id: string,
    data: UpdateInventoryLevelDto,
  ) {
    const org = resolveOrganizationScope(organization);
    return this.prismaService.inventoryLevel.update({
      where: {
        id,
        product: { organizationId: org.organizationId },
        location: {
          organizationId: org.organizationId,
          ...(hasRestrictedLocations(org)
            ? { id: { in: org.allowedLocationIds } }
            : {}),
        },
      },
      data,
    });
  }

  async deleteLevel(organization: CurrentOrg | string, id: string) {
    const org = resolveOrganizationScope(organization);
    return this.prismaService.inventoryLevel.delete({
      where: {
        id,
        product: { organizationId: org.organizationId },
        location: {
          organizationId: org.organizationId,
          ...(hasRestrictedLocations(org)
            ? { id: { in: org.allowedLocationIds } }
            : {}),
        },
      },
    });
  }
}
