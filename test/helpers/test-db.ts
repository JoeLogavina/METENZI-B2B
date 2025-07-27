import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import * as schema from '@shared/schema'
import { sql } from 'drizzle-orm'

let testDb: ReturnType<typeof drizzle>
let testPool: Pool

export async function setupTestDatabase() {
  // Use test database URL or create in-memory DB for testing
  const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
  
  if (!testDbUrl) {
    throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set for testing')
  }

  testPool = new Pool({ connectionString: testDbUrl })
  testDb = drizzle({ client: testPool, schema })

  return testDb
}

export async function cleanupTestDatabase() {
  if (!testDb) return

  try {
    // Clean up test data in reverse dependency order
    await testDb.execute(sql`TRUNCATE TABLE cart_items CASCADE`)
    await testDb.execute(sql`TRUNCATE TABLE license_keys CASCADE`)
    await testDb.execute(sql`TRUNCATE TABLE orders CASCADE`)
    await testDb.execute(sql`TRUNCATE TABLE products CASCADE`)
    await testDb.execute(sql`TRUNCATE TABLE categories CASCADE`)
    await testDb.execute(sql`TRUNCATE TABLE users CASCADE`)
    await testDb.execute(sql`TRUNCATE TABLE sessions CASCADE`)
  } catch (error) {
    console.warn('Error cleaning test database:', error)
  }
}

export async function createTestUser(userData: Partial<typeof schema.users.$inferInsert> = {}) {
  const defaultUser = {
    id: 'test-user-' + Math.random().toString(36).substr(2, 9),
    username: 'testuser-' + Math.random().toString(36).substr(2, 6),
    password: 'test-password-hash',
    email: 'test@example.com',
    role: 'b2b_user' as const,
    isActive: true,
    ...userData
  }

  const [user] = await testDb.insert(schema.users).values(defaultUser).returning()
  return user
}

export async function createTestProduct(productData: Partial<typeof schema.products.$inferInsert> = {}) {
  const defaultProduct = {
    id: 'test-product-' + Math.random().toString(36).substr(2, 9),
    sku: 'TEST-SKU-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
    name: 'Test Product',
    description: 'Test product description',
    price: '99.99',
    region: 'Global',
    platform: 'Both',
    isActive: true,
    stockCount: '10',
    ...productData
  }

  const [product] = await testDb.insert(schema.products).values(defaultProduct).returning()
  return product
}

export async function createTestCategory(categoryData: Partial<typeof schema.categories.$inferInsert> = {}) {
  const defaultCategory = {
    id: 'test-category-' + Math.random().toString(36).substr(2, 9),
    name: 'Test Category',
    description: 'Test category description',
    ...categoryData
  }

  const [category] = await testDb.insert(schema.categories).values(defaultCategory).returning()
  return category
}

export { testDb }