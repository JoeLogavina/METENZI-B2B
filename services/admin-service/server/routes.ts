import type { Express } from "express";
import { createServer, type Server } from "http";
import { requireAdmin } from "./auth";
import { apiClient } from "./api-client";

export function registerAdminRoutes(app: Express): Server {
  // Admin dashboard stats
  app.get('/api/admin/dashboard/stats', requireAdmin, async (req, res) => {
    try {
      const [products, users, orders] = await Promise.all([
        apiClient.get('/api/core/products/count'),
        apiClient.get('/api/core/users/count'),
        apiClient.get('/api/core/orders/count'),
      ]);
      
      res.json({
        totalProducts: products.count,
        totalUsers: users.count,
        totalOrders: orders.count,
        totalRevenue: orders.revenue || 0,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Admin product management routes
  app.get('/api/admin/products', requireAdmin, async (req, res) => {
    try {
      const products = await apiClient.get('/api/core/products/all');
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.post('/api/admin/products', requireAdmin, async (req, res) => {
    try {
      const product = await apiClient.post('/api/core/products', req.body);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
    try {
      const product = await apiClient.put(`/api/core/products/${req.params.id}`, req.body);
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
    try {
      await apiClient.delete(`/api/core/products/${req.params.id}`);
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // Admin user management routes
  app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
      const users = await apiClient.get('/api/core/users');
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
    try {
      const user = await apiClient.put(`/api/core/users/${req.params.id}`, req.body);
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Admin orders management
  app.get('/api/admin/orders', requireAdmin, async (req, res) => {
    try {
      const orders = await apiClient.get('/api/core/orders');
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.put('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
    try {
      const order = await apiClient.patch(`/api/core/orders/${req.params.id}`, {
        status: req.body.status,
      });
      res.json(order);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  // Admin license key management
  app.get('/api/admin/license-keys', requireAdmin, async (req, res) => {
    try {
      const keys = await apiClient.get('/api/core/licenses');
      res.json(keys);
    } catch (error) {
      console.error("Error fetching license keys:", error);
      res.status(500).json({ message: "Failed to fetch license keys" });
    }
  });

  app.post('/api/admin/license-keys/bulk', requireAdmin, async (req, res) => {
    try {
      const keys = await apiClient.post('/api/core/licenses/bulk', req.body);
      res.json(keys);
    } catch (error) {
      console.error("Error creating license keys:", error);
      res.status(500).json({ message: "Failed to create license keys" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}