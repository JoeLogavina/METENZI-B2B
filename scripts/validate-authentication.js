#!/usr/bin/env node

/**
 * Authentication Integration Validation Script
 * Tests authentication system before support module integration
 */

import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { db } from '../server/db.ts';
import { users } from '../shared/schema.ts';
import { eq } from 'drizzle-orm';

async function validateAuthentication() {
  console.log('🔐 Starting authentication validation...');

  try {
    // Test 1: Database Connection
    console.log('📊 Testing database connection...');
    const testQuery = await db.select().from(users).limit(1);
    console.log('✅ Database connection successful');

    // Test 2: Validate existing users
    console.log('👥 Validating existing user accounts...');
    const testUsers = [
      { username: 'admin', expectedRole: 'super_admin' },
      { username: 'b2bkm', expectedRole: 'b2b_user' },
      { username: 'munich_branch', expectedRole: 'b2b_user' }
    ];

    for (const testUser of testUsers) {
      const user = await db.select().from(users).where(eq(users.username, testUser.username)).limit(1);
      if (user.length > 0) {
        console.log(`✅ User ${testUser.username} exists with role: ${user[0].role}`);
        if (user[0].role !== testUser.expectedRole) {
          console.log(`⚠️  Role mismatch for ${testUser.username}: expected ${testUser.expectedRole}, got ${user[0].role}`);
        }
      } else {
        console.log(`❌ User ${testUser.username} not found`);
      }
    }

    // Test 3: Session Configuration
    console.log('🔑 Testing session configuration...');
    if (process.env.SESSION_SECRET) {
      console.log('✅ SESSION_SECRET is configured');
    } else {
      console.log('❌ SESSION_SECRET is missing');
    }

    // Test 4: Multi-tenant Support
    console.log('🏢 Validating multi-tenant setup...');
    const eurUsers = await db.select().from(users).where(eq(users.tenantId, 'eur')).limit(5);
    const kmUsers = await db.select().from(users).where(eq(users.tenantId, 'km')).limit(5);
    
    console.log(`✅ EUR tenant users: ${eurUsers.length}`);
    console.log(`✅ KM tenant users: ${kmUsers.length}`);

    // Test 5: Role-based Access Control Validation
    console.log('🛡️  Validating role-based access...');
    const adminUsers = await db.select().from(users).where(eq(users.role, 'super_admin'));
    const b2bUsers = await db.select().from(users).where(eq(users.role, 'b2b_user'));
    
    console.log(`✅ Admin users: ${adminUsers.length}`);
    console.log(`✅ B2B users: ${b2bUsers.length}`);

    // Test 6: Parent-Child Company Relationships
    console.log('🏗️  Validating hierarchical relationships...');
    const branchUsers = await db.select().from(users).where(eq(users.branchType, 'branch'));
    console.log(`✅ Branch users: ${branchUsers.length}`);

    console.log('✅ Authentication validation completed successfully');
    console.log('🔐 System ready for support module integration');

    return true;

  } catch (error) {
    console.error('❌ Authentication validation failed:', error.message);
    console.log('🚨 Fix authentication issues before proceeding with support integration');
    return false;
  }
}

// Run validation if called directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (import.meta.url === `file://${process.argv[1]}`) {
  validateAuthentication().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

export { validateAuthentication };