import fs from 'fs';

// Simple API test for support system endpoints
const BASE_URL = 'http://localhost:5000';

const testEndpoint = async (endpoint, method = 'GET', body = null) => {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const status = response.status;
    const isOk = response.ok;
    
    let responseBody;
    try {
      responseBody = await response.json();
    } catch {
      responseBody = await response.text();
    }
    
    return { status, isOk, body: responseBody, endpoint };
  } catch (error) {
    return { status: 'ERROR', isOk: false, body: error.message, endpoint };
  }
};

const runSupportSystemTests = async () => {
  console.log('🔍 Testing Support System API Endpoints');
  console.log('======================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Started at: ${new Date().toISOString()}\n`);
  
  const tests = [
    // Support Routes (should require authentication)
    { endpoint: '/api/support/tickets', method: 'GET', name: 'List Support Tickets' },
    { endpoint: '/api/support/chat/sessions', method: 'GET', name: 'List Chat Sessions' },
    { endpoint: '/api/support/kb/articles', method: 'GET', name: 'List Knowledge Base Articles' },
    { endpoint: '/api/support/faqs', method: 'GET', name: 'List FAQs' },
    
    // Admin Support Routes (should require admin authentication)
    { endpoint: '/api/admin/support/tickets', method: 'GET', name: 'Admin - List All Tickets' },
    { endpoint: '/api/admin/support/tickets/stats', method: 'GET', name: 'Admin - Ticket Statistics' },
    { endpoint: '/api/admin/support/kb/articles', method: 'GET', name: 'Admin - List KB Articles' },
    { endpoint: '/api/admin/support/faqs', method: 'GET', name: 'Admin - List FAQs' },
    
    // Health check endpoints
    { endpoint: '/health', method: 'GET', name: 'Health Check' },
    { endpoint: '/status', method: 'GET', name: 'Status Check' },
  ];
  
  const results = [];
  
  for (const test of tests) {
    const result = await testEndpoint(test.endpoint, test.method);
    const status = result.isOk ? '✅ ACCESSIBLE' : `❌ ${result.status}`;
    
    console.log(`${status} | ${test.name}`);
    console.log(`   Endpoint: ${test.method} ${test.endpoint}`);
    
    if (result.status === 401) {
      console.log('   Note: Requires authentication (expected)');
    } else if (result.status === 404) {
      console.log('   Note: Route not found - needs implementation');
    } else if (result.isOk) {
      console.log(`   Response: ${typeof result.body === 'object' ? JSON.stringify(result.body).substring(0, 100) + '...' : result.body}`);
    } else {
      console.log(`   Error: ${result.body}`);
    }
    
    console.log('');
    results.push({ ...test, ...result });
  }
  
  // Summary
  const accessible = results.filter(r => r.isOk).length;
  const authRequired = results.filter(r => r.status === 401).length;
  const notFound = results.filter(r => r.status === 404).length;
  const errors = results.filter(r => !r.isOk && r.status !== 401 && r.status !== 404).length;
  
  console.log('📊 SUMMARY');
  console.log('==========');
  console.log(`✅ Accessible (no auth): ${accessible}`);
  console.log(`🔐 Auth Required: ${authRequired}`);
  console.log(`❌ Not Found: ${notFound}`);
  console.log(`💥 Errors: ${errors}`);
  console.log(`📈 Total Endpoints: ${results.length}\n`);
  
  // Check if routes are properly registered
  const supportRoutes = results.filter(r => r.endpoint.startsWith('/api/support'));
  const adminSupportRoutes = results.filter(r => r.endpoint.startsWith('/api/admin/support'));
  
  console.log('🔍 ROUTE ANALYSIS');
  console.log('=================');
  console.log(`Support Routes (${supportRoutes.length}): ${supportRoutes.every(r => r.status !== 404) ? '✅ Registered' : '❌ Missing'}`);
  console.log(`Admin Support Routes (${adminSupportRoutes.length}): ${adminSupportRoutes.every(r => r.status !== 404) ? '✅ Registered' : '❌ Missing'}`);
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS');
  console.log('==================');
  
  if (notFound > 0) {
    console.log('❌ Some routes are not found. Check route registration in server/routes.ts');
  }
  
  if (authRequired > 0) {
    console.log('🔐 Routes require authentication. This is expected behavior.');
    console.log('   To test authenticated endpoints, use browser with active session.');
  }
  
  if (accessible > 0) {
    console.log('✅ Some endpoints are accessible without authentication.');
    console.log('   This may be intentional for public endpoints like health checks.');
  }
  
  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    summary: { accessible, authRequired, notFound, errors, total: results.length },
    results,
    recommendations: {
      routesRegistered: notFound === 0,
      authenticationWorking: authRequired > 0,
      readyForPhase3: notFound === 0 && errors === 0
    }
  };
  
  // Save report
  fs.writeFileSync('docs/SUPPORT_API_ENDPOINT_TEST.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Detailed results saved to: docs/SUPPORT_API_ENDPOINT_TEST.json');
  
  console.log(`\nCompleted at: ${new Date().toISOString()}`);
  
  return report;
};

// Run the test
runSupportSystemTests().catch(console.error);