import { beforeAll, afterAll, afterEach } from 'vitest'

// Global test configuration
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.SESSION_SECRET = 'test-secret-key-for-testing-only'
})

afterEach(() => {
  // Clear any mocks or test data after each test
})

afterAll(async () => {
  // Cleanup after all tests
})