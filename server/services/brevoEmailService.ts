import axios from 'axios';
import path from 'path';
import fs from 'fs/promises';
import { createObjectCsvWriter } from 'csv-writer';
import { logger } from '../lib/logger';

export interface EmailOrderData {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  tenant: 'EUR' | 'KM';
  totalAmount: number;
  currency: string;
  orderDate: Date;
  items: OrderItem[];
  licenseKeys: LicenseKeyData[];
}

export interface OrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface LicenseKeyData {
  productName: string;
  sku: string;
  licenseKey: string;
  activationUrl?: string;
  expirationDate?: Date;
}

export interface BrevoTemplate {
  id: number;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  isActive: boolean;
  createdAt: string;
  modifiedAt: string;
}

export interface BrevoDeliveryStatus {
  messageId: string;
  status: 'delivered' | 'bounced' | 'soft_bounced' | 'blocked' | 'spam' | 'opened' | 'clicked';
  timestamp: string;
  recipient: string;
  subject: string;
  reason?: string;
}

export class BrevoEmailService {
  private apiKey: string;
  private baseUrl: string = 'https://api.brevo.com/v3';
  private isTestMode: boolean;
  private debugMode: boolean;

  constructor() {
    this.debugMode = process.env.NODE_ENV === 'development';
    this.isTestMode = process.env.BREVO_TEST_MODE === 'true';

    if (!process.env.BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY environment variable is required');
    }

    this.apiKey = process.env.BREVO_API_KEY;

    if (this.debugMode) {
      logger.info('🔧 BrevoEmailService initialized', {
        testMode: this.isTestMode,
        debugMode: this.debugMode,
        apiKeyLength: process.env.BREVO_API_KEY?.length
      });
    }
  }

  /**
   * Send order confirmation email with license keys CSV attachment
   */
  async sendOrderConfirmation(orderData: EmailOrderData): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      logger.info('📧 Starting order confirmation email process', {
        orderId: orderData.orderId,
        tenant: orderData.tenant,
        recipient: orderData.customerEmail,
        licenseKeyCount: orderData.licenseKeys.length
      });

      // Generate CSV file with license keys
      const csvFilePath = await this.generateLicenseKeysCsv(orderData);
      logger.debug('📄 CSV file generated', { filePath: csvFilePath });

      // Get appropriate template based on tenant
      const templateData = this.getOrderConfirmationTemplate(orderData.tenant);
      
      // Prepare email data with dynamic content
      const emailData = this.prepareEmailData(orderData);
      
      // Create the email payload
      const emailPayload = {
        to: [{ 
          email: orderData.customerEmail,
          name: orderData.customerName 
        }],
        subject: this.renderTemplate(templateData.subject, emailData),
        htmlContent: this.renderTemplate(templateData.htmlContent, emailData),
        textContent: this.renderTemplate(templateData.textContent, emailData),
        sender: {
          name: orderData.tenant === 'KM' ? 'Softverska rješenja' : 'Software Solutions',
          email: process.env.BREVO_FROM_EMAIL || 'orders@example.com'
        },
        attachment: [
          {
            name: `license-keys-${orderData.orderNumber}.csv`,
            content: await fs.readFile(csvFilePath, 'base64')
          }
        ],
        tags: ['order_confirmation', `tenant_${orderData.tenant.toLowerCase()}`],
        headers: {
          'X-Order-ID': orderData.orderId,
          'X-Order-Number': orderData.orderNumber,
          'X-Tenant': orderData.tenant
        }
      };

      if (this.debugMode) {
        logger.debug('📧 Email payload prepared', {
          recipient: emailPayload.to?.[0]?.email,
          subject: emailPayload.subject,
          hasAttachment: !!emailPayload.attachment?.length,
          tags: emailPayload.tags
        });
      }

      // Send email via Brevo
      const response = await axios.post(`${this.baseUrl}/smtp/email`, emailPayload, {
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      const result = response.data;

      // Clean up temporary CSV file
      await fs.unlink(csvFilePath);
      
      logger.info('✅ Order confirmation email sent successfully', {
        orderId: orderData.orderId,
        messageId: result.messageId,
        recipient: orderData.customerEmail
      });

      return {
        success: true,
        messageId: result.messageId
      };

    } catch (error) {
      logger.error('❌ Failed to send order confirmation email', {
        orderId: orderData.orderId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send test email for template testing
   */
  async sendTestEmail(options: {
    recipient: string;
    templateName: string;
    tenant: 'EUR' | 'KM';
    testData?: any;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { recipient, templateName, tenant, testData } = options;

      logger.info('🧪 Sending test email', {
        recipient,
        templateName,
        tenant
      });

      const templateData = this.getOrderConfirmationTemplate(tenant);
      const defaultTestData = this.getDefaultTestData(tenant);
      const emailData = testData || defaultTestData;

      const emailPayload = {
        to: [{ email: recipient }],
        subject: `[TEST] ${this.renderTemplate(templateData.subject, emailData)}`,
        htmlContent: this.renderTemplate(templateData.htmlContent, emailData),
        textContent: this.renderTemplate(templateData.textContent, emailData),
        sender: {
          name: tenant === 'KM' ? 'Softverska rješenja TEST' : 'Software Solutions TEST',
          email: process.env.BREVO_FROM_EMAIL || 'test@example.com'
        },
        tags: ['test_email', `tenant_${tenant.toLowerCase()}`]
      };

      const response = await axios.post(`${this.baseUrl}/smtp/email`, emailPayload, {
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      const result = response.data;

      logger.info('✅ Test email sent successfully', {
        recipient,
        messageId: result.messageId
      });

      return {
        success: true,
        messageId: result.messageId
      };

    } catch (error) {
      logger.error('❌ Failed to send test email', {
        error: error.message,
        recipient: options.recipient
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check Brevo account information and connectivity
   */
  async testConnection(): Promise<{
    success: boolean;
    accountInfo?: any;
    error?: string;
  }> {
    try {
      logger.info('🔍 Testing Brevo connection...');

      const response = await axios.get(`${this.baseUrl}/account`, {
        headers: {
          'api-key': this.apiKey
        }
      });
      
      const account = response.data;
      
      logger.info('✅ Brevo connection successful', {
        email: account.email,
        firstName: account.firstName,
        lastName: account.lastName,
        companyName: account.companyName,
        plan: account.plan
      });

      return {
        success: true,
        accountInfo: {
          email: account.email,
          name: `${account.firstName} ${account.lastName}`,
          company: account.companyName,
          plan: account.plan
        }
      };

    } catch (error) {
      logger.error('❌ Brevo connection failed', {
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get delivery statistics from Brevo
   */
  async getDeliveryStats(startDate: string, endDate: string): Promise<{
    success: boolean;
    stats?: any;
    error?: string;
  }> {
    try {
      logger.info('📊 Fetching delivery statistics', {
        startDate,
        endDate
      });

      const response = await axios.get(`${this.baseUrl}/emailCampaigns/statistics/events`, {
        headers: {
          'api-key': this.apiKey
        },
        params: {
          limit: 50,
          offset: 0,
          startDate,
          endDate,
          sort: 'desc'
        }
      });
      
      const stats = response.data;

      logger.debug('📈 Delivery stats retrieved', {
        eventsCount: stats.events?.length || 0
      });

      return {
        success: true,
        stats
      };

    } catch (error) {
      logger.error('❌ Failed to get delivery stats', {
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle Brevo webhooks for delivery status updates
   */
  async handleWebhook(webhookData: any): Promise<BrevoDeliveryStatus | null> {
    try {
      logger.info('🔔 Processing Brevo webhook', {
        event: webhookData.event,
        messageId: webhookData.messageId,
        email: webhookData.email
      });

      const deliveryStatus: BrevoDeliveryStatus = {
        messageId: webhookData.messageId,
        status: this.mapBrevoEventToStatus(webhookData.event),
        timestamp: webhookData.timestamp || new Date().toISOString(),
        recipient: webhookData.email,
        subject: webhookData.subject || '',
        reason: webhookData.reason
      };

      if (this.debugMode) {
        logger.debug('🔄 Webhook processed', deliveryStatus);
      }

      return deliveryStatus;

    } catch (error) {
      logger.error('❌ Failed to process webhook', {
        error: error.message,
        webhookData
      });

      return null;
    }
  }

  /**
   * Generate CSV file with license keys
   */
  private async generateLicenseKeysCsv(orderData: EmailOrderData): Promise<string> {
    const filename = `license-keys-${orderData.orderNumber}-${Date.now()}.csv`;
    const tempDir = path.join(process.cwd(), 'temp');
    const filePath = path.join(tempDir, filename);
    
    // Ensure temp directory exists
    await fs.mkdir(tempDir, { recursive: true });
    
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'orderNumber', title: 'Order Number' },
        { id: 'productName', title: 'Product Name' },
        { id: 'sku', title: 'SKU' },
        { id: 'licenseKey', title: 'License Key' },
        { id: 'activationUrl', title: 'Activation URL' },
        { id: 'expirationDate', title: 'Expiration Date' },
        { id: 'orderDate', title: 'Order Date' }
      ]
    });

    const csvData = orderData.licenseKeys.map(key => ({
      orderNumber: orderData.orderNumber,
      productName: key.productName,
      sku: key.sku,
      licenseKey: key.licenseKey,
      activationUrl: key.activationUrl || 'N/A',
      expirationDate: key.expirationDate ? key.expirationDate.toISOString().split('T')[0] : 'Perpetual',
      orderDate: orderData.orderDate.toISOString().split('T')[0]
    }));

    await csvWriter.writeRecords(csvData);
    return filePath;
  }

  /**
   * Get email template based on tenant
   */
  private getOrderConfirmationTemplate(tenant: 'EUR' | 'KM') {
    return tenant === 'KM' ? this.getBosnianTemplate() : this.getEnglishTemplate();
  }

  /**
   * English template for EUR tenant
   */
  private getEnglishTemplate() {
    return {
      subject: 'Order Confirmation - {{orderNumber}}',
      htmlContent: `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
              .header { background-color: #6E6F71; color: white; padding: 30px 20px; text-align: center; }
              .header h1 { margin: 0; font-size: 28px; }
              .content { padding: 30px 20px; }
              .order-details { background-color: #f8f9fa; padding: 20px; margin: 25px 0; border-radius: 8px; border-left: 4px solid #FFB20F; }
              .items-table { width: 100%; border-collapse: collapse; margin: 25px 0; }
              .items-table th { background-color: #6E6F71; color: white; padding: 12px 10px; text-align: left; font-weight: bold; }
              .items-table td { padding: 12px 10px; border-bottom: 1px solid #e9ecef; }
              .items-table tbody tr:hover { background-color: #f8f9fa; }
              .total { font-weight: bold; color: #FFB20F; font-size: 1.3em; }
              .license-section { background-color: #e8f5e8; padding: 20px; margin: 25px 0; border-radius: 8px; }
              .steps-list { background-color: #fff3cd; padding: 20px; margin: 25px 0; border-radius: 8px; border-left: 4px solid #FFB20F; }
              .steps-list ul { margin: 10px 0; padding-left: 20px; }
              .steps-list li { margin: 8px 0; }
              .footer { background-color: #f8f9fa; padding: 25px 20px; text-align: center; margin-top: 30px; border-top: 1px solid #e9ecef; }
              .footer p { margin: 5px 0; color: #6c757d; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Order Confirmation</h1>
              </div>
              <div class="content">
                <p style="font-size: 16px; margin-bottom: 20px;">Dear <strong>{{customerName}}</strong>,</p>
                <p style="font-size: 16px; margin-bottom: 25px;">Thank you for your order! We've successfully processed your purchase and your license keys are ready for immediate use.</p>
                
                <div class="order-details">
                  <h3 style="margin-top: 0; color: #6E6F71;">Order Details</h3>
                  <p><strong>Order Number:</strong> {{orderNumber}}</p>
                  <p><strong>Order Date:</strong> {{orderDate}}</p>
                  <p><strong>Total Amount:</strong> <span class="total">{{totalAmount}} {{currency}}</span></p>
                </div>

                <h3 style="color: #6E6F71;">Items Purchased</h3>
                <table class="items-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {{#each items}}
                    <tr>
                      <td><strong>{{productName}}</strong></td>
                      <td>{{sku}}</td>
                      <td>{{quantity}}</td>
                      <td>{{unitPrice}} {{../currency}}</td>
                      <td><strong>{{totalPrice}} {{../currency}}</strong></td>
                    </tr>
                    {{/each}}
                  </tbody>
                </table>

                <div class="license-section">
                  <h3 style="margin-top: 0; color: #2d5016;">📋 License Keys Attached</h3>
                  <p>Your license keys have been attached to this email as a CSV file for easy import and management. The file contains all necessary activation information.</p>
                </div>
                
                <div class="steps-list">
                  <h3 style="margin-top: 0; color: #856404;">Next Steps</h3>
                  <ul>
                    <li><strong>Download</strong> and save the attached CSV file containing your license keys</li>
                    <li><strong>Activate</strong> your software using the license keys provided</li>
                    <li><strong>Store</strong> your license keys in a secure location for future reference</li>
                    <li><strong>Contact</strong> our support team if you need any assistance</li>
                  </ul>
                </div>
              </div>
              <div class="footer">
                <p><strong>Thank you for choosing our software solutions!</strong></p>
                <p>If you have any questions, please don't hesitate to contact our support team.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      textContent: `
Order Confirmation - {{orderNumber}}

Dear {{customerName}},

Thank you for your order! We've successfully processed your purchase and your license keys are ready for immediate use.

Order Details:
- Order Number: {{orderNumber}}
- Order Date: {{orderDate}}
- Total Amount: {{totalAmount}} {{currency}}

Items Purchased:
{{#each items}}
- {{productName}} ({{sku}}) - Qty: {{quantity}} - {{totalPrice}} {{../currency}}
{{/each}}

License Keys:
Your license keys have been attached to this email as a CSV file for easy management.

Next Steps:
1. Download and save the attached CSV file
2. Use the license keys to activate your software
3. Keep license keys secure for future reference
4. Contact support if you need assistance

Thank you for choosing our software solutions!
      `
    };
  }

  /**
   * Bosnian template for KM tenant
   */
  private getBosnianTemplate() {
    return {
      subject: 'Potvrda narudžbe - {{orderNumber}}',
      htmlContent: `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
              .header { background-color: #6E6F71; color: white; padding: 30px 20px; text-align: center; }
              .header h1 { margin: 0; font-size: 28px; }
              .content { padding: 30px 20px; }
              .order-details { background-color: #f8f9fa; padding: 20px; margin: 25px 0; border-radius: 8px; border-left: 4px solid #FFB20F; }
              .items-table { width: 100%; border-collapse: collapse; margin: 25px 0; }
              .items-table th { background-color: #6E6F71; color: white; padding: 12px 10px; text-align: left; font-weight: bold; }
              .items-table td { padding: 12px 10px; border-bottom: 1px solid #e9ecef; }
              .items-table tbody tr:hover { background-color: #f8f9fa; }
              .total { font-weight: bold; color: #FFB20F; font-size: 1.3em; }
              .license-section { background-color: #e8f5e8; padding: 20px; margin: 25px 0; border-radius: 8px; }
              .steps-list { background-color: #fff3cd; padding: 20px; margin: 25px 0; border-radius: 8px; border-left: 4px solid #FFB20F; }
              .steps-list ul { margin: 10px 0; padding-left: 20px; }
              .steps-list li { margin: 8px 0; }
              .footer { background-color: #f8f9fa; padding: 25px 20px; text-align: center; margin-top: 30px; border-top: 1px solid #e9ecef; }
              .footer p { margin: 5px 0; color: #6c757d; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Potvrda narudžbe</h1>
              </div>
              <div class="content">
                <p style="font-size: 16px; margin-bottom: 20px;">Poštovani <strong>{{customerName}}</strong>,</p>
                <p style="font-size: 16px; margin-bottom: 25px;">Hvala vam na narudžbi! Uspješno smo obradili vašu kupovinu i vaši licencni ključevi su spremni za korištenje.</p>
                
                <div class="order-details">
                  <h3 style="margin-top: 0; color: #6E6F71;">Detalji narudžbe</h3>
                  <p><strong>Broj narudžbe:</strong> {{orderNumber}}</p>
                  <p><strong>Datum narudžbe:</strong> {{orderDate}}</p>
                  <p><strong>Ukupan iznos:</strong> <span class="total">{{totalAmount}} {{currency}}</span></p>
                </div>

                <h3 style="color: #6E6F71;">Kupljene stavke</h3>
                <table class="items-table">
                  <thead>
                    <tr>
                      <th>Proizvod</th>
                      <th>SKU</th>
                      <th>Količina</th>
                      <th>Jedinična cijena</th>
                      <th>Ukupno</th>
                    </tr>
                  </thead>
                  <tbody>
                    {{#each items}}
                    <tr>
                      <td><strong>{{productName}}</strong></td>
                      <td>{{sku}}</td>
                      <td>{{quantity}}</td>
                      <td>{{unitPrice}} {{../currency}}</td>
                      <td><strong>{{totalPrice}} {{../currency}}</strong></td>
                    </tr>
                    {{/each}}
                  </tbody>
                </table>

                <div class="license-section">
                  <h3 style="margin-top: 0; color: #2d5016;">📋 Licencni ključevi priloženi</h3>
                  <p>Vaši licencni ključevi su priloženi ovom e-mailu kao CSV datoteka za lakše upravljanje. Datoteka sadrži sve potrebne informacije za aktivaciju.</p>
                </div>
                
                <div class="steps-list">
                  <h3 style="margin-top: 0; color: #856404;">Sljedeći koraci</h3>
                  <ul>
                    <li><strong>Preuzmite</strong> i sačuvajte priloženu CSV datoteku sa licencnim ključevima</li>
                    <li><strong>Aktivirajte</strong> vaš softver koristeći priložene licencne ključeve</li>
                    <li><strong>Čuvajte</strong> licencne ključeve na sigurnom mjestu za buduću referencu</li>
                    <li><strong>Kontaktirajte</strong> našu podršku ako vam je potrebna pomoć</li>
                  </ul>
                </div>
              </div>
              <div class="footer">
                <p><strong>Hvala vam što ste odabrali naša softverska rješenja!</strong></p>
                <p>Ako imate bilo kakvih pitanja, molimo kontaktirajte našu podršku.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      textContent: `
Potvrda narudžbe - {{orderNumber}}

Poštovani {{customerName}},

Hvala vam na narudžbi! Uspješno smo obradili vašu kupovinu i vaši licencni ključevi su spremni za korištenje.

Detalji narudžbe:
- Broj narudžbe: {{orderNumber}}
- Datum narudžbe: {{orderDate}}
- Ukupan iznos: {{totalAmount}} {{currency}}

Kupljene stavke:
{{#each items}}
- {{productName}} ({{sku}}) - Količina: {{quantity}} - {{totalPrice}} {{../currency}}
{{/each}}

Licencni ključevi:
Vaši licencni ključevi su priloženi ovom e-mailu kao CSV datoteka.

Sljedeći koraci:
1. Preuzmite i sačuvajte priloženu CSV datoteku
2. Koristite licencne ključeve za aktivaciju softvera
3. Čuvajte licencne ključeve sigurno za buduću referencu
4. Kontaktirajte podršku ako trebate pomoć

Hvala vam što ste odabrali naša softverska rješenja!
      `
    };
  }

  /**
   * Prepare email template data
   */
  private prepareEmailData(orderData: EmailOrderData) {
    return {
      ...orderData,
      orderDate: orderData.orderDate.toLocaleDateString(),
      totalAmount: orderData.totalAmount.toFixed(2),
      items: orderData.items.map(item => ({
        ...item,
        unitPrice: item.unitPrice.toFixed(2),
        totalPrice: item.totalPrice.toFixed(2)
      }))
    };
  }

  /**
   * Simple template rendering (Handlebars-like)
   */
  private renderTemplate(template: string, data: any): string {
    let result = template;
    
    // Replace simple variables {{variable}}
    result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });

    // Handle each loops {{#each items}}
    result = result.replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayKey, itemTemplate) => {
      const array = data[arrayKey];
      if (!Array.isArray(array)) return '';
      
      return array.map(item => {
        let itemResult = itemTemplate;
        // Replace item properties {{property}}
        itemResult = itemResult.replace(/\{\{(\w+)\}\}/g, (propMatch, propKey) => {
          return item[propKey] !== undefined ? String(item[propKey]) : propMatch;
        });
        // Replace parent data {{../property}}
        itemResult = itemResult.replace(/\{\{\.\.\/(\w+)\}\}/g, (parentMatch, parentKey) => {
          return data[parentKey] !== undefined ? String(data[parentKey]) : parentMatch;
        });
        return itemResult;
      }).join('');
    });

    return result;
  }

  /**
   * Get default test data
   */
  private getDefaultTestData(tenant: 'EUR' | 'KM') {
    return {
      orderNumber: 'TEST-001',
      customerName: tenant === 'KM' ? 'Test Korisnik' : 'Test Customer',
      orderDate: new Date().toLocaleDateString(),
      totalAmount: '199.99',
      currency: tenant === 'KM' ? 'KM' : 'EUR',
      items: [
        {
          productName: tenant === 'KM' ? 'Antivirus Pro Sigurnost' : 'Antivirus Pro Security',
          sku: 'SKU-12345',
          quantity: 1,
          unitPrice: '199.99',
          totalPrice: '199.99'
        }
      ]
    };
  }

  /**
   * Map Brevo webhook events to our status enum
   */
  private mapBrevoEventToStatus(event: string): BrevoDeliveryStatus['status'] {
    const eventMap: { [key: string]: BrevoDeliveryStatus['status'] } = {
      'delivered': 'delivered',
      'bounce': 'bounced',
      'softBounce': 'soft_bounced',
      'blocked': 'blocked',
      'spam': 'spam',
      'opened': 'opened',
      'clicked': 'clicked'
    };

    return eventMap[event] || 'delivered';
  }
}