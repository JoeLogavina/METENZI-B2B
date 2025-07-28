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
  private static tenantContextCache = new Map<string, { tenantId: string; userRole: string; setAt: number }>();
  private static CONTEXT_CACHE_TTL = 60000; // 1 minute

  /**
   * Set tenant context for RLS policies with caching optimization
   */
  private async setTenantContext(tenantId: string, userRole: string = 'b2b_user'): Promise<void> {
    const cacheKey = `${tenantId}:${userRole}`;
    const cached = OrderService.tenantContextCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.setAt) < OrderService.CONTEXT_CACHE_TTL) {
      return;
    }

    await db.execute(sql`SELECT set_tenant_context(${tenantId}, ${userRole})`);
    
    OrderService.tenantContextCache.set(cacheKey, {
      tenantId,
      userRole,
      setAt: Date.now()
    });
  }

  /**
   * Get orders for a specific user with proper tenant isolation
   */
  async getUserOrders(userId: string, tenantId: string): Promise<OrderData[]> {
    await this.setTenantContext(tenantId);

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
    await this.setTenantContext('admin', adminRole);

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
   * Create a new order with proper tenant isolation
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
    await this.setTenantContext(orderData.tenantId);

    const [newOrder] = await db
      .insert(orders)
      .values(orderData)
      .returning();

    return newOrder;
  }
}