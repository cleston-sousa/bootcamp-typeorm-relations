import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';

import IUpdateProductsQuantityDTO from '@modules/products/dtos/IUpdateProductsQuantityDTO';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

import ICreateOrderDTO from '../dtos/ICreateOrderDTO';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository') private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) { }

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);
    if (!customer) {
      throw new AppError('Invalid Customer');
    }

    const persistedProducts = await this.productsRepository.findAllById(
      products,
    );

    if (persistedProducts.length !== products.length) {
      throw new AppError('Invalid Products quantity');
    }

    const updateProducts: IUpdateProductsQuantityDTO[] = [];

    const productsToInsert = products.map(product => {
      const persistedProduct = persistedProducts.find(
        item => item.id === product.id,
      );

      if (!persistedProduct) {
        throw new AppError('Invalid Product selected');
      }

      if (persistedProduct.quantity < product.quantity) {
        throw new AppError(
          `Invalid Product quantity selected for: ${persistedProduct.name}`,
        );
      }

      updateProducts.push({
        id: product.id,
        quantity: persistedProduct.quantity - product.quantity,
      });

      return {
        product_id: product.id,
        quantity: product.quantity,
        price: persistedProduct.price,
      };
    });

    const data: ICreateOrderDTO = {
      customer,
      products: productsToInsert,
    };

    const order = await this.ordersRepository.create(data);

    await this.productsRepository.updateQuantity(updateProducts);

    return order;
  }
}

export default CreateOrderService;
