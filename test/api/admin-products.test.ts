import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import express from 'express'
import { registerRoutes } from '@server/routes'
import { setupTestDatabase, cleanupTestDatabase, createTestUser, createTestProduct, createTestCategory } from '../helpers/test-db'

describe('Admin Products API', () => {
  let app: Express
  let adminUser: any
  let b2bUser: any
  let category: any

  beforeAll(async () => {
    await setupTestDatabase()
    
    // Create Express app for testing
    app = express()
    app.use(express.json())
    registerRoutes(app)
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  beforeEach(async () => {
    // Create test users and category for each test
    adminUser = await createTestUser({ 
      username: 'testadmin', 
      role: 'super_admin',
      password: 'test-hash' 
    })
    b2bUser = await createTestUser({ 
      username: 'testb2b', 
      role: 'b2b_user',
      password: 'test-hash' 
    })
    category = await createTestCategory({ name: 'Test Software' })
  })

  afterEach(async () => {
    await cleanupTestDatabase()
  })

  describe('GET /api/admin/products', () => {
    it('should return products for admin user', async () => {
      await createTestProduct({ 
        name: 'Test Product', 
        categoryId: category.id,
        price: '99.99'
      })

      const response = await request(app)
        .get('/api/admin/products')
        .set('Authorization', `Bearer ${adminUser.id}`) // Simplified auth for testing
        .expect(200)

      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].name).toBe('Test Product')
      expect(response.body.pagination).toBeDefined()
      expect(response.body.meta).toBeDefined()
    })

    it('should deny access to B2B users', async () => {
      await request(app)
        .get('/api/admin/products')
        .set('Authorization', `Bearer ${b2bUser.id}`)
        .expect(403)
    })

    it('should require authentication', async () => {
      await request(app)
        .get('/api/admin/products')
        .expect(401)
    })

    it('should support pagination', async () => {
      // Create multiple products
      for (let i = 0; i < 5; i++) {
        await createTestProduct({ 
          name: `Product ${i}`, 
          categoryId: category.id,
          sku: `PROD-${i}`
        })
      }

      const response = await request(app)
        .get('/api/admin/products?page=1&limit=3')
        .set('Authorization', `Bearer ${adminUser.id}`)
        .expect(200)

      expect(response.body.data).toHaveLength(3)
      expect(response.body.pagination.page).toBe(1)
      expect(response.body.pagination.limit).toBe(3)
      expect(response.body.pagination.total).toBe(5)
      expect(response.body.pagination.hasNext).toBe(true)
    })

    it('should support search filtering', async () => {
      await createTestProduct({ 
        name: 'Adobe Creative Suite', 
        categoryId: category.id 
      })
      await createTestProduct({ 
        name: 'Microsoft Office', 
        categoryId: category.id 
      })

      const response = await request(app)
        .get('/api/admin/products?search=Adobe')
        .set('Authorization', `Bearer ${adminUser.id}`)
        .expect(200)

      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].name).toBe('Adobe Creative Suite')
    })
  })

  describe('POST /api/admin/products', () => {
    it('should create new product successfully', async () => {
      const productData = {
        sku: 'TEST-PROD-001',
        name: 'New Test Product',
        description: 'A test product',
        price: '199.99',
        categoryId: category.id,
        region: 'Global',
        platform: 'Both'
      }

      const response = await request(app)
        .post('/api/admin/products')
        .set('Authorization', `Bearer ${adminUser.id}`)
        .send(productData)
        .expect(201)

      expect(response.body.data.name).toBe('New Test Product')
      expect(response.body.data.sku).toBe('TEST-PROD-001')
      expect(response.body.data.price).toBe('199.99')
      expect(response.body.message).toBe('Product created successfully')
    })

    it('should validate required fields', async () => {
      const invalidData = {
        name: 'Product without SKU'
        // Missing required fields
      }

      const response = await request(app)
        .post('/api/admin/products')
        .set('Authorization', `Bearer ${adminUser.id}`)
        .send(invalidData)
        .expect(400)

      expect(response.body.error).toBe('VALIDATION_ERROR')
      expect(response.body.details).toBeDefined()
    })

    it('should prevent duplicate SKU', async () => {
      await createTestProduct({ 
        sku: 'DUPLICATE-SKU', 
        categoryId: category.id 
      })

      const productData = {
        sku: 'DUPLICATE-SKU',
        name: 'Duplicate Product',
        description: 'Should fail',
        price: '99.99',
        categoryId: category.id,
        region: 'Global',
        platform: 'Both'
      }

      const response = await request(app)
        .post('/api/admin/products')
        .set('Authorization', `Bearer ${adminUser.id}`)
        .send(productData)
        .expect(409)

      expect(response.body.error).toBe('CONFLICT')
    })

    it('should deny access to B2B users', async () => {
      const productData = {
        sku: 'TEST-DENIED',
        name: 'Should be denied',
        description: 'B2B user attempt',
        price: '99.99',
        categoryId: category.id,
        region: 'Global',
        platform: 'Both'
      }

      await request(app)
        .post('/api/admin/products')
        .set('Authorization', `Bearer ${b2bUser.id}`)
        .send(productData)
        .expect(403)
    })
  })

  describe('PUT /api/admin/products/:id', () => {
    it('should update product successfully', async () => {
      const product = await createTestProduct({ 
        name: 'Original Name',
        price: '100.00',
        categoryId: category.id 
      })

      const updateData = {
        name: 'Updated Name',
        price: '150.00'
      }

      const response = await request(app)
        .put(`/api/admin/products/${product.id}`)
        .set('Authorization', `Bearer ${adminUser.id}`)
        .send(updateData)
        .expect(200)

      expect(response.body.data.name).toBe('Updated Name')
      expect(response.body.data.price).toBe('150.00')
      expect(response.body.message).toBe('Product updated successfully')
    })

    it('should return 404 for non-existent product', async () => {
      const updateData = {
        name: 'Updated Name'
      }

      await request(app)
        .put('/api/admin/products/non-existent-id')
        .set('Authorization', `Bearer ${adminUser.id}`)
        .send(updateData)
        .expect(404)
    })
  })

  describe('PATCH /api/admin/products/:id/toggle-status', () => {
    it('should toggle product status', async () => {
      const product = await createTestProduct({ 
        isActive: true,
        categoryId: category.id 
      })

      const response = await request(app)
        .patch(`/api/admin/products/${product.id}/toggle-status`)
        .set('Authorization', `Bearer ${adminUser.id}`)
        .expect(200)

      expect(response.body.data.isActive).toBe(false)
    })
  })

  describe('GET /api/admin/products/analytics', () => {
    it('should return product analytics', async () => {
      await createTestProduct({ 
        price: '100.00', 
        categoryId: category.id,
        region: 'EU',
        isActive: true 
      })
      await createTestProduct({ 
        price: '200.00', 
        categoryId: category.id,
        region: 'Global',
        isActive: false 
      })

      const response = await request(app)
        .get('/api/admin/products/analytics')
        .set('Authorization', `Bearer ${adminUser.id}`)
        .expect(200)

      expect(response.body.data.totalProducts).toBe(2)
      expect(response.body.data.activeProducts).toBe(1)
      expect(response.body.data.totalValue).toBe(300)
      expect(response.body.data.averagePrice).toBe(150)
      expect(response.body.data.regionDistribution).toBeDefined()
    })
  })

  describe('GET /api/admin/products/low-stock', () => {
    it('should return low stock products', async () => {
      await createTestProduct({ 
        name: 'Low Stock Product',
        stockCount: '2',
        categoryId: category.id 
      })
      await createTestProduct({ 
        name: 'High Stock Product',
        stockCount: '10',
        categoryId: category.id 
      })

      const response = await request(app)
        .get('/api/admin/products/low-stock?threshold=5')
        .set('Authorization', `Bearer ${adminUser.id}`)
        .expect(200)

      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].name).toBe('Low Stock Product')
      expect(response.body.threshold).toBe(5)
    })
  })
})