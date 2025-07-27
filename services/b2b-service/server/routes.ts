import type { Express } from "express";
import { createServer, type Server } from "http";
import { requireB2BUser } from "./auth";
import { apiClient } from "./api-client";

export function registerB2BRoutes(app: Express): Server {
  // Public product routes
  app.get('/api/products', async (req, res) => {
    try {
      const { region, platform, category, search, priceMin, priceMax } = req.query;
      const filters = {
        region: region as string,
        platform: platform as string,
        category: category as string,
        search: search as string,
        priceMin: priceMin ? parseFloat(priceMin as string) : undefined,
        priceMax: priceMax ? parseFloat(priceMax as string) : undefined,
        isActive: true, // Only show active products to B2B users
      };
      
      const products = await apiClient.post('/api/core/products/search', filters);
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get('/api/products/:id', async (req, res) => {
    try {
      const product = await apiClient.get(`/api/core/products/${req.params.id}`);
      if (!product || !product.isActive) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  // Categories
  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await apiClient.get('/api/core/categories/active');
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Cart management (local to B2B service)
  app.get('/api/cart', requireB2BUser, async (req: any, res) => {
    try {
      const cartItems = await apiClient.get(`/api/core/cart/${req.user.id}`);
      res.json(cartItems);
    } catch (error) {
      console.error("Error fetching cart:", error);
      res.status(500).json({ message: "Failed to fetch cart" });
    }
  });

  app.post('/api/cart', requireB2BUser, async (req: any, res) => {
    try {
      const cartItem = await apiClient.post('/api/core/cart', {
        userId: req.user.id,
        productId: req.body.productId,
        quantity: req.body.quantity,
      });
      res.status(201).json(cartItem);
    } catch (error) {
      console.error("Error adding to cart:", error);
      res.status(500).json({ message: "Failed to add to cart" });
    }
  });

  app.put('/api/cart/:id', requireB2BUser, async (req: any, res) => {
    try {
      const cartItem = await apiClient.put(`/api/core/cart/${req.params.id}`, {
        userId: req.user.id,
        quantity: req.body.quantity,
      });
      res.json(cartItem);
    } catch (error) {
      console.error("Error updating cart:", error);
      res.status(500).json({ message: "Failed to update cart" });
    }
  });

  app.delete('/api/cart/:id', requireB2BUser, async (req: any, res) => {
    try {
      await apiClient.delete(`/api/core/cart/${req.params.id}?userId=${req.user.id}`);
      res.sendStatus(204);
    } catch (error) {
      console.error("Error removing from cart:", error);
      res.status(500).json({ message: "Failed to remove from cart" });
    }
  });

  // Checkout
  app.post('/api/checkout', requireB2BUser, async (req: any, res) => {
    try {
      const order = await apiClient.post('/api/core/orders', {
        userId: req.user.id,
        paymentMethod: req.body.paymentMethod,
        shippingAddress: req.body.shippingAddress,
        billingAddress: req.body.billingAddress,
      });
      res.status(201).json(order);
    } catch (error) {
      console.error("Error processing checkout:", error);
      res.status(500).json({ message: "Failed to process checkout" });
    }
  });

  // Orders
  app.get('/api/orders', requireB2BUser, async (req: any, res) => {
    try {
      const orders = await apiClient.get(`/api/core/orders/user/${req.user.id}`);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get('/api/orders/:id', requireB2BUser, async (req: any, res) => {
    try {
      const order = await apiClient.get(`/api/core/orders/${req.params.id}?userId=${req.user.id}`);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}