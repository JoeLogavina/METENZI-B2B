import { describe, it, expect } from 'vitest'

// Basic utility functions for testing business logic
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePassword(password: string): boolean {
  return password.length >= 6 && /\d/.test(password)
}

export function calculateProductTotal(products: Array<{ price: string; quantity: number }>): number {
  return products.reduce((total, product) => {
    return total + (parseFloat(product.price) * product.quantity)
  }, 0)
}

export function formatCurrency(amount: number): string {
  return `€${amount.toFixed(2)}`
}

// Test the utility functions
describe('Business Logic Utils', () => {
  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      expect(validateEmail('user@example.com')).toBe(true)
      expect(validateEmail('test.user+tag@domain.co.uk')).toBe(true)
    })

    it('should reject invalid email formats', () => {
      expect(validateEmail('invalid-email')).toBe(false)
      expect(validateEmail('@domain.com')).toBe(false)
      expect(validateEmail('user@')).toBe(false)
    })
  })

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      expect(validatePassword('password123')).toBe(true)
      expect(validatePassword('secure1')).toBe(true)
    })

    it('should reject weak passwords', () => {
      expect(validatePassword('123')).toBe(false) // Too short
      expect(validatePassword('password')).toBe(false) // No numbers
      expect(validatePassword('12345')).toBe(false) // Too short
    })
  })

  describe('calculateProductTotal', () => {
    it('should calculate correct total for multiple products', () => {
      const products = [
        { price: '99.99', quantity: 2 },
        { price: '199.99', quantity: 1 },
        { price: '49.99', quantity: 3 }
      ]
      
      const total = calculateProductTotal(products)
      expect(total).toBe(549.95) // (99.99*2) + (199.99*1) + (49.99*3)
    })

    it('should handle empty product list', () => {
      expect(calculateProductTotal([])).toBe(0)
    })

    it('should handle single product', () => {
      const products = [{ price: '99.99', quantity: 1 }]
      expect(calculateProductTotal(products)).toBe(99.99)
    })
  })

  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      expect(formatCurrency(99.99)).toBe('€99.99')
      expect(formatCurrency(1000)).toBe('€1000.00')
      expect(formatCurrency(0)).toBe('€0.00')
    })

    it('should handle decimal precision', () => {
      expect(formatCurrency(99.9)).toBe('€99.90')
      expect(formatCurrency(99.999)).toBe('€100.00')
    })
  })
})