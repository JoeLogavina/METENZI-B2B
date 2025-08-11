#!/usr/bin/env node

/**
 * Comprehensive Risk Validation Script
 * Runs all validation checks before support system integration
 */

import { validateAuthentication } from './validate-authentication.js';
import { validatePerformance } from './validate-performance.js';
import { validateTenantIsolation } from './validate-tenant-isolation.js';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

async function runComprehensiveValidation() {
  console.log('🛡️  Starting Comprehensive Risk Validation for Support System Integration');
  console.log('═'.repeat(80));
  
  const validationResults = [];
  const startTime = Date.now();

  try {
    // Step 1: Database Backup
    console.log('\n📦 Step 1: Creating Database Backup...');
    const backupResult = await createDatabaseBackup();
    validationResults.push({
      step: 'Database Backup',
      status: backupResult.success ? 'COMPLETED' : 'FAILED',
      details: backupResult.message
    });

    if (!backupResult.success) {
      console.log('⚠️  Backup failed but continuing with validation...');
    }

    // Step 2: Authentication Validation
    console.log('\n🔐 Step 2: Authentication System Validation...');
    const authResult = await validateAuthentication();
    validationResults.push({
      step: 'Authentication Validation',
      status: authResult ? 'PASSED' : 'FAILED',
      critical: true
    });

    // Step 3: Performance Validation
    console.log('\n⚡ Step 3: Performance Validation...');
    const perfResult = await validatePerformance();
    validationResults.push({
      step: 'Performance Validation',
      status: perfResult ? 'PASSED' : 'FAILED',
      critical: false
    });

    // Step 4: Multi-tenant Isolation Validation
    console.log('\n🏢 Step 4: Multi-tenant Isolation Validation...');
    const tenantResult = await validateTenantIsolation();
    validationResults.push({
      step: 'Tenant Isolation Validation',
      status: tenantResult ? 'PASSED' : 'FAILED',
      critical: true
    });

    // Step 5: Database Schema Validation
    console.log('\n📊 Step 5: Database Schema Validation...');
    const schemaResult = await validateDatabaseSchema();
    validationResults.push({
      step: 'Database Schema Validation',
      status: schemaResult.success ? 'PASSED' : 'FAILED',
      critical: false,
      details: schemaResult.details
    });

    // Step 6: Environment Configuration Validation
    console.log('\n⚙️  Step 6: Environment Configuration Validation...');
    const envResult = validateEnvironmentConfig();
    validationResults.push({
      step: 'Environment Configuration',
      status: envResult.success ? 'PASSED' : 'FAILED',
      critical: false,
      details: envResult.missing
    });

    // Generate Final Report
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n📋 COMPREHENSIVE VALIDATION REPORT');
    console.log('═'.repeat(80));
    console.log(`⏱️  Total validation time: ${duration} seconds`);
    console.log(`📅 Validation date: ${new Date().toISOString()}`);
    console.log('');

    let allPassed = true;
    let criticalFailed = false;

    validationResults.forEach((result, index) => {
      const statusIcon = result.status === 'PASSED' || result.status === 'COMPLETED' ? '✅' : 
                        result.status === 'FAILED' ? '❌' : '⚠️';
      
      console.log(`${statusIcon} ${index + 1}. ${result.step}: ${result.status}`);
      
      if (result.details) {
        console.log(`   Details: ${result.details}`);
      }
      
      if (result.status === 'FAILED') {
        allPassed = false;
        if (result.critical) {
          criticalFailed = true;
        }
      }
    });

    console.log('');

    // Risk Assessment
    if (criticalFailed) {
      console.log('🚨 CRITICAL FAILURES DETECTED');
      console.log('❌ DO NOT PROCEED with support system integration');
      console.log('🔧 Fix critical issues before attempting integration');
      return false;
    } else if (!allPassed) {
      console.log('⚠️  NON-CRITICAL FAILURES DETECTED');
      console.log('✅ Safe to proceed with support system integration');
      console.log('📝 Address non-critical issues during or after integration');
    } else {
      console.log('✅ ALL VALIDATIONS PASSED');
      console.log('🚀 System is ready for support system integration');
    }

    // Save validation report
    saveValidationReport(validationResults, duration);

    console.log('\n🛡️  Risk mitigation validation completed');
    return !criticalFailed;

  } catch (error) {
    console.error('\n❌ Comprehensive validation failed:', error.message);
    return false;
  }
}

async function createDatabaseBackup() {
  return new Promise((resolve) => {
    const backupScript = path.join(__dirname, 'backup-database.js');
    exec(`node "${backupScript}"`, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          message: `Backup failed: ${error.message}`
        });
      } else {
        resolve({
          success: true,
          message: 'Database backup completed successfully'
        });
      }
    });
  });
}

async function validateDatabaseSchema() {
  try {
    const { db } = await import('../server/db.ts');
    const { sql } = await import('drizzle-orm');

    // Check if all expected tables exist
    const expectedTables = [
      'users', 'products', 'categories', 'orders', 'order_items',
      'license_keys', 'cart_items', 'wallets', 'wallet_transactions',
      'admin_permissions', 'user_product_pricing', 'sessions'
    ];

    const existingTables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

    const tableNames = existingTables.rows.map(row => row.table_name);
    const missingTables = expectedTables.filter(table => !tableNames.includes(table));

    if (missingTables.length > 0) {
      return {
        success: false,
        details: `Missing tables: ${missingTables.join(', ')}`
      };
    }

    return {
      success: true,
      details: `All ${expectedTables.length} expected tables found`
    };

  } catch (error) {
    return {
      success: false,
      details: `Schema validation error: ${error.message}`
    };
  }
}

function validateEnvironmentConfig() {
  const requiredEnvVars = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'NODE_ENV'
  ];

  const optionalEnvVars = [
    'SENTRY_DSN',
    'REDIS_URL'
  ];

  const missing = [];
  const present = [];

  requiredEnvVars.forEach(varName => {
    if (process.env[varName]) {
      present.push(varName);
    } else {
      missing.push(varName);
    }
  });

  optionalEnvVars.forEach(varName => {
    if (process.env[varName]) {
      present.push(varName);
    }
  });

  return {
    success: missing.length === 0,
    missing: missing.length > 0 ? missing : undefined,
    present: present
  };
}

function saveValidationReport(results, duration) {
  const report = {
    timestamp: new Date().toISOString(),
    duration: `${duration}s`,
    results: results,
    summary: {
      total: results.length,
      passed: results.filter(r => r.status === 'PASSED' || r.status === 'COMPLETED').length,
      failed: results.filter(r => r.status === 'FAILED').length,
      critical_failures: results.filter(r => r.status === 'FAILED' && r.critical).length
    }
  };

  const reportsDir = './reports';
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportFile = path.join(reportsDir, `validation-report-${Date.now()}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  
  console.log(`📄 Validation report saved to: ${reportFile}`);
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runComprehensiveValidation().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

export { runComprehensiveValidation };