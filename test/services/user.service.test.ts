import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { UserServiceImpl } from '../../server/services/user.service'
import { DatabaseStorage } from '../../server/storage'
import { setupTestDatabase, cleanupTestDatabase, createTestUser, testDb } from '../helpers/test-db'
import { ConflictError, NotFoundError, ValidationError, ForbiddenError } from '../../server/services/errors'

describe('UserService', () => {
  let userService: UserServiceImpl
  let storage: DatabaseStorage

  beforeEach(async () => {
    await setupTestDatabase()
    storage = new DatabaseStorage()
    userService = new UserServiceImpl(storage)
  })

  afterEach(async () => {
    await cleanupTestDatabase()
  })

  describe('getAllUsers', () => {
    it('should return paginated users with metadata', async () => {
      // Create test users
      await createTestUser({ username: 'user1', role: 'b2b_user' })
      await createTestUser({ username: 'user2', role: 'admin' })
      await createTestUser({ username: 'user3', role: 'b2b_user', isActive: false })

      const result = await userService.getAllUsers({
        page: 1,
        limit: 10,
        role: undefined,
        isActive: undefined,
        search: undefined
      })

      expect(result.data).toHaveLength(3)
      expect(result.pagination.total).toBe(3)
      expect(result.pagination.page).toBe(1)
      expect(result.meta.totalUsers).toBe(3)
      expect(result.meta.activeUsers).toBe(2)
      expect(result.meta.usersByRole.b2b_user).toBe(2)
      expect(result.meta.usersByRole.admin).toBe(1)
    })

    it('should filter users by role', async () => {
      await createTestUser({ username: 'b2buser', role: 'b2b_user' })
      await createTestUser({ username: 'adminuser', role: 'admin' })

      const result = await userService.getAllUsers({
        page: 1,
        limit: 10,
        role: 'b2b_user',
        isActive: undefined,
        search: undefined
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].role).toBe('b2b_user')
    })

    it('should filter users by active status', async () => {
      await createTestUser({ username: 'active', isActive: true })
      await createTestUser({ username: 'inactive', isActive: false })

      const result = await userService.getAllUsers({
        page: 1,
        limit: 10,
        role: undefined,
        isActive: true,
        search: undefined
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].isActive).toBe(true)
    })

    it('should search users by username or email', async () => {
      await createTestUser({ username: 'johnsmith', email: 'john@example.com' })
      await createTestUser({ username: 'janedoe', email: 'jane@example.com' })

      const result = await userService.getAllUsers({
        page: 1,
        limit: 10,
        role: undefined,
        isActive: undefined,
        search: 'john'
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].username).toBe('johnsmith')
    })
  })

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        username: 'newuser',
        password: 'password123',
        email: 'newuser@example.com',
        role: 'b2b_user' as const
      }

      const result = await userService.createUser(userData)

      expect(result.username).toBe('newuser')
      expect(result.email).toBe('newuser@example.com')
      expect(result.role).toBe('b2b_user')
      expect(result.isActive).toBe(true)
      // Password should be hashed, not plain text
      expect(result.password).not.toBe('password123')
    })

    it('should throw ConflictError for duplicate username', async () => {
      await createTestUser({ username: 'existing' })

      const userData = {
        username: 'existing',
        password: 'password123',
        email: 'new@example.com',
        role: 'b2b_user' as const
      }

      await expect(userService.createUser(userData)).rejects.toThrow(ConflictError)
    })

    it('should throw ConflictError for duplicate email', async () => {
      await createTestUser({ email: 'existing@example.com' })

      const userData = {
        username: 'newuser',
        password: 'password123',
        email: 'existing@example.com',
        role: 'b2b_user' as const
      }

      await expect(userService.createUser(userData)).rejects.toThrow(ConflictError)
    })

    it('should validate password strength', async () => {
      const userData = {
        username: 'newuser',
        password: '123', // Too weak
        email: 'newuser@example.com',
        role: 'b2b_user' as const
      }

      await expect(userService.createUser(userData)).rejects.toThrow(ValidationError)
    })
  })

  describe('updateUserRole', () => {
    it('should update user role successfully', async () => {
      const user = await createTestUser({ role: 'b2b_user' })
      const adminUser = await createTestUser({ role: 'super_admin' })

      await userService.updateUserRole(user.id, 'admin', adminUser.id)

      const updatedUser = await storage.getUser(user.id)
      expect(updatedUser?.role).toBe('admin')
    })

    it('should prevent non-super_admin from creating super_admin', async () => {
      const user = await createTestUser({ role: 'b2b_user' })
      const adminUser = await createTestUser({ role: 'admin' })

      await expect(
        userService.updateUserRole(user.id, 'super_admin', adminUser.id)
      ).rejects.toThrow(ForbiddenError)
    })

    it('should prevent users from changing their own role', async () => {
      const user = await createTestUser({ role: 'admin' })

      await expect(
        userService.updateUserRole(user.id, 'super_admin', user.id)
      ).rejects.toThrow(ForbiddenError)
    })
  })

  describe('deactivateUser', () => {
    it('should deactivate user successfully', async () => {
      const user = await createTestUser({ isActive: true })
      const adminUser = await createTestUser({ role: 'super_admin' })

      await userService.deactivateUser(user.id, adminUser.id)

      const updatedUser = await storage.getUser(user.id)
      expect(updatedUser?.isActive).toBe(false)
    })

    it('should prevent users from deactivating themselves', async () => {
      const user = await createTestUser({ role: 'admin' })

      await expect(
        userService.deactivateUser(user.id, user.id)
      ).rejects.toThrow(ForbiddenError)
    })

    it('should throw NotFoundError for non-existent user', async () => {
      const adminUser = await createTestUser({ role: 'super_admin' })

      await expect(
        userService.deactivateUser('non-existent', adminUser.id)
      ).rejects.toThrow(NotFoundError)
    })
  })

  describe('getUserAnalytics', () => {
    it('should return comprehensive user analytics', async () => {
      // Create test data
      const now = new Date()
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

      await createTestUser({ role: 'b2b_user', isActive: true, createdAt: thisMonth })
      await createTestUser({ role: 'admin', isActive: true, createdAt: thisMonth })
      await createTestUser({ role: 'b2b_user', isActive: false, createdAt: lastMonth })

      const analytics = await userService.getUserAnalytics()

      expect(analytics.totalUsers).toBe(3)
      expect(analytics.activeUsers).toBe(2)
      expect(analytics.usersByRole.b2b_user).toBe(2)
      expect(analytics.usersByRole.admin).toBe(1)
      expect(analytics.recentRegistrations).toBeGreaterThan(0)
      expect(analytics.userGrowth.thisMonth).toBeGreaterThan(0)
    })
  })
})