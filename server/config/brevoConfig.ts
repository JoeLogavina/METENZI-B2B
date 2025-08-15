import { logger } from '../utils/logger';

export interface BrevoConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  testMode: boolean;
  testEmail?: string;
  webhookSecret?: string;
  maxRetries: number;
  retryDelays: number[];
  debugMode: boolean;
}

export function getBrevoConfig(): BrevoConfig {
  // Validate required environment variables
  if (!process.env.BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY environment variable is required');
  }

  if (!process.env.BREVO_FROM_EMAIL) {
    throw new Error('BREVO_FROM_EMAIL environment variable is required');
  }

  const config: BrevoConfig = {
    apiKey: process.env.BREVO_API_KEY,
    fromEmail: process.env.BREVO_FROM_EMAIL,
    fromName: process.env.BREVO_FROM_NAME || 'Software Solutions',
    testMode: process.env.BREVO_TEST_MODE === 'true',
    testEmail: process.env.BREVO_TEST_EMAIL,
    webhookSecret: process.env.BREVO_WEBHOOK_SECRET,
    maxRetries: parseInt(process.env.BREVO_MAX_RETRIES || '3'),
    retryDelays: process.env.BREVO_RETRY_DELAYS 
      ? process.env.BREVO_RETRY_DELAYS.split(',').map(d => parseInt(d))
      : [5 * 60 * 1000, 30 * 60 * 1000, 2 * 60 * 60 * 1000], // 5min, 30min, 2h
    debugMode: process.env.NODE_ENV === 'development'
  };

  // Log configuration (without sensitive data)
  if (config.debugMode) {
    logger.info('🔧 Brevo configuration loaded', {
      fromEmail: config.fromEmail,
      fromName: config.fromName,
      testMode: config.testMode,
      hasTestEmail: !!config.testEmail,
      hasWebhookSecret: !!config.webhookSecret,
      maxRetries: config.maxRetries,
      retryDelaysCount: config.retryDelays.length
    });
  }

  return config;
}

export function validateBrevoEnvironment(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required variables
  if (!process.env.BREVO_API_KEY) {
    errors.push('BREVO_API_KEY is required');
  }

  if (!process.env.BREVO_FROM_EMAIL) {
    errors.push('BREVO_FROM_EMAIL is required');
  }

  // Optional but recommended variables
  if (!process.env.BREVO_FROM_NAME) {
    warnings.push('BREVO_FROM_NAME not set, using default');
  }

  if (!process.env.BREVO_TEST_EMAIL && process.env.NODE_ENV === 'development') {
    warnings.push('BREVO_TEST_EMAIL not set, email tests will be skipped');
  }

  if (!process.env.BREVO_WEBHOOK_SECRET) {
    warnings.push('BREVO_WEBHOOK_SECRET not set, webhook security will be limited');
  }

  // Validate email format
  if (process.env.BREVO_FROM_EMAIL && !isValidEmail(process.env.BREVO_FROM_EMAIL)) {
    errors.push('BREVO_FROM_EMAIL must be a valid email address');
  }

  if (process.env.BREVO_TEST_EMAIL && !isValidEmail(process.env.BREVO_TEST_EMAIL)) {
    errors.push('BREVO_TEST_EMAIL must be a valid email address');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Export default configuration
export const brevoConfig = getBrevoConfig();