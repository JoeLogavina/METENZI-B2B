import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ProductServiceImpl } from '../../server/services/product.service'
import { DatabaseStorage } from '../../server/storage'
import { setupTestDatabase, cleanupTestDatabase, createTestProduct, createTestCategory, testDb } from '../helpers/test-db'
import { ValidationError, NotFoundError, ConflictError } from '../../server/services/errors'

describe('ProductService', () => {
  let productService: ProductServiceImpl
  let storage: DatabaseStorage

  beforeEach(async () => {
    await setupTestDatabase()
    storage = new DatabaseStorage()
    productService = new ProductServiceImpl(storage)
  })

  afterEach(async () => {
    await cleanupTestDatabase()
  })

  describe('getAllProducts', () => {
    it('should return paginated products with metadata', async () => {
      const category = await createTestCategory()
      await createTestProduct({ name: 'Product 1', categoryId: category.id, isActive: true, price: '100.00' })
      await createTestProduct({ name: 'Product 2', categoryId: category.id, isActive: false, price: '200.00' })

      const result = await productService.getAllProducts({
        page: 1,
        limit: 10,
        search: undefined,
        region: undefined,
        platform: undefined,
        isActive: undefined
      })

      expect(result.data).toHaveLength(2)
      expect(result.pagination.total).toBe(2)
      expect(result.meta.totalValue).toBe(300) // 100 + 200
      expect(result.meta.activeProducts).toBe(1)
      expect(result.meta.inactiveProducts).toBe(1)
    })

    it('should filter products by search term', async () => {
      const category = await createTestCategory()
      await createTestProduct({ name: 'Adobe Creative Suite', categoryId: category.id })
      await createTestProduct({ name: 'Microsoft Office', categoryId: category.id })

      const result = await productService.getAllProducts({
        page: 1,
        limit: 10,
        search: 'Adobe',
        region: undefined,
        platform: undefined,
        isActive: undefined
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe('Adobe Creative Suite')
    })

    it('should filter products by region', async () => {
      const category = await createTestCategory()
      await createTestProduct({ name: 'EU Product', region: 'EU', categoryId: category.id })
      await createTestProduct({ name: 'Global Product', region: 'Global', categoryId: category.id })

      const result = await productService.getAllProducts({
        page: 1,
        limit: 10,
        search: undefined,
        region: 'EU',
        platform: undefined,
        isActive: undefined
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].region).toBe('EU')
    })

    it('should filter products by platform', async () => {
      const category = await createTestCategory()
      await createTestProduct({ name: 'Windows Product', platform: 'Windows', categoryId: category.id })
      await createTestProduct({ name: 'Cross Platform', platform: 'Both', categoryId: category.id })

      const result = await productService.getAllProducts({
        page: 1,
        limit: 10,
        search: undefined,
        region: undefined,
        platform: 'Windows',
        isActive: undefined
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].platform).toBe('Windows')
    })
  })

  describe('createProduct', () => {
    it('should create a new product successfully', async () => {
      const category = await createTestCategory()
      const productData = {
        sku: 'TEST-PROD-001',
        name: 'Test Product',
        description: 'A test product',
        price: '99.99',
        categoryId: category.id,
        region: 'Global',
        platform: 'Both'
      }

      const result = await productService.createProduct(productData)

      expect(result.sku).toBe('TEST-PROD-001')
      expect(result.name).toBe('Test Product')
      expect(result.price).toBe('99.99')
      expect(result.isActive).toBe(true)
    })

    it('should throw ConflictError for duplicate SKU', async () => {
      const category = await createTestCategory()
      await createTestProduct({ sku: 'DUPLICATE-SKU', categoryId: category.id })

      const productData = {
        sku: 'DUPLICATE-SKU',
        name: 'Another Product',
        description: 'Different product',
        price: '199.99',
        categoryId: category.id,
        region: 'Global',
        platform: 'Both'
      }

      await expect(productService.createProduct(productData)).rejects.toThrow(ConflictError)
    })

    it('should validate price is positive', async () => {
      const category = await createTestCategory()
      const productData = {
        sku: 'TEST-PROD-002',
        name: 'Test Product',
        description: 'A test product',
        price: '-10.00', // Invalid negative price
        categoryId: category.id,
        region: 'Global',
        platform: 'Both'
      }

      await expect(productService.createProduct(productData)).rejects.toThrow(ValidationError)
    })

    it('should validate price is not too high', async () => {
      const category = await createTestCategory()
      const productData = {
        sku: 'TEST-PROD-003',
        name: 'Expensive Product',
        description: 'Very expensive',
        price: '50000.00', // Too expensive
        categoryId: category.id,
        region: 'Global',
        platform: 'Both'
      }

      await expect(productService.createProduct(productData)).rejects.toThrow(ValidationError)
    })
  })

  describe('updateProduct', () => {
    it('should update product successfully', async () => {
      const category = await createTestCategory()
      const product = await createTestProduct({ 
        name: 'Original Name',
        price: '100.00',
        categoryId: category.id 
      })

      const updateData = {
        name: 'Updated Name',
        price: '150.00'
      }

      const result = await productService.updateProduct(product.id, updateData)

      expect(result.name).toBe('Updated Name')
      expect(result.price).toBe('150.00')
    })

    it('should throw NotFoundError for non-existent product', async () => {
      const updateData = {
        name: 'Updated Name'
      }

      await expect(
        productService.updateProduct('non-existent-id', updateData)
      ).rejects.toThrow(NotFoundError)
    })

    it('should validate price on update', async () => {
      const category = await createTestCategory()
      const product = await createTestProduct({ categoryId: category.id })

      const updateData = {
        price: '-50.00'
      }

      await expect(
        productService.updateProduct(product.id, updateData)
      ).rejects.toThrow(ValidationError)
    })
  })

  describe('toggleProductStatus', () => {
    it('should activate inactive product', async () => {
      const category = await createTestCategory()
      const product = await createTestProduct({ 
        isActive: false,
        categoryId: category.id 
      })

      const result = await productService.toggleProductStatus(product.id)

      expect(result.isActive).toBe(true)
    })

    it('should deactivate active product', async () => {
      const category = await createTestCategory()
      const product = await createTestProduct({ 
        isActive: true,
        categoryId: category.id 
      })

      const result = await productService.toggleProductStatus(product.id)

      expect(result.isActive).toBe(false)
    })

    it('should throw NotFoundError for non-existent product', async () => {
      await expect(
        productService.toggleProductStatus('non-existent-id')
      ).rejects.toThrow(NotFoundError)
    })
  })

  describe('getProductAnalytics', () => {
    it('should return comprehensive product analytics', async () => {
      const category1 = await createTestCategory({ name: 'Software' })
      const category2 = await createTestCategory({ name: 'Tools' })

      await createTestProduct({ 
        categoryId: category1.id, 
        price: '100.00', 
        region: 'EU',
        isActive: true 
      })
      await createTestProduct({ 
        categoryId: category2.id, 
        price: '200.00', 
        region: 'Global',
        isActive: true 
      })
      await createTestProduct({ 
        categoryId: category1.id, 
        price: '150.00', 
        region: 'EU',
        isActive: false 
      })

      const analytics = await productService.getProductAnalytics()

      expect(analytics.totalProducts).toBe(3)
      expect(analytics.activeProducts).toBe(2)
      expect(analytics.totalValue).toBe(450) // 100 + 200 + 150
      expect(analytics.averagePrice).toBe(150) // 450 / 3
      expect(analytics.regionDistribution.EU).toBe(2)
      expect(analytics.regionDistribution.Global).toBe(1)
    })
  })

  describe('getLowStockProducts', () => {
    it('should return products below threshold', async () => {
      const category = await createTestCategory()
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

      const result = await productService.getLowStockProducts(5)

      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe('Low Stock Product')
      expect(result.threshold).toBe(5)
      expect(result.count).toBe(1)
    })
  })
})