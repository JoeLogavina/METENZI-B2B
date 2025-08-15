import { logger } from '../lib/logger';

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'date' | 'currency' | 'url' | 'image';
  required: boolean;
  description?: string;
  defaultValue?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
}

export interface Template {
  id: string;
  name: string;
  type: 'order_confirmation' | 'license_delivery' | 'payment_failed' | 'welcome' | 'support_ticket' | 'custom';
  tenant?: 'EUR' | 'KM';
  language: 'en' | 'bs';
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: TemplateVariable[];
  variants?: {
    [key: string]: {
      subject?: string;
      htmlContent?: string;
      textContent?: string;
    };
  };
  metadata?: {
    category: string;
    tags: string[];
    version: string;
    lastModified: Date;
    createdBy: string;
  };
}

export interface RenderContext {
  user: any;
  order?: any;
  products?: any[];
  licenseKeys?: any[];
  supportTicket?: any;
  personalizations?: Record<string, any>;
  tenant: 'EUR' | 'KM';
  language: 'en' | 'bs';
  currency: string;
  branding?: {
    logoUrl: string;
    primaryColor: string;
    companyName: string;
  };
}

export class NotificationTemplateEngine {
  private templates: Map<string, Template> = new Map();
  private helpers: Map<string, Function> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
    this.initializeHelpers();
  }

  /**
   * Initialize default email templates for the B2B platform
   */
  private initializeDefaultTemplates(): void {
    // EUR Tenant Templates (English)
    this.templates.set('order-confirmation-eur', {
      id: 'order-confirmation-eur',
      name: 'Order Confirmation - EUR',
      type: 'order_confirmation',
      tenant: 'EUR',
      language: 'en',
      subject: 'Order Confirmation #{{order.orderNumber}} - {{company.name}}',
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Confirmation</title>
          <style>
            body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f6f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background-color: #23252f; padding: 30px; text-align: center; }
            .logo { color: #FFB20F; font-size: 24px; font-weight: bold; }
            .content { padding: 40px 30px; }
            .order-summary { background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .product-item { border-bottom: 1px solid #eee; padding: 15px 0; }
            .license-keys { background-color: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .key-item { font-family: monospace; background: white; padding: 10px; margin: 5px 0; border-radius: 4px; }
            .footer { background-color: #f5f6f5; padding: 20px 30px; text-align: center; font-size: 12px; color: #6E6F71; }
            .button { background-color: #FFB20F; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
            .highlight { color: #FFB20F; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">{{company.name}}</div>
              <p style="color: white; margin: 10px 0 0 0;">Software License Management Platform</p>
            </div>
            
            <div class="content">
              <h1 style="color: #23252f; margin-bottom: 10px;">Order Confirmed!</h1>
              <p>{{greeting}},</p>
              
              <p>Thank you for your order! We're excited to provide you with your software licenses.</p>
              
              <div class="order-summary">
                <h3 style="margin-top: 0; color: #23252f;">Order Summary</h3>
                <table style="width: 100%;">
                  <tr>
                    <td><strong>Order Number:</strong></td>
                    <td class="highlight">#{{order.orderNumber}}</td>
                  </tr>
                  <tr>
                    <td><strong>Order Date:</strong></td>
                    <td>{{formatDate order.createdAt}}</td>
                  </tr>
                  <tr>
                    <td><strong>Total Amount:</strong></td>
                    <td class="highlight">{{formatCurrency order.totalAmount 'EUR'}}</td>
                  </tr>
                  <tr>
                    <td><strong>Payment Status:</strong></td>
                    <td><span style="color: green;">✓ Paid</span></td>
                  </tr>
                </table>
              </div>

              {{#if products}}
              <h3 style="color: #23252f;">Products Ordered</h3>
              {{#each products}}
              <div class="product-item">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <strong>{{this.name}}</strong><br>
                    <small style="color: #6E6F71;">SKU: {{this.sku}}</small>
                  </div>
                  <div style="text-align: right;">
                    <strong>{{formatCurrency this.price 'EUR'}}</strong><br>
                    <small>Qty: {{this.quantity}}</small>
                  </div>
                </div>
              </div>
              {{/each}}
              {{/if}}

              {{#if licenseKeys}}
              <div class="license-keys">
                <h3 style="margin-top: 0; color: #23252f;">🔑 Your License Keys</h3>
                <p><strong>Important:</strong> Please save these license keys securely. You'll need them to activate your software.</p>
                
                {{#each licenseKeys}}
                <div style="margin-bottom: 15px;">
                  <strong>{{this.productName}}</strong><br>
                  <div class="key-item">
                    <strong>License Key:</strong> {{this.licenseKey}}<br>
                    {{#if this.downloadUrl}}
                    <strong>Download:</strong> <a href="{{this.downloadUrl}}" style="color: #FFB20F;">Download Software</a><br>
                    {{/if}}
                    {{#if this.activationInstructions}}
                    <strong>Instructions:</strong> {{this.activationInstructions}}
                    {{/if}}
                  </div>
                </div>
                {{/each}}
              </div>
              {{/if}}

              <div style="margin: 30px 0;">
                <a href="{{portalUrl}}/orders/{{order.id}}" class="button">View Order Details</a>
              </div>

              <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #23252f;">Need Help?</h4>
                <p>If you have any questions about your order or need assistance with installation, our support team is here to help:</p>
                <ul>
                  <li>📧 Email: <a href="mailto:support@software-codes.com" style="color: #FFB20F;">support@software-codes.com</a></li>
                  <li>💬 Support Portal: <a href="{{portalUrl}}/support" style="color: #FFB20F;">{{portalUrl}}/support</a></li>
                  <li>📱 Phone: +387 61 234 567 (Business Hours: 9:00-17:00 CET)</li>
                </ul>
              </div>

              <p>Thank you for choosing {{company.name}} for your software licensing needs!</p>
              
              <p>Best regards,<br>
              The {{company.name}} Team</p>
            </div>
            
            <div class="footer">
              <p>{{company.name}} | {{company.address}}<br>
              This is an automated email. Please do not reply directly to this message.</p>
              <p><a href="{{unsubscribeUrl}}" style="color: #6E6F71;">Unsubscribe</a> | <a href="{{portalUrl}}/privacy" style="color: #6E6F71;">Privacy Policy</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      textContent: `
Order Confirmation #{{order.orderNumber}}

{{greeting}},

Thank you for your order! Here are the details:

Order Number: #{{order.orderNumber}}
Order Date: {{formatDate order.createdAt}}
Total Amount: {{formatCurrency order.totalAmount 'EUR'}}
Payment Status: Paid

{{#if licenseKeys}}
YOUR LICENSE KEYS:
{{#each licenseKeys}}
Product: {{this.productName}}
License Key: {{this.licenseKey}}
{{#if this.downloadUrl}}Download: {{this.downloadUrl}}{{/if}}
{{#if this.activationInstructions}}Instructions: {{this.activationInstructions}}{{/if}}

{{/each}}
{{/if}}

Need help? Contact our support team:
Email: support@software-codes.com
Support Portal: {{portalUrl}}/support
Phone: +387 61 234 567

Best regards,
The {{company.name}} Team
      `,
      variables: [
        { name: 'greeting', type: 'string', required: true, description: 'Personalized greeting' },
        { name: 'order', type: 'string', required: true, description: 'Order object' },
        { name: 'products', type: 'string', required: false, description: 'Array of products' },
        { name: 'licenseKeys', type: 'string', required: false, description: 'Array of license keys' },
        { name: 'company', type: 'string', required: true, description: 'Company information' },
        { name: 'portalUrl', type: 'url', required: true, description: 'Portal base URL' }
      ],
      variants: {
        premium: {
          subject: '🌟 Premium Order Confirmation #{{order.orderNumber}} - VIP Service',
          htmlContent: `<!-- Premium variant with enhanced styling and VIP messaging -->`
        },
        minimal: {
          subject: 'Order #{{order.orderNumber}} Confirmed',
          htmlContent: `<!-- Minimal variant with clean, simple design -->`
        }
      }
    });

    // KM Tenant Templates (Bosnian)
    this.templates.set('order-confirmation-km', {
      id: 'order-confirmation-km',
      name: 'Potvrda Narudžbe - KM',
      type: 'order_confirmation',
      tenant: 'KM',
      language: 'bs',
      subject: 'Potvrda narudžbe #{{order.orderNumber}} - {{company.name}}',
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Potvrda Narudžbe</title>
          <style>
            body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f6f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background-color: #23252f; padding: 30px; text-align: center; }
            .logo { color: #FFB20F; font-size: 24px; font-weight: bold; }
            .content { padding: 40px 30px; }
            .order-summary { background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .product-item { border-bottom: 1px solid #eee; padding: 15px 0; }
            .license-keys { background-color: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .key-item { font-family: monospace; background: white; padding: 10px; margin: 5px 0; border-radius: 4px; }
            .footer { background-color: #f5f6f5; padding: 20px 30px; text-align: center; font-size: 12px; color: #6E6F71; }
            .button { background-color: #FFB20F; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
            .highlight { color: #FFB20F; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">{{company.name}}</div>
              <p style="color: white; margin: 10px 0 0 0;">Platforma za upravljanje softverskim licencama</p>
            </div>
            
            <div class="content">
              <h1 style="color: #23252f; margin-bottom: 10px;">Narudžba potvrđena!</h1>
              <p>{{greeting}},</p>
              
              <p>Hvala vam na narudžbi! Veselimo se što možemo da vam pružimo vaše softverske licence.</p>
              
              <div class="order-summary">
                <h3 style="margin-top: 0; color: #23252f;">Pregled narudžbe</h3>
                <table style="width: 100%;">
                  <tr>
                    <td><strong>Broj narudžbe:</strong></td>
                    <td class="highlight">#{{order.orderNumber}}</td>
                  </tr>
                  <tr>
                    <td><strong>Datum narudžbe:</strong></td>
                    <td>{{formatDate order.createdAt}}</td>
                  </tr>
                  <tr>
                    <td><strong>Ukupan iznos:</strong></td>
                    <td class="highlight">{{formatCurrency order.totalAmount 'BAM'}}</td>
                  </tr>
                  <tr>
                    <td><strong>Status plaćanja:</strong></td>
                    <td><span style="color: green;">✓ Plaćeno</span></td>
                  </tr>
                </table>
              </div>

              {{#if licenseKeys}}
              <div class="license-keys">
                <h3 style="margin-top: 0; color: #23252f;">🔑 Vaši licencni ključevi</h3>
                <p><strong>Važno:</strong> Molimo vas da sigurno sačuvate ove licencne ključeve. Trebat će vam za aktivaciju softvera.</p>
                
                {{#each licenseKeys}}
                <div style="margin-bottom: 15px;">
                  <strong>{{this.productName}}</strong><br>
                  <div class="key-item">
                    <strong>Licencni ključ:</strong> {{this.licenseKey}}<br>
                    {{#if this.downloadUrl}}
                    <strong>Preuzimanje:</strong> <a href="{{this.downloadUrl}}" style="color: #FFB20F;">Preuzmite softver</a><br>
                    {{/if}}
                    {{#if this.activationInstructions}}
                    <strong>Uputstva:</strong> {{this.activationInstructions}}
                    {{/if}}
                  </div>
                </div>
                {{/each}}
              </div>
              {{/if}}

              <div style="margin: 30px 0;">
                <a href="{{portalUrl}}/orders/{{order.id}}" class="button">Pogledajte detalje narudžbe</a>
              </div>

              <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #23252f;">Trebate pomoć?</h4>
                <p>Ako imate pitanja o vašoj narudžbi ili trebate pomoć sa instalacijom, naš tim za podršku je tu da vam pomogne:</p>
                <ul>
                  <li>📧 Email: <a href="mailto:support@software-codes.com" style="color: #FFB20F;">support@software-codes.com</a></li>
                  <li>💬 Portal za podršku: <a href="{{portalUrl}}/support" style="color: #FFB20F;">{{portalUrl}}/support</a></li>
                  <li>📱 Telefon: +387 61 234 567 (Radno vrijeme: 9:00-17:00 CET)</li>
                </ul>
              </div>

              <p>Hvala vam što ste odabrali {{company.name}} za vaše potrebe licenciranja softvera!</p>
              
              <p>Srdačni pozdravi,<br>
              Tim {{company.name}}</p>
            </div>
            
            <div class="footer">
              <p>{{company.name}} | {{company.address}}<br>
              Ovo je automatski email. Molimo vas da ne odgovarate direktno na ovu poruku.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      textContent: `
Potvrda narudžbe #{{order.orderNumber}}

{{greeting}},

Hvala vam na narudžbi! Evo detalja:

Broj narudžbe: #{{order.orderNumber}}
Datum narudžbe: {{formatDate order.createdAt}}
Ukupan iznos: {{formatCurrency order.totalAmount 'BAM'}}
Status plaćanja: Plaćeno

{{#if licenseKeys}}
VAŠI LICENCNI KLJUČEVI:
{{#each licenseKeys}}
Proizvod: {{this.productName}}
Licencni ključ: {{this.licenseKey}}
{{#if this.downloadUrl}}Preuzimanje: {{this.downloadUrl}}{{/if}}

{{/each}}
{{/if}}

Trebate pomoć? Kontaktirajte naš tim za podršku:
Email: support@software-codes.com
Portal za podršku: {{portalUrl}}/support
Telefon: +387 61 234 567

Srdačni pozdravi,
Tim {{company.name}}
      `,
      variables: [
        { name: 'greeting', type: 'string', required: true, description: 'Personalized greeting' },
        { name: 'order', type: 'string', required: true, description: 'Order object' },
        { name: 'products', type: 'string', required: false, description: 'Array of products' },
        { name: 'licenseKeys', type: 'string', required: false, description: 'Array of license keys' },
        { name: 'company', type: 'string', required: true, description: 'Company information' },
        { name: 'portalUrl', type: 'url', required: true, description: 'Portal base URL' }
      ]
    });

    // Payment Failed Templates
    this.templates.set('payment-failed-eur', {
      id: 'payment-failed-eur',
      name: 'Payment Failed - EUR',
      type: 'payment_failed',
      tenant: 'EUR',
      language: 'en',
      subject: 'Payment Issue - Order #{{order.orderNumber}} Requires Attention',
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Issue</title>
          <style>
            body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f6f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background-color: #E15554; padding: 30px; text-align: center; }
            .logo { color: white; font-size: 24px; font-weight: bold; }
            .content { padding: 40px 30px; }
            .alert-box { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .button { background-color: #FFB20F; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
            .footer { background-color: #f5f6f5; padding: 20px 30px; text-align: center; font-size: 12px; color: #6E6F71; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">{{company.name}}</div>
              <p style="color: white; margin: 10px 0 0 0;">Payment Issue Notification</p>
            </div>
            
            <div class="content">
              <h1 style="color: #E15554; margin-bottom: 10px;">Payment Issue Detected</h1>
              <p>{{greeting}},</p>
              
              <div class="alert-box">
                <h3 style="margin-top: 0; color: #856404;">⚠️ Action Required</h3>
                <p>We encountered an issue processing payment for your order #{{order.orderNumber}}. Your order is currently on hold pending payment resolution.</p>
              </div>

              <p><strong>Order Details:</strong></p>
              <ul>
                <li>Order Number: #{{order.orderNumber}}</li>
                <li>Amount: {{formatCurrency order.totalAmount 'EUR'}}</li>
                <li>Payment Method: {{order.paymentMethod}}</li>
                <li>Issue: {{paymentError}}</li>
              </ul>

              <h3>What happens next?</h3>
              <p>Don't worry - this is easily resolved! Here are your options:</p>
              
              <ol>
                <li><strong>Retry Payment:</strong> Click the button below to update your payment information and try again.</li>
                <li><strong>Use Different Payment Method:</strong> Try a different card or payment method.</li>
                <li><strong>Contact Support:</strong> Our team can help resolve any payment issues.</li>
              </ol>

              <div style="margin: 30px 0; text-align: center;">
                <a href="{{retryPaymentUrl}}" class="button">Retry Payment Now</a>
              </div>

              <p><strong>Need immediate assistance?</strong> Our support team is ready to help:</p>
              <ul>
                <li>📧 Email: <a href="mailto:support@software-codes.com">support@software-codes.com</a></li>
                <li>💬 Live Chat: <a href="{{portalUrl}}/support">{{portalUrl}}/support</a></li>
                <li>📱 Phone: +387 61 234 567</li>
              </ul>

              <p>We appreciate your business and look forward to resolving this quickly!</p>
              
              <p>Best regards,<br>
              The {{company.name}} Team</p>
            </div>
            
            <div class="footer">
              <p>{{company.name}} | This email was sent because your payment requires attention.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      textContent: `
Payment Issue - Order #{{order.orderNumber}}

{{greeting}},

We encountered an issue processing payment for your order #{{order.orderNumber}}.

Order Details:
- Order Number: #{{order.orderNumber}}
- Amount: {{formatCurrency order.totalAmount 'EUR'}}
- Issue: {{paymentError}}

To resolve this issue:
1. Retry payment: {{retryPaymentUrl}}
2. Contact support: support@software-codes.com
3. Call us: +387 61 234 567

Best regards,
The {{company.name}} Team
      `,
      variables: [
        { name: 'greeting', type: 'string', required: true },
        { name: 'order', type: 'string', required: true },
        { name: 'paymentError', type: 'string', required: true },
        { name: 'retryPaymentUrl', type: 'url', required: true },
        { name: 'company', type: 'string', required: true },
        { name: 'portalUrl', type: 'url', required: true }
      ]
    });

    logger.info('📧 Template engine initialized', {
      templates: this.templates.size
    });
  }

  /**
   * Initialize template helpers
   */
  private initializeHelpers(): void {
    // Date formatting helper
    this.helpers.set('formatDate', (date: Date | string, format?: string): string => {
      const d = new Date(date);
      if (isNaN(d.getTime())) return 'Invalid Date';
      
      return new Intl.DateTimeFormat('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(d);
    });

    // Currency formatting helper
    this.helpers.set('formatCurrency', (amount: number, currency: string = 'EUR'): string => {
      if (isNaN(amount)) return '0.00';
      
      const formatter = new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: currency === 'BAM' ? 'BAM' : 'EUR',
        minimumFractionDigits: 2
      });
      
      return formatter.format(amount);
    });

    // URL helper
    this.helpers.set('url', (path: string, baseUrl?: string): string => {
      const base = baseUrl || process.env.BASE_URL || 'https://app.software-codes.com';
      return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
    });

    // Conditional helper
    this.helpers.set('if', (condition: any): boolean => {
      return !!condition;
    });

    // Loop helper  
    this.helpers.set('each', (array: any[]): any[] => {
      return Array.isArray(array) ? array : [];
    });

    logger.info('🔧 Template helpers initialized', {
      helpers: this.helpers.size
    });
  }

  /**
   * Render template with context
   */
  async renderTemplate(templateId: string, context: RenderContext, variant?: string): Promise<{
    subject: string;
    htmlContent: string;
    textContent: string;
  }> {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Get template content (with variant if specified)
      const templateContent = variant && template.variants?.[variant] 
        ? { ...template, ...template.variants[variant] }
        : template;

      // Prepare rendering context
      const renderContext = {
        ...context,
        helpers: Object.fromEntries(this.helpers),
        // Add computed values
        company: {
          name: context.tenant === 'EUR' ? 'Software Codes EU' : 'Software Codes KM',
          address: context.tenant === 'EUR' 
            ? 'München, Germany' 
            : 'Sarajevo, Bosnia and Herzegovina'
        },
        portalUrl: context.tenant === 'EUR' 
          ? 'https://eur.software-codes.com' 
          : 'https://km.software-codes.com',
        unsubscribeUrl: `https://app.software-codes.com/unsubscribe?token={{unsubscribe_token}}`
      };

      // Render each part
      const subject = await this.renderString(templateContent.subject, renderContext);
      const htmlContent = await this.renderString(templateContent.htmlContent, renderContext);
      const textContent = await this.renderString(templateContent.textContent, renderContext);

      logger.info('📧 Template rendered successfully', {
        templateId,
        variant,
        language: template.language,
        tenant: template.tenant
      });

      return {
        subject: subject.trim(),
        htmlContent: htmlContent.trim(),
        textContent: textContent.trim()
      };
    } catch (error) {
      logger.error('❌ Template rendering failed', {
        templateId,
        variant,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Render string template with Handlebars-like syntax
   */
  private async renderString(template: string, context: any): Promise<string> {
    let result = template;

    // Simple variable replacement {{variable}}
    result = result.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
      return this.evaluateExpression(expression.trim(), context);
    });

    // Handle conditional blocks {{#if condition}}...{{/if}}
    result = result.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
      const conditionResult = this.evaluateExpression(condition.trim(), context);
      return conditionResult ? content : '';
    });

    // Handle each blocks {{#each array}}...{{/each}}
    result = result.replace(/\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayPath, content) => {
      const array = this.getNestedValue(context, arrayPath.trim());
      if (!Array.isArray(array)) return '';

      return array.map((item, index) => {
        const itemContext = { ...context, this: item, index, '@index': index };
        return this.renderStringSync(content, itemContext);
      }).join('');
    });

    return result;
  }

  /**
   * Synchronous string rendering for nested operations
   */
  private renderStringSync(template: string, context: any): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
      return this.evaluateExpression(expression.trim(), context);
    });
  }

  /**
   * Evaluate template expression
   */
  private evaluateExpression(expression: string, context: any): string {
    try {
      // Handle helper functions like formatCurrency amount 'EUR'
      const helperMatch = expression.match(/^(\w+)\s+(.+)$/);
      if (helperMatch) {
        const [, helperName, args] = helperMatch;
        const helper = this.helpers.get(helperName);
        if (helper) {
          const argValues = this.parseArguments(args, context);
          return String(helper(...argValues));
        }
      }

      // Handle simple property access
      return String(this.getNestedValue(context, expression) || '');
    } catch (error) {
      logger.warn('⚠️ Expression evaluation failed', {
        expression,
        error: error instanceof Error ? error.message : String(error)
      });
      return `{{${expression}}}`;
    }
  }

  /**
   * Parse helper function arguments
   */
  private parseArguments(argsString: string, context: any): any[] {
    const args: any[] = [];
    const parts = argsString.match(/(?:[^\s'"]+|'[^']*'|"[^"]*")+/g) || [];

    for (const part of parts) {
      if (part.startsWith("'") && part.endsWith("'")) {
        // String literal
        args.push(part.slice(1, -1));
      } else if (part.startsWith('"') && part.endsWith('"')) {
        // String literal
        args.push(part.slice(1, -1));
      } else if (!isNaN(Number(part))) {
        // Number literal
        args.push(Number(part));
      } else {
        // Variable reference
        args.push(this.getNestedValue(context, part));
      }
    }

    return args;
  }

  /**
   * Get nested property value
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current?.[key];
    }, obj);
  }

  /**
   * Get available templates
   */
  getTemplates(tenant?: string, type?: string): Template[] {
    const templates = Array.from(this.templates.values());
    return templates.filter(template => {
      if (tenant && template.tenant && template.tenant !== tenant) return false;
      if (type && template.type !== type) return false;
      return true;
    });
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): Template | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Register custom template
   */
  registerTemplate(template: Template): void {
    this.templates.set(template.id, template);
    logger.info('📧 Custom template registered', {
      templateId: template.id,
      type: template.type,
      tenant: template.tenant
    });
  }

  /**
   * Preview template rendering
   */
  async previewTemplate(templateId: string, variant?: string): Promise<{
    subject: string;
    htmlContent: string;
    textContent: string;
  }> {
    // Create sample context for preview
    const sampleContext: RenderContext = {
      user: {
        id: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        companyName: 'Sample Company Ltd',
        tenantId: 'eur'
      },
      order: {
        id: 'order-456',
        orderNumber: '2025-0001',
        totalAmount: 299.99,
        createdAt: new Date(),
        paymentMethod: 'Credit Card'
      },
      products: [
        {
          id: 'prod-1',
          name: 'Professional Software License',
          sku: 'SKU-12345',
          price: 199.99,
          quantity: 1
        },
        {
          id: 'prod-2',
          name: 'Premium Support Package',
          sku: 'SKU-67890',
          price: 100.00,
          quantity: 1
        }
      ],
      licenseKeys: [
        {
          productName: 'Professional Software License',
          licenseKey: 'XXXX-YYYY-ZZZZ-AAAA',
          downloadUrl: 'https://downloads.software-codes.com/software/pro',
          activationInstructions: 'Enter this key during software installation.'
        }
      ],
      personalizations: {
        greeting: 'Dear John',
        currency_symbol: '€',
        is_vip: false
      },
      tenant: 'EUR',
      language: 'en',
      currency: 'EUR'
    };

    return await this.renderTemplate(templateId, sampleContext, variant);
  }
}

// Export singleton instance
export const templateEngine = new NotificationTemplateEngine();