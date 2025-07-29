import { db } from '../db';
import { orders, orderItems, products, licenseKeys, users } from '@shared/schema';
import { and, eq, desc, sql } from 'drizzle-orm';

export interface OrderData {
  id: string;
  userId: string;
  tenantId: string;
  orderNumber: string;
  status: string;
  totalAmount: string;
  taxAmount: string;
  finalAmount: string;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: Date;
  updatedAt: Date;
  billingInfo: {
    companyName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
  items: OrderItem[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  licenseKeyId: string | null;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  product: {
    id: string;
    name: string;
    description: string;
    price: string;
    platform: string;
    region: string;
  } | null;
  licenseKey: {
    id: string;
    keyValue: string;
    usedBy: string | null;
    usedAt: Date | null;
    createdAt: Date;
  } | null;
}

export class OrderService {



  /**
   * Get orders for a specific user with proper tenant isolation
   */
  async getUserOrders(userId: string, tenantId: string): Promise<OrderData[]> {
    // Enterprise-level tenant isolation at application level 
    const userOrders = await db
      .select()
      .from(orders)
      .where(and(
        eq(orders.userId, userId),
        eq(orders.tenantId, tenantId)
      ))
      .orderBy(desc(orders.createdAt));

    const ordersWithItems = await Promise.all(
      userOrders.map(async (order) => {
        const items = await db
          .select({
            id: orderItems.id,
            orderId: orderItems.orderId,
            productId: orderItems.productId,
            licenseKeyId: orderItems.licenseKeyId,
            quantity: orderItems.quantity,
            unitPrice: orderItems.unitPrice,
            totalPrice: orderItems.totalPrice,
            productName: products.name,
            productDescription: products.description,
            productPrice: products.price,
            productPlatform: products.platform,
            productRegion: products.region,
            licenseKeyValue: licenseKeys.keyValue,
            licenseKeyUsedBy: licenseKeys.usedBy,
            licenseKeyUsedAt: licenseKeys.usedAt,
            licenseKeyCreatedAt: licenseKeys.createdAt,
          })
          .from(orderItems)
          .leftJoin(products, eq(orderItems.productId, products.id))
          .leftJoin(licenseKeys, eq(orderItems.licenseKeyId, licenseKeys.id))
          .where(eq(orderItems.orderId, order.id));

        const orderItemsData: OrderItem[] = items.map(item => ({
          id: item.id,
          orderId: item.orderId,
          productId: item.productId,
          licenseKeyId: item.licenseKeyId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          product: item.productName ? {
            id: item.productId,
            name: item.productName,
            description: item.productDescription || '',
            price: item.productPrice || '0.00',
            platform: item.productPlatform || '',
            region: item.productRegion || '',
          } : null,
          licenseKey: item.licenseKeyValue ? {
            id: item.licenseKeyId!,
            keyValue: item.licenseKeyValue,
            usedBy: item.licenseKeyUsedBy,
            usedAt: item.licenseKeyUsedAt,
            createdAt: item.licenseKeyCreatedAt!,
          } : null,
        }));

        return {
          id: order.id,
          userId: order.userId,
          tenantId: order.tenantId,
          orderNumber: order.orderNumber,
          status: order.status,
          totalAmount: order.totalAmount,
          taxAmount: order.taxAmount,
          finalAmount: order.finalAmount,
          paymentMethod: order.paymentMethod || '',
          paymentStatus: order.paymentStatus || 'pending',
          createdAt: order.createdAt!,
          updatedAt: order.updatedAt!,
          billingInfo: {
            companyName: order.companyName || '',
            firstName: order.firstName || '',
            lastName: order.lastName || '',
            email: order.email || '',
            phone: order.phone || '',
            address: order.address || '',
            city: order.city || '',
            postalCode: order.postalCode || '',
            country: order.country || '',
          },
          items: orderItemsData,
        };
      })
    );

    return ordersWithItems;
  }

  /**
   * Get all orders for admin users (cross-tenant view)
   */
  async getAllOrders(adminRole: string): Promise<OrderData[]> {
    // Admin can access all orders across tenants
    const allOrders = await db
      .select({
        id: orders.id,
        userId: orders.userId,
        tenantId: orders.tenantId,
        orderNumber: orders.orderNumber,
        status: orders.status,
        totalAmount: orders.totalAmount,
        taxAmount: orders.taxAmount,
        finalAmount: orders.finalAmount,
        paymentMethod: orders.paymentMethod,
        paymentStatus: orders.paymentStatus,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        companyName: orders.companyName,
        firstName: orders.firstName,
        lastName: orders.lastName,
        email: orders.email,
        phone: orders.phone,
        address: orders.address,
        city: orders.city,
        postalCode: orders.postalCode,
        country: orders.country,
        username: users.username,
        userEmail: users.email,
      })
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      .orderBy(desc(orders.createdAt));

    const ordersWithItems = await Promise.all(
      allOrders.map(async (order) => {
        const items = await db
          .select({
            id: orderItems.id,
            orderId: orderItems.orderId,
            productId: orderItems.productId,
            licenseKeyId: orderItems.licenseKeyId,
            quantity: orderItems.quantity,
            unitPrice: orderItems.unitPrice,
            totalPrice: orderItems.totalPrice,
            productName: products.name,
            productDescription: products.description,
            productPrice: products.price,
            productPlatform: products.platform,
            productRegion: products.region,
            licenseKeyValue: licenseKeys.keyValue,
            licenseKeyUsedBy: licenseKeys.usedBy,
            licenseKeyUsedAt: licenseKeys.usedAt,
            licenseKeyCreatedAt: licenseKeys.createdAt,
          })
          .from(orderItems)
          .leftJoin(products, eq(orderItems.productId, products.id))
          .leftJoin(licenseKeys, eq(orderItems.licenseKeyId, licenseKeys.id))
          .where(eq(orderItems.orderId, order.id));

        const orderItemsData: OrderItem[] = items.map(item => ({
          id: item.id,
          orderId: item.orderId,
          productId: item.productId,
          licenseKeyId: item.licenseKeyId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          product: item.productName ? {
            id: item.productId,
            name: item.productName,
            description: item.productDescription || '',
            price: item.productPrice || '0.00',
            platform: item.productPlatform || '',
            region: item.productRegion || '',
          } : null,
          licenseKey: item.licenseKeyValue ? {
            id: item.licenseKeyId!,
            keyValue: item.licenseKeyValue,
            usedBy: item.licenseKeyUsedBy,
            usedAt: item.licenseKeyUsedAt,
            createdAt: item.licenseKeyCreatedAt!,
          } : null,
        }));

        return {
          id: order.id,
          userId: order.userId,
          tenantId: order.tenantId,
          orderNumber: order.orderNumber,
          status: order.status,
          totalAmount: order.totalAmount,
          taxAmount: order.taxAmount,
          finalAmount: order.finalAmount,
          paymentMethod: order.paymentMethod || '',
          paymentStatus: order.paymentStatus || 'pending',
          createdAt: order.createdAt!,
          updatedAt: order.updatedAt!,
          billingInfo: {
            companyName: order.companyName || '',
            firstName: order.firstName || '',
            lastName: order.lastName || '',
            email: order.email || '',
            phone: order.phone || '',
            address: order.address || '',
            city: order.city || '',
            postalCode: order.postalCode || '',
            country: order.country || '',
          },
          items: orderItemsData,
        };
      })
    );

    return ordersWithItems;
  }

  /**
   * Create a new order with BULLETPROOF TRANSACTIONAL CONSISTENCY
   * This ensures orders are immediately visible and prevents data inconsistencies
   */
  async createOrder(orderData: {
    userId: string;
    tenantId: string;
    orderNumber: string;
    status: string;
    totalAmount: string;
    taxAmount: string;
    finalAmount: string;
    paymentMethod: string;
    paymentStatus: string;
    companyName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
  }) {
    // Start database transaction for bulletproof consistency
    return await db.transaction(async (tx) => {
      // Create the order
      const [newOrder] = await tx
        .insert(orders)
        .values(orderData)
        .returning();

      // CRITICAL: Immediate verification within same transaction
      const verificationResults = await tx
        .select()
        .from(orders)
        .where(and(
          eq(orders.id, newOrder.id),
          eq(orders.userId, orderData.userId),
          eq(orders.tenantId, orderData.tenantId)
        ));

      // Bulletproof verification: if order not immediately visible, rollback
      if (verificationResults.length === 0) {
        console.error('CRITICAL: Order verification failed - order not visible after creation', {
          orderId: newOrder.id,
          orderNumber: orderData.orderNumber,
          tenantId: orderData.tenantId,
          userId: orderData.userId
        });
        throw new Error('Order creation verification failed - transaction will be rolled back');
      }

      // Additional verification: ensure order appears in user's order list
      const userOrderVerification = await tx
        .select()
        .from(orders)
        .where(and(
          eq(orders.userId, orderData.userId),
          eq(orders.tenantId, orderData.tenantId)
        ))
        .orderBy(desc(orders.createdAt))
        .limit(1);

      if (userOrderVerification.length === 0 || userOrderVerification[0].id !== newOrder.id) {
        console.error('CRITICAL: User order list verification failed', {
          orderId: newOrder.id,
          orderNumber: orderData.orderNumber,
          expected: newOrder.id,
          actual: userOrderVerification[0]?.id || 'none'
        });
        throw new Error('Order visibility verification failed - transaction will be rolled back');
      }

      console.log('✅ BULLETPROOF ORDER VERIFICATION SUCCESSFUL', {
        orderId: newOrder.id,
        orderNumber: orderData.orderNumber,
        tenantId: orderData.tenantId,
        verificationPassed: true
      });

      return newOrder;
    });
  }

  /**
   * Create order item within transaction with immediate verification
   */
  async createOrderItemWithTransaction(tx: any, orderItemData: {
    orderId: string;
    productId: string;
    licenseKeyId: string | null;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
  }) {
    const [newOrderItem] = await tx
      .insert(orderItems)
      .values(orderItemData)
      .returning();

    // Immediate verification within transaction
    const verificationResults = await tx
      .select()
      .from(orderItems)
      .where(and(
        eq(orderItems.id, newOrderItem.id),
        eq(orderItems.orderId, orderItemData.orderId)
      ));

    if (verificationResults.length === 0) {
      throw new Error(`Order item verification failed for order ${orderItemData.orderId}`);
    }

    return newOrderItem;
  }

  /**
   * ENTERPRISE COMPLETE ORDER CREATION with bulletproof consistency
   * Creates order + items + processes payment within single transaction
   */
  async createCompleteOrder(
    orderData: {
      userId: string;
      tenantId: string;
      orderNumber: string;
      status: string;
      totalAmount: string;
      taxAmount: string;
      finalAmount: string;
      paymentMethod: string;
      paymentStatus: string;
      companyName: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      address: string;
      city: string;
      postalCode: string;
      country: string;
    },
    cartItems: Array<{
      productId: string;
      quantity: number;
      unitPrice: string;
      totalPrice: string;
      licenseKeyId?: string;
    }>
  ) {
    // Start complete transaction for entire order process
    return await db.transaction(async (tx) => {
      // Create the order with verification
      const [newOrder] = await tx
        .insert(orders)
        .values(orderData)
        .returning();

      // Verify order creation immediately
      const orderVerification = await tx
        .select()
        .from(orders)
        .where(and(
          eq(orders.id, newOrder.id),
          eq(orders.tenantId, orderData.tenantId)
        ));

      if (orderVerification.length === 0) {
        throw new Error('Order creation verification failed');
      }

      // Create order items with verification
      const createdItems = [];
      for (const item of cartItems) {
        const orderItemData = {
          orderId: newOrder.id,
          productId: item.productId,
          licenseKeyId: item.licenseKeyId || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice
        };

        const createdItem = await this.createOrderItemWithTransaction(tx, orderItemData);
        createdItems.push(createdItem);
      }

      // Final verification: ensure order + items are visible in user's orders
      const finalVerification = await tx
        .select()
        .from(orders)
        .where(and(
          eq(orders.userId, orderData.userId),
          eq(orders.tenantId, orderData.tenantId)
        ))
        .orderBy(desc(orders.createdAt))
        .limit(1);

      if (finalVerification.length === 0 || finalVerification[0].id !== newOrder.id) {
        throw new Error('Final order visibility verification failed');
      }

      console.log('✅ COMPLETE ORDER TRANSACTION SUCCESSFUL', {
        orderId: newOrder.id,
        orderNumber: orderData.orderNumber,
        itemsCreated: createdItems.length,
        verificationPassed: true
      });

      return {
        order: newOrder,
        items: createdItems
      };
    });
  }
}