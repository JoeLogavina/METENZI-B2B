import { BrevoEmailService } from '../services/brevoEmailService';
import { BrevoNotificationQueue } from '../services/brevoNotificationQueue';
import { logger } from '../lib/logger';

interface TestResult {
  test: string;
  success: boolean;
  duration: number;
  data?: any;
  error?: string;
}

export class BrevoIntegrationTest {
  private brevoService: BrevoEmailService;
  private notificationQueue: BrevoNotificationQueue;
  private results: TestResult[] = [];

  constructor() {
    this.brevoService = new BrevoEmailService();
    this.notificationQueue = new BrevoNotificationQueue();
  }

  async runAllTests(): Promise<{
    success: boolean;
    totalTests: number;
    passedTests: number;
    results: TestResult[];
  }> {
    logger.info('🚀 Starting comprehensive Brevo integration tests...');
    this.results = [];

    const tests = [
      () => this.testBrevoConnection(),
      () => this.testTemplateRendering(),
      () => this.testCsvGeneration(),
      () => this.testEmailSending(),
      () => this.testNotificationQueue(),
      () => this.testWebhookHandling(),
      () => this.testErrorHandling(),
      () => this.testPerformance()
    ];

    for (const test of tests) {
      try {
        await test();
      } catch (error) {
        logger.error('Test execution failed', { error: error.message });
      }
    }

    const passedTests = this.results.filter(r => r.success).length;
    const success = passedTests === this.results.length;

    const summary = {
      success,
      totalTests: this.results.length,
      passedTests,
      results: this.results
    };

    logger.info('🏁 Brevo integration tests completed', {
      totalTests: summary.totalTests,
      passedTests: summary.passedTests,
      success: summary.success
    });

    return summary;
  }

  private async testBrevoConnection(): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('🔍 Testing Brevo API connection...');
      
      const result = await this.brevoService.testConnection();
      const duration = Date.now() - startTime;

      this.results.push({
        test: 'Brevo API Connection',
        success: result.success,
        duration,
        data: result.accountInfo,
        error: result.error
      });

      if (result.success) {
        logger.info('✅ Brevo connection test passed', {
          account: result.accountInfo?.email,
          duration: `${duration}ms`
        });
      } else {
        logger.error('❌ Brevo connection test failed', {
          error: result.error,
          duration: `${duration}ms`
        });
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        test: 'Brevo API Connection',
        success: false,
        duration,
        error: error.message
      });
    }
  }

  private async testTemplateRendering(): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('📝 Testing template rendering...');

      const testData = {
        orderNumber: 'TEST-12345',
        customerName: 'John Doe',
        orderDate: '2025-01-15',
        totalAmount: '199.99',
        currency: 'EUR',
        items: [
          {
            productName: 'Test Product',
            sku: 'SKU-001',
            quantity: 2,
            unitPrice: '99.99',
            totalPrice: '199.98'
          }
        ]
      };

      // Test EUR template
      const eurService = new BrevoEmailService();
      const eurTemplate = (eurService as any).getEnglishTemplate();
      const eurRendered = (eurService as any).renderTemplate(eurTemplate.subject, testData);

      // Test KM template  
      const kmTemplate = (eurService as any).getBosnianTemplate();
      const kmRendered = (eurService as any).renderTemplate(kmTemplate.subject, testData);

      const duration = Date.now() - startTime;
      const success = eurRendered.includes('TEST-12345') && kmRendered.includes('TEST-12345');

      this.results.push({
        test: 'Template Rendering',
        success,
        duration,
        data: {
          eurSubject: eurRendered,
          kmSubject: kmRendered
        },
        error: success ? undefined : 'Template rendering failed to substitute variables'
      });

      logger.info(success ? '✅ Template rendering test passed' : '❌ Template rendering test failed', {
        duration: `${duration}ms`
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        test: 'Template Rendering',
        success: false,
        duration,
        error: error.message
      });
    }
  }

  private async testCsvGeneration(): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('📄 Testing CSV generation...');

      const mockOrderData = {
        orderId: 'test-order-001',
        orderNumber: 'TEST-12345',
        customerName: 'Test Customer',
        customerEmail: 'test@example.com',
        tenant: 'EUR' as const,
        totalAmount: 199.99,
        currency: 'EUR',
        orderDate: new Date(),
        items: [
          {
            productId: 'prod-1',
            productName: 'Test Product',
            sku: 'SKU-001',
            quantity: 1,
            unitPrice: 199.99,
            totalPrice: 199.99
          }
        ],
        licenseKeys: [
          {
            productName: 'Test Product',
            sku: 'SKU-001',
            licenseKey: 'TEST-KEY-123',
            activationUrl: 'https://test.example.com/activate',
            expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          }
        ]
      };

      // Test CSV generation through the service
      const csvPath = await (this.brevoService as any).generateLicenseKeysCsv(mockOrderData);
      
      // Check if file exists
      const fs = require('fs').promises;
      const csvExists = await fs.access(csvPath).then(() => true).catch(() => false);
      
      // Read and validate CSV content
      let csvContent = '';
      if (csvExists) {
        csvContent = await fs.readFile(csvPath, 'utf8');
        await fs.unlink(csvPath); // Clean up
      }

      const duration = Date.now() - startTime;
      const success = csvExists && csvContent.includes('TEST-KEY-123') && csvContent.includes('TEST-12345');

      this.results.push({
        test: 'CSV Generation',
        success,
        duration,
        data: {
          fileCreated: csvExists,
          contentLength: csvContent.length,
          containsLicenseKey: csvContent.includes('TEST-KEY-123'),
          containsOrderNumber: csvContent.includes('TEST-12345')
        },
        error: success ? undefined : 'CSV generation or content validation failed'
      });

      logger.info(success ? '✅ CSV generation test passed' : '❌ CSV generation test failed', {
        duration: `${duration}ms`,
        fileSize: csvContent.length
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        test: 'CSV Generation',
        success: false,
        duration,
        error: error.message
      });
    }
  }

  private async testEmailSending(): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('📧 Testing email sending...');

      // Only run if test mode is enabled or if we have a test email
      const testEmail = process.env.BREVO_TEST_EMAIL;
      if (!testEmail) {
        logger.warn('⚠️ Skipping email sending test - BREVO_TEST_EMAIL not configured');
        this.results.push({
          test: 'Email Sending',
          success: true,
          duration: Date.now() - startTime,
          data: { skipped: true, reason: 'BREVO_TEST_EMAIL not configured' }
        });
        return;
      }

      const result = await this.brevoService.sendTestEmail({
        recipient: testEmail,
        templateName: 'order_confirmation',
        tenant: 'EUR',
        testData: {
          orderNumber: 'TEST-EMAIL-001',
          customerName: 'Test Customer',
          orderDate: new Date().toLocaleDateString(),
          totalAmount: '99.99',
          currency: 'EUR',
          items: [
            {
              productName: 'Test Product',
              sku: 'TEST-SKU',
              quantity: 1,
              unitPrice: '99.99',
              totalPrice: '99.99'
            }
          ]
        }
      });

      const duration = Date.now() - startTime;

      this.results.push({
        test: 'Email Sending',
        success: result.success,
        duration,
        data: {
          messageId: result.messageId,
          recipient: testEmail
        },
        error: result.error
      });

      logger.info(result.success ? '✅ Email sending test passed' : '❌ Email sending test failed', {
        messageId: result.messageId,
        duration: `${duration}ms`
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        test: 'Email Sending',
        success: false,
        duration,
        error: error.message
      });
    }
  }

  private async testNotificationQueue(): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('🔄 Testing notification queue...');

      // Add a test notification
      const notificationId = await this.notificationQueue.addNotification({
        userId: 'test-user-001',
        type: 'test_notification',
        channel: 'email',
        recipient: 'test@example.com',
        subject: 'Test Queue Notification',
        content: 'This is a test notification for queue testing',
        metadata: { test: true }
      });

      // Get queue status
      const queueStatus = await this.notificationQueue.getQueueStatus();

      // Test retry functionality
      const retryResult = await this.notificationQueue.retryNotification(notificationId);

      const duration = Date.now() - startTime;
      const success = !!notificationId && !!queueStatus && retryResult;

      this.results.push({
        test: 'Notification Queue',
        success,
        duration,
        data: {
          notificationId,
          queueStatus,
          retrySuccess: retryResult
        },
        error: success ? undefined : 'Queue operations failed'
      });

      logger.info(success ? '✅ Notification queue test passed' : '❌ Notification queue test failed', {
        notificationId,
        duration: `${duration}ms`
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        test: 'Notification Queue',
        success: false,
        duration,
        error: error.message
      });
    }
  }

  private async testWebhookHandling(): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('🔔 Testing webhook handling...');

      const mockWebhookData = {
        event: 'delivered',
        messageId: 'test-message-123',
        email: 'test@example.com',
        timestamp: new Date().toISOString(),
        subject: 'Test Email'
      };

      const webhookResult = await this.brevoService.handleWebhook(mockWebhookData);
      const duration = Date.now() - startTime;
      const success = !!webhookResult && webhookResult.messageId === 'test-message-123';

      this.results.push({
        test: 'Webhook Handling',
        success,
        duration,
        data: webhookResult,
        error: success ? undefined : 'Webhook processing failed'
      });

      logger.info(success ? '✅ Webhook handling test passed' : '❌ Webhook handling test failed', {
        duration: `${duration}ms`
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        test: 'Webhook Handling',
        success: false,
        duration,
        error: error.message
      });
    }
  }

  private async testErrorHandling(): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('⚠️ Testing error handling...');

      // Test with invalid email
      const invalidEmailResult = await this.brevoService.sendTestEmail({
        recipient: 'invalid-email',
        templateName: 'test',
        tenant: 'EUR'
      });

      // Test with missing data
      const missingDataResult = await this.brevoService.sendTestEmail({
        recipient: 'test@example.com',
        templateName: '',
        tenant: 'EUR'
      });

      const duration = Date.now() - startTime;
      const success = !invalidEmailResult.success && !missingDataResult.success;

      this.results.push({
        test: 'Error Handling',
        success,
        duration,
        data: {
          invalidEmailHandled: !invalidEmailResult.success,
          missingDataHandled: !missingDataResult.success
        },
        error: success ? undefined : 'Error handling failed - errors not properly caught'
      });

      logger.info(success ? '✅ Error handling test passed' : '❌ Error handling test failed', {
        duration: `${duration}ms`
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        test: 'Error Handling',
        success: false,
        duration,
        error: error.message
      });
    }
  }

  private async testPerformance(): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('⚡ Testing performance...');

      const iterations = 5;
      const operations = [];

      // Test multiple concurrent operations
      for (let i = 0; i < iterations; i++) {
        operations.push(
          this.notificationQueue.getQueueStatus()
        );
      }

      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;
      const avgDuration = duration / iterations;
      const success = results.every(r => !!r) && avgDuration < 1000; // Should complete within 1 second on average

      this.results.push({
        test: 'Performance',
        success,
        duration,
        data: {
          iterations,
          totalDuration: duration,
          averageDuration: avgDuration,
          allOperationsSucceeded: results.every(r => !!r)
        },
        error: success ? undefined : `Performance test failed - average duration ${avgDuration}ms exceeds threshold`
      });

      logger.info(success ? '✅ Performance test passed' : '❌ Performance test failed', {
        avgDuration: `${avgDuration}ms`,
        duration: `${duration}ms`
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        test: 'Performance',
        success: false,
        duration,
        error: error.message
      });
    }
  }

  getTestResults(): TestResult[] {
    return this.results;
  }

  getTestSummary(): string {
    const total = this.results.length;
    const passed = this.results.filter(r => r.success).length;
    const failed = total - passed;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    return `
Brevo Integration Test Summary
=============================
Total Tests: ${total}
Passed: ${passed}
Failed: ${failed}
Total Duration: ${totalDuration}ms
Success Rate: ${((passed / total) * 100).toFixed(1)}%

Test Details:
${this.results.map(r => 
  `${r.success ? '✅' : '❌'} ${r.test} (${r.duration}ms)${r.error ? ` - ${r.error}` : ''}`
).join('\n')}
    `.trim();
  }
}

// Export for use in other modules
export default BrevoIntegrationTest;