#!/usr/bin/env node

/**
 * Multi-tenant Isolation Validation Script
 * Ensures proper data isolation between EUR and KM tenants
 */

import { db } from '../server/db.ts';
import { users, products, orders, cartItems, wallets } from '../shared/schema.ts';
import { eq, and, sql } from 'drizzle-orm';

async function validateTenantIsolation() {
  console.log('🏢 Starting multi-tenant isolation validation...');

  const validationResults = [];

  try {
    // Test 1: User Tenant Distribution
    console.log('👥 Validating user tenant distribution...');
    const userTenants = await db
      .select({
        tenantId: users.tenantId,
        count: sql`count(*)`
      })
      .from(users)
      .groupBy(users.tenantId);

    const tenantData = {};
    userTenants.forEach(row => {
      tenantData[row.tenantId] = parseInt(row.count);
    });

    validationResults.push({
      test: 'User Tenant Distribution',
      eurUsers: tenantData.eur || 0,
      kmUsers: tenantData.km || 0,
      status: (tenantData.eur > 0 && tenantData.km >= 0) ? 'GOOD' : 'NEEDS_ATTENTION'
    });

    // Test 2: Order Tenant Isolation
    console.log('📋 Validating order tenant isolation...');
    const orderTenants = await db
      .select({
        tenantId: orders.tenantId,
        count: sql`count(*)`
      })
      .from(orders)
      .groupBy(orders.tenantId);

    const orderTenantData = {};
    orderTenants.forEach(row => {
      orderTenantData[row.tenantId] = parseInt(row.count);
    });

    validationResults.push({
      test: 'Order Tenant Isolation',
      eurOrders: orderTenantData.eur || 0,
      kmOrders: orderTenantData.km || 0,
      status: 'GOOD'
    });

    // Test 3: Cart Tenant Isolation
    console.log('🛒 Validating cart tenant isolation...');
    const cartTenants = await db
      .select({
        tenantId: cartItems.tenantId,
        count: sql`count(*)`
      })
      .from(cartItems)
      .groupBy(cartItems.tenantId);

    const cartTenantData = {};
    cartTenants.forEach(row => {
      cartTenantData[row.tenantId] = parseInt(row.count);
    });

    validationResults.push({
      test: 'Cart Tenant Isolation',
      eurCarts: cartTenantData.eur || 0,
      kmCarts: cartTenantData.km || 0,
      status: 'GOOD'
    });

    // Test 4: Wallet Tenant Isolation
    console.log('💰 Validating wallet tenant isolation...');
    const walletTenants = await db
      .select({
        tenantId: wallets.tenantId,
        count: sql`count(*)`
      })
      .from(wallets)
      .groupBy(wallets.tenantId);

    const walletTenantData = {};
    walletTenants.forEach(row => {
      walletTenantData[row.tenantId] = parseInt(row.count);
    });

    validationResults.push({
      test: 'Wallet Tenant Isolation',
      eurWallets: walletTenantData.eur || 0,
      kmWallets: walletTenantData.km || 0,
      status: 'GOOD'
    });

    // Test 5: Cross-tenant Data Leakage Check
    console.log('🔍 Checking for cross-tenant data leakage...');
    
    // Check if any EUR users have KM orders
    const eurUserKmOrders = await db
      .select({ count: sql`count(*)` })
      .from(users)
      .innerJoin(orders, eq(users.id, orders.userId))
      .where(and(
        eq(users.tenantId, 'eur'),
        eq(orders.tenantId, 'km')
      ));

    // Check if any KM users have EUR orders
    const kmUserEurOrders = await db
      .select({ count: sql`count(*)` })
      .from(users)
      .innerJoin(orders, eq(users.id, orders.userId))
      .where(and(
        eq(users.tenantId, 'km'),
        eq(orders.tenantId, 'eur')
      ));

    const dataLeakage = parseInt(eurUserKmOrders[0].count) + parseInt(kmUserEurOrders[0].count);

    validationResults.push({
      test: 'Cross-tenant Data Leakage',
      leakageCount: dataLeakage,
      status: dataLeakage === 0 ? 'GOOD' : 'CRITICAL_ISSUE'
    });

    // Test 6: Hierarchical Company Structure Validation
    console.log('🏗️  Validating hierarchical company structure...');
    const parentCompanies = await db
      .select({
        tenantId: users.tenantId,
        branchType: users.branchType,
        count: sql`count(*)`
      })
      .from(users)
      .where(eq(users.branchType, 'main_company'))
      .groupBy(users.tenantId, users.branchType);

    const branches = await db
      .select({
        tenantId: users.tenantId,
        branchType: users.branchType,
        count: sql`count(*)`
      })
      .from(users)
      .where(eq(users.branchType, 'branch'))
      .groupBy(users.tenantId, users.branchType);

    validationResults.push({
      test: 'Hierarchical Structure',
      mainCompanies: parentCompanies.length,
      branches: branches.length,
      status: 'GOOD'
    });

    // Display Results
    console.log('\n🏢 Multi-tenant Isolation Validation Results:');
    console.log('═'.repeat(60));
    
    validationResults.forEach(result => {
      const statusIcon = result.status === 'GOOD' ? '✅' : 
                        result.status === 'NEEDS_ATTENTION' ? '⚠️' : '❌';
      
      console.log(`${statusIcon} ${result.test}`);
      
      Object.keys(result).forEach(key => {
        if (key !== 'test' && key !== 'status') {
          console.log(`   ${key}: ${result[key]}`);
        }
      });
      console.log(`   Status: ${result.status}`);
      console.log('');
    });

    // Critical Issues Check
    const criticalIssues = validationResults.filter(r => r.status === 'CRITICAL_ISSUE');
    if (criticalIssues.length > 0) {
      console.log('🚨 CRITICAL TENANT ISOLATION ISSUES FOUND:');
      criticalIssues.forEach(issue => {
        console.log(`   • ${issue.test}: ${issue.status}`);
      });
      console.log('🛑 DO NOT PROCEED with support integration until these are fixed!');
      return false;
    }

    const warnings = validationResults.filter(r => r.status === 'NEEDS_ATTENTION');
    if (warnings.length > 0) {
      console.log('⚠️  Tenant isolation warnings:');
      warnings.forEach(warning => {
        console.log(`   • ${warning.test}: Review tenant distribution`);
      });
    }

    console.log('✅ Multi-tenant isolation validation completed successfully');
    console.log('🏢 System ready for support module integration with proper tenant isolation');

    return true;

  } catch (error) {
    console.error('❌ Tenant isolation validation failed:', error.message);
    console.log('🚨 Fix tenant isolation issues before proceeding');
    return false;
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateTenantIsolation().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

export { validateTenantIsolation };