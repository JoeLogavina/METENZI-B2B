import { db } from '../db';
import { orderCounters } from '@shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Generate the next sequential order number in format ORD-XXXXXX
 * Uses atomic database increment to ensure uniqueness in concurrent scenarios
 */
export async function generateNextOrderNumber(): Promise<string> {
  try {
    // Use PostgreSQL's atomic increment to handle concurrency
    const result = await db
      .insert(orderCounters)
      .values({ id: 'main' })
      .onConflictDoUpdate({
        target: orderCounters.id,
        set: {
          lastOrderNumber: sql`${orderCounters.lastOrderNumber} + 1`,
          updatedAt: sql`now()`
        }
      })
      .returning({ orderNumber: orderCounters.lastOrderNumber });

    const nextOrderNumber = result[0].orderNumber + 1;
    return `ORD-${nextOrderNumber.toString().padStart(6, '0')}`;
  } catch (error) {
    console.error('Error generating order number:', error);
    
    // Fallback to timestamp-based format in case of database issues
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `ORD-${timestamp}-${randomSuffix}`;
  }
}