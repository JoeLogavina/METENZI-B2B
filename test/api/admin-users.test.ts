import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import express from 'express'
import { registerRoutes } from '@server/routes'
import { setupTestDatabase, cleanupTestDatabase, createTestUser } from '../helpers/test-db'

describe('Admin Users API', () => {
  let app: Express
  let superAdminUser: any
  let adminUser: any
  let b2bUser: any

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
    // Create test users for each test
    superAdminUser = await createTestUser({ 
      username: 'superadmin', 
      role: 'super_admin',
      password: 'test-hash' 
    })
    adminUser = await createTestUser({ 
      username: 'admin', 
      role: 'admin',
      password: 'test-hash' 
    })
    b2bUser = await createTestUser({ 
      username: 'b2buser', 
      role: 'b2b_user',
      password: 'test-hash' 
    })
  })

  afterEach(async () => {
    await cleanupTestDatabase()
  })

  describe('GET /api/admin/users', () => {
    it('should return users for admin', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminUser.id}`)
        .expect(200)

      expect(response.body.data).toHaveLength(3) // superadmin, admin, b2buser
      expect(response.body.pagination).toBeDefined()
      expect(response.body.meta.totalUsers).toBe(3)
      expect(response.body.meta.usersByRole).toBeDefined()
    })

    it('should deny access to B2B users', async () => {
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${b2bUser.id}`)
        .expect(403)
    })

    it('should filter users by role', async () => {
      const response = await request(app)
        .get('/api/admin/users?role=b2b_user')
        .set('Authorization', `Bearer ${adminUser.id}`)
        .expect(200)

      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].role).toBe('b2b_user')
    })

    it('should filter users by active status', async () => {
      // Deactivate one user first
      await createTestUser({ 
        username: 'inactive', 
        role: 'b2b_user',
        isActive: false 
      })

      const response = await request(app)
        .get('/api/admin/users?isActive=true')
        .set('Authorization', `Bearer ${adminUser.id}`)
        .expect(200)

      const activeUsers = response.body.data.filter((user: any) => user.isActive === true)
      expect(activeUsers).toHaveLength(response.body.data.length)
    })

    it('should search users by username', async () => {
      const response = await request(app)
        .get('/api/admin/users?search=b2buser')
        .set('Authorization', `Bearer ${adminUser.id}`)
        .expect(200)

      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].username).toBe('b2buser')
    })
  })

  describe('POST /api/admin/users', () => {
    it('should create new user successfully', async () => {
      const userData = {
        username: 'newuser',
        password: 'securepassword123',
        email: 'newuser@example.com',
        role: 'b2b_user',
        firstName: 'New',
        lastName: 'User'
      }

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminUser.id}`)
        .send(userData)
        .expect(201)

      expect(response.body.data.username).toBe('newuser')
      expect(response.body.data.email).toBe('newuser@example.com')
      expect(response.body.data.role).toBe('b2b_user')
      expect(response.body.data.password).not.toBe('securepassword123') // Should be hashed
      expect(response.body.message).toBe('User created successfully')
    })

    it('should validate required fields', async () => {
      const invalidData = {
        username: 'incomplete'
        // Missing required fields
      }

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminUser.id}`)
        .send(invalidData)
        .expect(400)

      expect(response.body.error).toBe('VALIDATION_ERROR')
    })

    it('should prevent duplicate username', async () => {
      const userData = {
        username: 'b2buser', // Already exists
        password: 'password123',
        email: 'different@example.com',
        role: 'b2b_user'
      }

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminUser.id}`)
        .send(userData)
        .expect(409)

      expect(response.body.error).toBe('CONFLICT')
    })

    it('should validate password strength', async () => {
      const userData = {
        username: 'weakpass',
        password: '123', // Too weak
        email: 'weak@example.com',
        role: 'b2b_user'
      }

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminUser.id}`)
        .send(userData)
        .expect(400)

      expect(response.body.error).toBe('VALIDATION_ERROR')
    })

    it('should deny access to B2B users', async () => {
      const userData = {
        username: 'denied',
        password: 'password123',
        email: 'denied@example.com',
        role: 'b2b_user'
      }

      await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${b2bUser.id}`)
        .send(userData)
        .expect(403)
    })
  })

  describe('PUT /api/admin/users/:id/role', () => {
    it('should update user role successfully', async () => {
      const userData = {
        role: 'admin'
      }

      const response = await request(app)
        .put(`/api/admin/users/${b2bUser.id}/role`)
        .set('Authorization', `Bearer ${superAdminUser.id}`)
        .send(userData)
        .expect(200)

      expect(response.body.message).toBe('User role updated to admin successfully')
    })

    it('should prevent non-super_admin from creating super_admin', async () => {
      const userData = {
        role: 'super_admin'
      }

      const response = await request(app)
        .put(`/api/admin/users/${b2bUser.id}/role`)
        .set('Authorization', `Bearer ${adminUser.id}`)
        .send(userData)
        .expect(403)

      expect(response.body.error).toBe('FORBIDDEN')
    })

    it('should prevent users from changing their own role', async () => {
      const userData = {
        role: 'super_admin'
      }

      const response = await request(app)
        .put(`/api/admin/users/${adminUser.id}/role`)
        .set('Authorization', `Bearer ${adminUser.id}`)
        .send(userData)
        .expect(403)

      expect(response.body.error).toBe('FORBIDDEN')
    })

    it('should return 404 for non-existent user', async () => {
      const userData = {
        role: 'admin'
      }

      await request(app)
        .put('/api/admin/users/non-existent-id/role')
        .set('Authorization', `Bearer ${superAdminUser.id}`)
        .send(userData)
        .expect(404)
    })
  })

  describe('PATCH /api/admin/users/:id/deactivate', () => {
    it('should deactivate user successfully', async () => {
      const response = await request(app)
        .patch(`/api/admin/users/${b2bUser.id}/deactivate`)
        .set('Authorization', `Bearer ${adminUser.id}`)
        .expect(200)

      expect(response.body.message).toBe('User deactivated successfully')
    })

    it('should prevent users from deactivating themselves', async () => {
      const response = await request(app)
        .patch(`/api/admin/users/${adminUser.id}/deactivate`)
        .set('Authorization', `Bearer ${adminUser.id}`)
        .expect(403)

      expect(response.body.error).toBe('FORBIDDEN')
    })

    it('should return 404 for non-existent user', async () => {
      await request(app)
        .patch('/api/admin/users/non-existent-id/deactivate')
        .set('Authorization', `Bearer ${adminUser.id}`)
        .expect(404)
    })
  })

  describe('GET /api/admin/users/analytics', () => {
    it('should return user analytics', async () => {
      const response = await request(app)
        .get('/api/admin/users/analytics')
        .set('Authorization', `Bearer ${adminUser.id}`)
        .expect(200)

      expect(response.body.data.totalUsers).toBe(3)
      expect(response.body.data.activeUsers).toBe(3)
      expect(response.body.data.usersByRole).toBeDefined()
      expect(response.body.data.usersByRole.super_admin).toBe(1)
      expect(response.body.data.usersByRole.admin).toBe(1)
      expect(response.body.data.usersByRole.b2b_user).toBe(1)
      expect(response.body.data.userGrowth).toBeDefined()
    })

    it('should deny access to B2B users', async () => {
      await request(app)
        .get('/api/admin/users/analytics')
        .set('Authorization', `Bearer ${b2bUser.id}`)
        .expect(403)
    })
  })
})