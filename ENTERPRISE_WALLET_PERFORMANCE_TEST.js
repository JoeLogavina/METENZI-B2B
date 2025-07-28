#!/usr/bin/env node

/**
 * Enterprise Wallet Performance Test Suite
 * Tests the Database-First + RLS wallet system under various loads
 */

import http from 'http';
import { performance } from 'perf_hooks';

class WalletPerformanceTest {
  constructor() {
    this.baseUrl = 'http://localhost:5000';
    this.cookies = '';
    this.results = {
      wallet: [],
      transactions: [],
      concurrent: [],
      errors: []
    };
  }

  async authenticate() {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        username: 'b2bkm',
        password: 'Kalendar1'
      });

      const options = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = http.request(options, (res) => {
        this.cookies = res.headers['set-cookie']?.join('; ') || '';
        resolve();
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async makeRequest(path) {
    return new Promise((resolve, reject) => {
      const start = performance.now();
      
      const options = {
        hostname: 'localhost',
        port: 5000,
        path: path,
        method: 'GET',
        headers: {
          'Cookie': this.cookies
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const end = performance.now();
          const duration = end - start;
          
          try {
            const parsed = JSON.parse(data);
            resolve({ 
              duration, 
              status: res.statusCode, 
              data: parsed,
              dataSize: Buffer.byteLength(data)
            });
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.end();
    });
  }

  async testWalletPerformance() {
    console.log('🔥 Testing Wallet Endpoint Performance');
    
    for (let i = 0; i < 10; i++) {
      try {
        const result = await this.makeRequest('/api/wallet');
        this.results.wallet.push(result);
        console.log(`  Test ${i + 1}: ${result.duration.toFixed(2)}ms (${result.status})`);
      } catch (error) {
        this.results.errors.push({ test: 'wallet', error: error.message });
        console.log(`  Test ${i + 1}: ERROR - ${error.message}`);
      }
    }
  }

  async testTransactionsPerformance() {
    console.log('\n📊 Testing Transactions Endpoint Performance');
    
    for (let i = 0; i < 10; i++) {
      try {
        const result = await this.makeRequest('/api/wallet/transactions');
        this.results.transactions.push(result);
        const txCount = result.data?.data?.length || 0;
        console.log(`  Test ${i + 1}: ${result.duration.toFixed(2)}ms (${txCount} transactions)`);
      } catch (error) {
        this.results.errors.push({ test: 'transactions', error: error.message });
        console.log(`  Test ${i + 1}: ERROR - ${error.message}`);
      }
    }
  }

  async testConcurrentRequests() {
    console.log('\n⚡ Testing Concurrent Wallet Requests');
    
    for (let batch = 0; batch < 3; batch++) {
      const promises = [];
      const startTime = performance.now();
      
      // 5 concurrent requests per batch
      for (let i = 0; i < 5; i++) {
        promises.push(this.makeRequest('/api/wallet'));
      }

      try {
        const results = await Promise.all(promises);
        const batchTime = performance.now() - startTime;
        
        this.results.concurrent.push({
          batch: batch + 1,
          batchTime,
          results
        });

        const avgResponse = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
        console.log(`  Batch ${batch + 1}: ${batchTime.toFixed(2)}ms total, ${avgResponse.toFixed(2)}ms avg response`);
      } catch (error) {
        this.results.errors.push({ test: 'concurrent', error: error.message });
        console.log(`  Batch ${batch + 1}: ERROR - ${error.message}`);
      }
    }
  }

  generateReport() {
    console.log('\n📈 ENTERPRISE WALLET PERFORMANCE REPORT');
    console.log('=' .repeat(50));

    // Wallet endpoint stats
    if (this.results.wallet.length > 0) {
      const walletTimes = this.results.wallet.map(r => r.duration);
      const avgWallet = walletTimes.reduce((a, b) => a + b, 0) / walletTimes.length;
      const minWallet = Math.min(...walletTimes);
      const maxWallet = Math.max(...walletTimes);
      
      console.log(`\n🔥 Wallet Endpoint (/api/wallet):`);
      console.log(`   Average: ${avgWallet.toFixed(2)}ms`);
      console.log(`   Min: ${minWallet.toFixed(2)}ms`);
      console.log(`   Max: ${maxWallet.toFixed(2)}ms`);
      console.log(`   Success Rate: ${(this.results.wallet.filter(r => r.status === 200).length / this.results.wallet.length * 100).toFixed(1)}%`);
    }

    // Transactions endpoint stats
    if (this.results.transactions.length > 0) {
      const txTimes = this.results.transactions.map(r => r.duration);
      const avgTx = txTimes.reduce((a, b) => a + b, 0) / txTimes.length;
      const minTx = Math.min(...txTimes);
      const maxTx = Math.max(...txTimes);
      
      console.log(`\n📊 Transactions Endpoint (/api/wallet/transactions):`);
      console.log(`   Average: ${avgTx.toFixed(2)}ms`);
      console.log(`   Min: ${minTx.toFixed(2)}ms`);
      console.log(`   Max: ${maxTx.toFixed(2)}ms`);
      console.log(`   Success Rate: ${(this.results.transactions.filter(r => r.status === 200).length / this.results.transactions.length * 100).toFixed(1)}%`);
    }

    // Concurrent test stats
    if (this.results.concurrent.length > 0) {
      const allConcurrent = this.results.concurrent.flatMap(batch => batch.results);
      const concurrentTimes = allConcurrent.map(r => r.duration);
      const avgConcurrent = concurrentTimes.reduce((a, b) => a + b, 0) / concurrentTimes.length;
      
      console.log(`\n⚡ Concurrent Performance (5 simultaneous requests):`);
      console.log(`   Average Response: ${avgConcurrent.toFixed(2)}ms`);
      console.log(`   Total Requests: ${allConcurrent.length}`);
      console.log(`   Success Rate: ${(allConcurrent.filter(r => r.status === 200).length / allConcurrent.length * 100).toFixed(1)}%`);
    }

    // Error summary
    if (this.results.errors.length > 0) {
      console.log(`\n❌ Errors Encountered: ${this.results.errors.length}`);
      this.results.errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error.test}: ${error.error}`);
      });
    }

    // Performance assessment
    console.log(`\n🏆 PERFORMANCE ASSESSMENT:`);
    
    const walletAvg = this.results.wallet.length > 0 
      ? this.results.wallet.reduce((sum, r) => sum + r.duration, 0) / this.results.wallet.length 
      : 0;
    
    if (walletAvg < 100) {
      console.log(`   ✅ EXCELLENT: Wallet responses under 100ms (${walletAvg.toFixed(2)}ms avg)`);
    } else if (walletAvg < 300) {
      console.log(`   ⚠️  GOOD: Wallet responses under 300ms (${walletAvg.toFixed(2)}ms avg)`);
    } else {
      console.log(`   🔴 NEEDS OPTIMIZATION: Wallet responses over 300ms (${walletAvg.toFixed(2)}ms avg)`);
    }

    const errorRate = this.results.errors.length / (this.results.wallet.length + this.results.transactions.length + this.results.concurrent.length * 5) * 100;
    
    if (this.results.errors.length === 0) {
      console.log(`   ✅ RELIABLE: Zero errors in ${this.results.wallet.length + this.results.transactions.length}+ requests`);
    } else {
      console.log(`   ❌ ERROR RATE: ${errorRate.toFixed(2)}% (${this.results.errors.length} errors)`);
    }
  }

  async run() {
    console.log('🚀 Starting Enterprise Wallet Performance Test Suite\n');
    
    try {
      await this.authenticate();
      console.log('✅ Authentication successful\n');
      
      await this.testWalletPerformance();
      await this.testTransactionsPerformance();
      await this.testConcurrentRequests();
      
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }
}

// Run the test suite
const test = new WalletPerformanceTest();
test.run();