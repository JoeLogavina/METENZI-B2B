#!/usr/bin/env node

/**
 * Performance Validation Script
 * Monitors database query performance and identifies potential bottlenecks
 */

import { db } from '../server/db.ts';
import { users, products, orders, categories, licenseKeys } from '../shared/schema.ts';
import { eq, and, sql } from 'drizzle-orm';

async function validatePerformance() {
  console.log('⚡ Starting performance validation...');

  const performanceResults = [];

  try {
    // Test 1: User Query Performance
    console.log('👥 Testing user query performance...');
    const userStartTime = performance.now();
    const userCount = await db.select({ count: sql`count(*)` }).from(users);
    const userEndTime = performance.now();
    const userQueryTime = userEndTime - userStartTime;
    
    performanceResults.push({
      test: 'User Count Query',
      time: userQueryTime,
      status: userQueryTime < 100 ? 'GOOD' : userQueryTime < 500 ? 'ACCEPTABLE' : 'SLOW',
      count: userCount[0].count
    });

    // Test 2: Product Query Performance
    console.log('📦 Testing product query performance...');
    const productStartTime = performance.now();
    const productCount = await db.select({ count: sql`count(*)` }).from(products);
    const productEndTime = performance.now();
    const productQueryTime = productEndTime - productStartTime;
    
    performanceResults.push({
      test: 'Product Count Query',
      time: productQueryTime,
      status: productQueryTime < 100 ? 'GOOD' : productQueryTime < 500 ? 'ACCEPTABLE' : 'SLOW',
      count: productCount[0].count
    });

    // Test 3: Complex Join Query Performance
    console.log('🔗 Testing complex join query performance...');
    const joinStartTime = performance.now();
    const complexQuery = await db
      .select({
        orderCount: sql`count(distinct ${orders.id})`,
        productCount: sql`count(distinct ${products.id})`,
        userCount: sql`count(distinct ${users.id})`
      })
      .from(users)
      .leftJoin(orders, eq(users.id, orders.userId))
      .leftJoin(products, eq(products.categoryId, categories.id))
      .limit(1);
    const joinEndTime = performance.now();
    const joinQueryTime = joinEndTime - joinStartTime;
    
    performanceResults.push({
      test: 'Complex Join Query',
      time: joinQueryTime,
      status: joinQueryTime < 200 ? 'GOOD' : joinQueryTime < 1000 ? 'ACCEPTABLE' : 'SLOW',
      result: complexQuery[0]
    });

    // Test 4: Index Usage Validation
    console.log('📊 Validating database indexes...');
    const indexQuery = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);
    
    const indexCount = indexQuery.rows.length;
    performanceResults.push({
      test: 'Database Indexes',
      count: indexCount,
      status: indexCount > 10 ? 'GOOD' : indexCount > 5 ? 'ACCEPTABLE' : 'NEEDS_IMPROVEMENT'
    });

    // Test 5: Connection Pool Performance
    console.log('🔄 Testing connection pool performance...');
    const connectionStartTime = performance.now();
    const connectionPromises = Array.from({ length: 5 }, () => 
      db.select({ count: sql`1` }).from(users).limit(1)
    );
    await Promise.all(connectionPromises);
    const connectionEndTime = performance.now();
    const connectionTime = connectionEndTime - connectionStartTime;
    
    performanceResults.push({
      test: 'Connection Pool (5 concurrent)',
      time: connectionTime,
      status: connectionTime < 500 ? 'GOOD' : connectionTime < 1500 ? 'ACCEPTABLE' : 'SLOW'
    });

    // Display Results
    console.log('\n📊 Performance Validation Results:');
    console.log('═'.repeat(60));
    
    performanceResults.forEach(result => {
      const statusIcon = result.status === 'GOOD' ? '✅' : 
                        result.status === 'ACCEPTABLE' ? '⚠️' : '❌';
      
      console.log(`${statusIcon} ${result.test}`);
      if (result.time) {
        console.log(`   Time: ${result.time.toFixed(2)}ms`);
      }
      if (result.count) {
        console.log(`   Count: ${result.count}`);
      }
      if (result.result) {
        console.log(`   Result: ${JSON.stringify(result.result)}`);
      }
      console.log(`   Status: ${result.status}`);
      console.log('');
    });

    // Performance Recommendations
    const slowTests = performanceResults.filter(r => r.status === 'SLOW');
    if (slowTests.length > 0) {
      console.log('🚨 Performance Recommendations:');
      slowTests.forEach(test => {
        console.log(`   • Optimize ${test.test} - currently ${test.time?.toFixed(2)}ms`);
      });
      console.log('   • Consider adding database indexes');
      console.log('   • Review query optimization opportunities');
    } else {
      console.log('✅ All performance tests passed - system ready for support integration');
    }

    return slowTests.length === 0;

  } catch (error) {
    console.error('❌ Performance validation failed:', error.message);
    return false;
  }
}

// Run validation if called directly
import { fileURLToPath } from 'url';

if (import.meta.url === `file://${process.argv[1]}`) {
  validatePerformance().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

export { validatePerformance };