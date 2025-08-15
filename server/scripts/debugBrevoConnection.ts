#!/usr/bin/env tsx

/**
 * Brevo Connection Debugging Script
 * Tests Brevo API connectivity and diagnoses issues
 */

import { BrevoEmailService } from '../services/brevoEmailService';
import { logger } from '../lib/logger';
import axios from 'axios';

async function debugBrevoConnection() {
  console.log('🔍 Brevo Connection Debugging Tool\n');
  
  // Check environment variables
  console.log('📋 Environment Variables Check:');
  console.log(`BREVO_API_KEY: ${process.env.BREVO_API_KEY ? `${process.env.BREVO_API_KEY.substring(0, 8)}...` : 'NOT SET'}`);
  console.log(`BREVO_FROM_EMAIL: ${process.env.BREVO_FROM_EMAIL || 'NOT SET'}`);
  console.log(`BREVO_TEST_EMAIL: ${process.env.BREVO_TEST_EMAIL || 'NOT SET'}\n`);
  
  if (!process.env.BREVO_API_KEY) {
    console.error('❌ BREVO_API_KEY is not set!');
    return;
  }
  
  // Test direct API call
  console.log('🌐 Testing Direct Brevo API Call:');
  try {
    const response = await axios.get('https://api.brevo.com/v3/account', {
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Direct API call successful!');
    console.log('Account Info:', {
      email: response.data.email,
      firstName: response.data.firstName,
      lastName: response.data.lastName,
      companyName: response.data.companyName,
      plan: response.data.plan
    });
    console.log();
    
  } catch (error: any) {
    console.error('❌ Direct API call failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    console.log();
  }
  
  // Test via service
  console.log('🔧 Testing via BrevoEmailService:');
  try {
    const emailService = new BrevoEmailService();
    const result = await emailService.testConnection();
    
    if (result.success) {
      console.log('✅ Service test successful!');
      console.log('Account Info:', result.accountInfo);
    } else {
      console.error('❌ Service test failed:', result.error);
    }
    console.log();
    
  } catch (error: any) {
    console.error('❌ Service test error:', error.message);
    console.log();
  }
  
  // Test SMTP limits
  console.log('📊 Testing API Limits:');
  try {
    const response = await axios.get('https://api.brevo.com/v3/account', {
      headers: {
        'api-key': process.env.BREVO_API_KEY
      }
    });
    
    if (response.headers['x-ratelimit-remaining']) {
      console.log(`Rate limit remaining: ${response.headers['x-ratelimit-remaining']}`);
    }
    
    console.log('✅ API limits check completed');
    
  } catch (error: any) {
    console.error('❌ API limits check failed:', error.message);
  }
  
  console.log('\n🎯 Debugging Complete!');
}

// Run if called directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (import.meta.url === `file://${process.argv[1]}`) {
  debugBrevoConnection().catch(console.error);
}

export { debugBrevoConnection };