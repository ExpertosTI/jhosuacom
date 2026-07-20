import { Module } from '@nestjs/common';
import { CompaniesController, ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController, CompaniesController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
