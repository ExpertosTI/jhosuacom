import { Module } from '@nestjs/common';
import { CompaniesController, ProductsController } from './products.controller';

@Module({
  controllers: [ProductsController, CompaniesController],
})
export class ProductsModule {}
