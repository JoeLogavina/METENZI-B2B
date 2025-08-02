// 🔒 COMPREHENSIVE SECURITY & ENCRYPTION LAYER
// Implementation based on your architecture diagram

import { Request, Response, NextFunction, Express } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../lib/logger';

// ===== 1. AES-256 ENCRYPTION FOR DIGITAL KEYS =====
export class DigitalKeyEncryption {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;

  // Encrypt digital license keys
  static encryptLicenseKey(licenseKey: string, masterKey?: string): string {
    try {
      const key = masterKey ? Buffer.from(masterKey, 'hex') : this.getMasterKey();
      const iv = crypto.randomBytes(this.IV_LENGTH);
      const cipher = crypto.createCipher(this.ALGORITHM, key);
      
      // Add authenticated data for license validation
      cipher.setAAD(Buffer.from('license-key-v1'));
      
      let encrypted = cipher.update(licenseKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag();
      
      // Format: version:iv:tag:encrypted
      return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
    } catch (error) {
      logger.error('License key encryption failed', { error: error.message });
      throw new Error('Failed to encrypt license key');
    }
  }

  // Decrypt digital license keys
  static decryptLicenseKey(encryptedKey: string, masterKey?: string): string {
    try {
      const key = masterKey ? Buffer.from(masterKey, 'hex') : this.getMasterKey();
      const [version, ivHex, tagHex, encrypted] = encryptedKey.split(':');
      
      if (version !== 'v1' || !ivHex || !tagHex || !encrypted) {
        throw new Error('Invalid encrypted key format');
      }

      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const decipher = crypto.createDecipher(this.ALGORITHM, key);
      
      decipher.setAAD(Buffer.from('license-key-v1'));
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('License key decryption failed', { error: error.message });
      throw new Error('Failed to decrypt license key');
    }
  }

  private static getMasterKey(): Buffer {
    const keyHex = process.env.DIGITAL_KEY_ENCRYPTION_MASTER;
    if (!keyHex) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Critical: DIGITAL_KEY_ENCRYPTION_MASTER not configured');
      }
      return crypto.randomBytes(this.KEY_LENGTH);
    }
    return Buffer.from(keyHex, 'hex');
  }

  // Generate new license key with encryption
  static generateSecureLicenseKey(productId: string, userId: string): {
    plainKey: string;
    encryptedKey: string;
    keyFingerprint: string;
  } {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const plainKey = `LIC-${productId}-${userId}-${timestamp}-${randomBytes}`;
    
    const encryptedKey = this.encryptLicenseKey(plainKey);
    const keyFingerprint = crypto.createHash('sha256').update(plainKey).digest('hex').substring(0, 16);
    
    return { plainKey, encryptedKey, keyFingerprint };
  }
}

// ===== 2. SECURE KEY VAULT WITH HSM =====
export class SecureKeyVault {
  private static keyCache = new Map<string, { key: string; expires: number }>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Simulate HSM functionality (in production, use actual HSM)
  static async storeKeyInVault(keyId: string, keyData: string, metadata: any = {}): Promise<void> {
    try {
      // Encrypt key data before storage
      const encryptedData = DigitalKeyEncryption.encryptLicenseKey(keyData, this.getVaultMasterKey());
      
      const vaultEntry = {
        keyId,
        encryptedData,
        metadata: {
          ...metadata,
          createdAt: new Date().toISOString(),
          algorithm: 'aes-256-gcm',
          keyType: 'license-key'
        },
        accessCount: 0,
        lastAccessed: null
      };

      // In production, store in HSM or secure key management service
      await this.writeToSecureStorage(keyId, vaultEntry);
      
      logger.info('Key stored in vault', { 
        keyId, 
        algorithm: 'aes-256-gcm',
        category: 'key-management' 
      });
      
    } catch (error) {
      logger.error('Key vault storage failed', { keyId, error: error.message });
      throw new Error('Failed to store key in vault');
    }
  }

  // Retrieve key from vault with audit logging
  static async retrieveKeyFromVault(keyId: string, requesterInfo: any): Promise<string> {
    try {
      // Check cache first
      const cached = this.keyCache.get(keyId);
      if (cached && cached.expires > Date.now()) {
        this.logKeyAccess(keyId, requesterInfo, 'cache-hit');
        return cached.key;
      }

      // Retrieve from secure storage
      const vaultEntry = await this.readFromSecureStorage(keyId);
      if (!vaultEntry) {
        throw new Error('Key not found in vault');
      }

      // Decrypt key data
      const keyData = DigitalKeyEncryption.decryptLicenseKey(
        vaultEntry.encryptedData, 
        this.getVaultMasterKey()
      );

      // Update access tracking
      vaultEntry.accessCount++;
      vaultEntry.lastAccessed = new Date().toISOString();
      await this.writeToSecureStorage(keyId, vaultEntry);

      // Cache for performance
      this.keyCache.set(keyId, {
        key: keyData,
        expires: Date.now() + this.CACHE_TTL
      });

      this.logKeyAccess(keyId, requesterInfo, 'vault-access');
      return keyData;

    } catch (error) {
      logger.error('Key vault retrieval failed', { keyId, error: error.message });
      throw new Error('Failed to retrieve key from vault');
    }
  }

  private static getVaultMasterKey(): string {
    const key = process.env.VAULT_MASTER_KEY;
    if (!key) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Critical: VAULT_MASTER_KEY not configured');
      }
      return crypto.randomBytes(32).toString('hex');
    }
    return key;
  }

  private static async writeToSecureStorage(keyId: string, data: any): Promise<void> {
    // In production, use HSM or AWS KMS, Azure Key Vault, etc.
    const secureDir = path.join(process.cwd(), 'secure-vault');
    await fs.mkdir(secureDir, { recursive: true });
    await fs.writeFile(
      path.join(secureDir, `${keyId}.vault`),
      JSON.stringify(data),
      { mode: 0o600 } // Restrict file permissions
    );
  }

  private static async readFromSecureStorage(keyId: string): Promise<any> {
    try {
      const secureDir = path.join(process.cwd(), 'secure-vault');
      const data = await fs.readFile(path.join(secureDir, `${keyId}.vault`), 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  private static logKeyAccess(keyId: string, requesterInfo: any, accessType: string): void {
    logger.info('Key vault access', {
      category: 'key-vault',
      keyId,
      accessType,
      requester: requesterInfo,
      timestamp: new Date().toISOString()
    });
  }
}

// ===== 3. JWT SCOPE-BASED AUTHORIZATION =====
export class ScopedJWTManager {
  private static readonly DEFAULT_EXPIRY = '1h';
  private static readonly REFRESH_EXPIRY = '7d';

  // Generate JWT with specific scopes
  static generateScopedToken(userId: string, scopes: string[], options: any = {}): {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  } {
    const payload = {
      sub: userId,
      scopes,
      iat: Math.floor(Date.now() / 1000),
      type: 'access'
    };

    const accessToken = jwt.sign(payload, this.getJWTSecret(), {
      expiresIn: options.expiresIn || this.DEFAULT_EXPIRY,
      issuer: 'b2b-license-platform',
      audience: 'api-access'
    });

    const refreshPayload = {
      sub: userId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000)
    };

    const refreshToken = jwt.sign(refreshPayload, this.getRefreshSecret(), {
      expiresIn: this.REFRESH_EXPIRY,
      issuer: 'b2b-license-platform',
      audience: 'token-refresh'
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiry(options.expiresIn || this.DEFAULT_EXPIRY)
    };
  }

  // Validate JWT and check scopes
  static validateScopedToken(token: string, requiredScopes: string[] = []): {
    valid: boolean;
    payload?: any;
    missingScopes?: string[];
  } {
    try {
      const payload = jwt.verify(token, this.getJWTSecret(), {
        issuer: 'b2b-license-platform',
        audience: 'api-access'
      }) as any;

      if (payload.type !== 'access') {
        return { valid: false };
      }

      const userScopes = payload.scopes || [];
      const missingScopes = requiredScopes.filter(scope => !userScopes.includes(scope));

      if (missingScopes.length > 0) {
        return { valid: false, missingScopes };
      }

      return { valid: true, payload };
    } catch (error) {
      return { valid: false };
    }
  }

  // Middleware for scope-based authorization
  static requireScopes(requiredScopes: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'MISSING_TOKEN', message: 'Authorization token required' });
      }

      const token = authHeader.substring(7);
      const validation = this.validateScopedToken(token, requiredScopes);

      if (!validation.valid) {
        if (validation.missingScopes) {
          return res.status(403).json({
            error: 'INSUFFICIENT_SCOPE',
            message: 'Insufficient permissions',
            missingScopes: validation.missingScopes
          });
        }
        return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Invalid or expired token' });
      }

      (req as any).user = validation.payload;
      next();
    };
  }

  private static getJWTSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }
    return secret;
  }

  private static getRefreshSecret(): string {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET not configured');
    }
    return secret;
  }

  private static parseExpiry(expiry: string): number {
    const units: { [key: string]: number } = { s: 1, m: 60, h: 3600, d: 86400 };
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 3600; // Default 1 hour
    return parseInt(match[1]) * units[match[2]];
  }
}

// ===== 4. ONE-TIME DOWNLOAD TOKENS =====
export class OneTimeTokenManager {
  private static tokenStore = new Map<string, any>();

  // Generate one-time download token
  static generateDownloadToken(resourceId: string, userId: string, options: any = {}): {
    token: string;
    expiresAt: Date;
    downloadUrl: string;
  } {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + (options.ttl || 15 * 60 * 1000)); // 15 minutes default

    const tokenData = {
      resourceId,
      userId,
      createdAt: new Date(),
      expiresAt,
      used: false,
      allowedDownloads: options.allowedDownloads || 1,
      downloadCount: 0,
      ip: options.ip,
      userAgent: options.userAgent
    };

    this.tokenStore.set(token, tokenData);

    // Auto-cleanup after expiry
    setTimeout(() => {
      this.tokenStore.delete(token);
    }, options.ttl || 15 * 60 * 1000);

    const downloadUrl = `/api/download/${token}`;

    logger.info('One-time download token generated', {
      category: 'download-security',
      resourceId,
      userId,
      token: token.substring(0, 8) + '...',
      expiresAt
    });

    return { token, expiresAt, downloadUrl };
  }

  // Validate and consume one-time token
  static validateDownloadToken(token: string, clientInfo: any): {
    valid: boolean;
    resourceId?: string;
    userId?: string;
    error?: string;
  } {
    const tokenData = this.tokenStore.get(token);
    
    if (!tokenData) {
      return { valid: false, error: 'Token not found or expired' };
    }

    if (tokenData.expiresAt < new Date()) {
      this.tokenStore.delete(token);
      return { valid: false, error: 'Token expired' };
    }

    if (tokenData.downloadCount >= tokenData.allowedDownloads) {
      return { valid: false, error: 'Token already used' };
    }

    // Optional: IP validation for added security
    if (tokenData.ip && tokenData.ip !== clientInfo.ip) {
      logger.warn('Download token IP mismatch', {
        category: 'download-security',
        token: token.substring(0, 8) + '...',
        expectedIP: tokenData.ip,
        actualIP: clientInfo.ip
      });
      // You can choose to block or allow with warning
    }

    // Consume the token
    tokenData.downloadCount++;
    if (tokenData.downloadCount >= tokenData.allowedDownloads) {
      this.tokenStore.delete(token);
    }

    logger.info('Download token consumed', {
      category: 'download-security',
      token: token.substring(0, 8) + '...',
      resourceId: tokenData.resourceId,
      userId: tokenData.userId,
      downloadCount: tokenData.downloadCount
    });

    return {
      valid: true,
      resourceId: tokenData.resourceId,
      userId: tokenData.userId
    };
  }

  // Middleware for protected downloads
  static protectDownload() {
    return (req: Request, res: Response, next: NextFunction) => {
      const { token } = req.params;
      const clientInfo = {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      };

      const validation = this.validateDownloadToken(token, clientInfo);
      if (!validation.valid) {
        return res.status(401).json({
          error: 'INVALID_DOWNLOAD_TOKEN',
          message: validation.error
        });
      }

      (req as any).download = {
        resourceId: validation.resourceId,
        userId: validation.userId
      };

      next();
    };
  }
}

// ===== 5. API-LEVEL RATE LIMITING =====
export class APILevelRateLimit {
  // Create rate limiter with scope-based rules
  static createScopedRateLimit() {
    return rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: (req: Request) => {
        const user = (req as any).user;
        if (!user) return 100; // Anonymous users

        const scopes = user.scopes || [];
        
        // Enterprise scope gets higher limits
        if (scopes.includes('enterprise:unlimited')) return 10000;
        if (scopes.includes('premium:extended')) return 1000;
        if (scopes.includes('admin:manage')) return 500;
        
        return 100; // Standard users
      },
      message: (req: Request) => {
        const user = (req as any).user;
        return {
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Upgrade your plan for higher limits.',
          currentPlan: user?.scopes?.[0] || 'free',
          upgradeUrl: '/pricing'
        };
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req: Request) => {
        const user = (req as any).user;
        return user ? `user:${user.sub}` : `ip:${req.ip}`;
      }
    });
  }

  // Endpoint-specific rate limiting
  static createEndpointSpecificLimits() {
    const limits: { [key: string]: any } = {
      '/api/auth/login': {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5,
        message: { error: 'TOO_MANY_LOGIN_ATTEMPTS' }
      },
      '/api/licenses/generate': {
        windowMs: 60 * 1000, // 1 minute
        max: 10,
        message: { error: 'LICENSE_GENERATION_LIMIT' }
      },
      '/api/download/': {
        windowMs: 60 * 1000, // 1 minute
        max: 50,
        message: { error: 'DOWNLOAD_LIMIT_EXCEEDED' }
      }
    };

    return (req: Request, res: Response, next: NextFunction) => {
      const path = req.path;
      const limitConfig = Object.keys(limits).find(pattern => path.startsWith(pattern));
      
      if (limitConfig) {
        const limiter = rateLimit(limits[limitConfig]);
        return limiter(req, res, next);
      }
      
      next();
    };
  }
}

// ===== 6. SSL/TLS FOR ALL COMMUNICATIONS =====
export class SSLTLSManager {
  // Middleware to enforce HTTPS
  static enforceHTTPS() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (process.env.NODE_ENV === 'production' && !req.secure && req.get('X-Forwarded-Proto') !== 'https') {
        return res.redirect(301, `https://${req.get('Host')}${req.url}`);
      }
      next();
    };
  }

  // Enhanced security headers for HTTPS
  static setSecurityHeaders() {
    return helmet({
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https:"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https:"],
          fontSrc: ["'self'", "https:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
        }
      },
      crossOriginEmbedderPolicy: false, // Adjust based on your needs
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    });
  }
}

// ===== 7. KEY DOWNLOAD AUDIT LOGGING =====
export class KeyDownloadAudit {
  // Log all key download attempts
  static logKeyDownload(keyId: string, userId: string, req: Request, success: boolean = true): void {
    const auditEntry = {
      category: 'key-download',
      keyId,
      userId,
      success,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      referer: req.get('Referer'),
      sessionId: req.sessionID
    };

    logger.info('Key download audit', auditEntry);
    
    // Store in dedicated audit table for compliance
    // await this.storeAuditEntry(auditEntry);
  }

  // Middleware for automatic audit logging
  static auditDownloadMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send;
      
      res.send = function(body: any) {
        const downloadInfo = (req as any).download;
        const user = (req as any).user;
        
        if (downloadInfo && user) {
          const success = res.statusCode < 400;
          KeyDownloadAudit.logKeyDownload(
            downloadInfo.resourceId,
            user.sub || downloadInfo.userId,
            req,
            success
          );
        }
        
        return originalSend.call(this, body);
      };
      
      next();
    };
  }
}

// ===== 8. 2FA FOR ADMIN ACCESS =====
export class AdminMFAManager {
  // Check if user requires 2FA for admin operations
  static requiresAdminMFA(userScopes: string[]): boolean {
    const adminScopes = ['admin:manage', 'admin:users', 'admin:system', 'super:admin'];
    return userScopes.some(scope => adminScopes.includes(scope));
  }

  // Middleware for admin 2FA enforcement
  static enforceAdminMFA() {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED' });
      }

      if (this.requiresAdminMFA(user.scopes || [])) {
        // Check if 2FA was verified in this session
        const session = (req as any).session;
        const mfaVerified = session?.mfaVerifiedAt;
        const mfaValidFor = 30 * 60 * 1000; // 30 minutes

        if (!mfaVerified || Date.now() - mfaVerified > mfaValidFor) {
          return res.status(403).json({
            error: 'MFA_REQUIRED',
            message: 'Two-factor authentication required for admin operations',
            requireMFA: true
          });
        }
      }

      next();
    };
  }
}

// ===== 9. ANTI-FRAUD MONITORING =====
export class AntiFraudMonitoring {
  private static suspiciousActivity = new Map<string, any>();

  // Monitor for suspicious license usage patterns
  static monitorLicenseUsage(licenseId: string, userId: string, clientInfo: any): {
    riskScore: number;
    alerts: string[];
  } {
    const key = `${licenseId}:${userId}`;
    const current = this.suspiciousActivity.get(key) || {
      requests: [],
      locations: new Set(),
      userAgents: new Set()
    };

    // Track request patterns
    current.requests.push({
      timestamp: Date.now(),
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent
    });

    current.locations.add(clientInfo.ip);
    current.userAgents.add(clientInfo.userAgent);

    // Clean old requests (last 24 hours)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    current.requests = current.requests.filter((req: any) => req.timestamp > dayAgo);

    this.suspiciousActivity.set(key, current);

    // Calculate risk score
    let riskScore = 0;
    const alerts: string[] = [];

    // High frequency usage
    if (current.requests.length > 100) {
      riskScore += 30;
      alerts.push('HIGH_FREQUENCY_USAGE');
    }

    // Multiple locations
    if (current.locations.size > 5) {
      riskScore += 40;
      alerts.push('MULTIPLE_LOCATIONS');
    }

    // Multiple user agents (potential sharing)
    if (current.userAgents.size > 3) {
      riskScore += 25;
      alerts.push('MULTIPLE_DEVICES');
    }

    // Rapid requests from same IP
    const recentRequests = current.requests.filter(
      (req: any) => Date.now() - req.timestamp < 60 * 1000
    );
    if (recentRequests.length > 10) {
      riskScore += 35;
      alerts.push('RAPID_REQUESTS');
    }

    if (riskScore > 50) {
      logger.warn('Suspicious license usage detected', {
        category: 'anti-fraud',
        licenseId,
        userId,
        riskScore,
        alerts,
        stats: {
          requestCount: current.requests.length,
          locationCount: current.locations.size,
          deviceCount: current.userAgents.size
        }
      });
    }

    return { riskScore, alerts };
  }

  // Middleware for fraud monitoring
  static fraudMonitoringMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      const licenseId = req.params.licenseId || req.body.licenseId;
      
      if (user && licenseId) {
        const clientInfo = {
          ip: req.ip,
          userAgent: req.get('User-Agent')
        };

        const fraudCheck = this.monitorLicenseUsage(licenseId, user.sub, clientInfo);
        
        if (fraudCheck.riskScore > 80) {
          return res.status(429).json({
            error: 'SUSPICIOUS_ACTIVITY',
            message: 'Unusual activity detected. Please contact support.',
            riskScore: fraudCheck.riskScore,
            alerts: fraudCheck.alerts
          });
        }

        (req as any).fraudCheck = fraudCheck;
      }

      next();
    };
  }
}

// ===== 10. COMPREHENSIVE SECURITY FRAMEWORK =====
export class ComprehensiveSecurityFramework {
  // Apply all security measures
  static applyAllSecurityMeasures(app: Express): void {
    console.log('🔒 Initializing Comprehensive Security & Encryption Layer...');

    // 1. SSL/TLS enforcement
    app.use(SSLTLSManager.enforceHTTPS());
    app.use(SSLTLSManager.setSecurityHeaders());

    // 2. API-level rate limiting
    app.use('/api/', APILevelRateLimit.createScopedRateLimit());
    app.use(APILevelRateLimit.createEndpointSpecificLimits());

    // 3. Anti-fraud monitoring
    app.use('/api/licenses/', AntiFraudMonitoring.fraudMonitoringMiddleware());

    // 4. Download audit logging
    app.use('/api/download/', KeyDownloadAudit.auditDownloadMiddleware());

    console.log('✅ Comprehensive Security & Encryption Layer initialized');
  }

  // Setup protected routes
  static setupProtectedRoutes(app: Express): void {
    // License management routes (require appropriate scopes)
    app.use('/api/licenses/manage', ScopedJWTManager.requireScopes(['license:manage']));
    app.use('/api/licenses/generate', ScopedJWTManager.requireScopes(['license:create']));
    
    // Admin routes (require 2FA)
    app.use('/api/admin', 
      ScopedJWTManager.requireScopes(['admin:manage']),
      AdminMFAManager.enforceAdminMFA()
    );

    // Download routes (use one-time tokens)
    app.get('/api/download/:token', 
      OneTimeTokenManager.protectDownload(),
      // Your download handler here
    );
  }
}