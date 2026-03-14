import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginationOptionsQueryParamDto } from '@src/common/dto/pagination.dto';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import {
  CreateProductDto,
  GetProductsResponseDto,
  UpdateProductDto,
} from './product.dto';

@Injectable()
export class ProductService {
  constructor(private readonly prismaService: PrismaService) {}

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

  async createProduct(organizationId: string, productData: CreateProductDto) {
    return this.prismaService.product.create({
      data: {
        ...productData,
        active: true,
        organizationId,
      },
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
    return this.prismaService.product.delete({
      where: { organizationId, id: productId },
    });
  }
}
