# 🔒 Security Framework Implementation

## Overview

This document outlines the comprehensive security framework implemented for the B2B Software License Management Platform, providing enterprise-grade protection against common web vulnerabilities.

## ✅ Implemented Security Features

### 1. CSRF Protection
- **Real CSRF tokens**: Generated using cryptographically secure methods
- **Token validation**: All state-changing operations (POST/PUT/DELETE/PATCH) require valid tokens
- **Multiple sources**: Tokens accepted from headers, body, or query parameters
- **Automatic refresh**: Tokens refresh automatically before expiration

```typescript
// Client-side usage
const { token, loading } = useCsrf();
// Token automatically included in all API requests
```

### 2. Comprehensive Rate Limiting
- **Login protection**: 5 attempts per 15 minutes (production) / 50 (development)
- **API protection**: 100 requests per minute (production) / 1000 (development)
- **Admin protection**: 50 requests per 5 minutes (production) / 500 (development)
- **Environment-aware**: Stricter limits in production

### 3. Session Security
- **Hijacking protection**: User-Agent validation across requests
- **Session expiry**: 24-hour maximum session lifetime
- **Secure cookies**: HTTPOnly, Secure, SameSite strict in production
- **Automatic cleanup**: Suspicious sessions destroyed immediately

### 4. Security Headers
- **Content Security Policy**: Blocks XSS attacks and unauthorized script execution
- **HSTS**: Forces HTTPS in production (1 year, includeSubDomains, preload)
- **X-Frame-Options**: Prevents clickjacking (DENY)
- **X-XSS-Protection**: Browser XSS filter enabled
- **X-Content-Type-Options**: Prevents MIME sniffing
- **Referrer Policy**: Controls referrer information leakage

### 5. Input Sanitization
- **XSS prevention**: Removes `<script>` tags, `javascript:` URLs, and event handlers
- **Recursive sanitization**: Processes nested objects and arrays
- **Body and query protection**: Sanitizes all incoming request data

### 6. Advanced Threat Detection
- **Suspicious request logging**: Monitors requests without proper headers
- **CSRF attempt detection**: Logs state-changing requests without referer/origin
- **Session anomaly detection**: Tracks and logs unusual session behavior
- **IP and timestamp logging**: Comprehensive audit trail

## 🏗️ Security Framework Architecture

### Centralized Configuration

```typescript
class SecurityConfig {
  static isProduction(): boolean
  static getEncryptionKey(keyName: string): string
  static shouldUseHTTPS(): boolean
  static getCookieSettings(): CookieOptions
}
```

### Middleware Pipeline

```typescript
// Applied in order:
1. Security Headers (helmet)
2. Rate Limiting (by endpoint type)
3. Input Sanitization
4. Session Security Validation
5. CSRF Protection (for state-changing operations)
```

### Production-Ready Features

- **Environment detection**: Different security levels for dev/production
- **Key management**: Secure handling of encryption keys
- **Fallback protection**: Graceful degradation with security warnings
- **Comprehensive logging**: Security events tracked with full context

## 🛡️ Security Benefits

### Protection Against:
- **Cross-Site Request Forgery (CSRF)**: Real token validation
- **Brute Force Attacks**: Progressive rate limiting
- **Session Hijacking**: User-Agent and timing validation
- **XSS Attacks**: Input sanitization and CSP headers
- **Clickjacking**: Frame denial headers
- **Information Disclosure**: Secure error handling
- **MIME Sniffing**: Content type enforcement

### Compliance Features:
- **Audit logging**: All security events recorded
- **Session management**: Secure session lifecycle
- **Data protection**: Input sanitization and validation
- **Access control**: Role-based restrictions with security validation

## 🔧 Configuration

### Environment Variables (Production)
```env
# Required for production
NODE_ENV=production
BACKUP_ENCRYPTION_KEY=your-32-char-encryption-key
SESSION_SECRET=your-session-secret-key
DATABASE_URL=your-secure-database-url

# Optional security enhancements
SECURITY_KEY_ROTATION_DAYS=90
MAX_SESSION_AGE_HOURS=24
RATE_LIMIT_WINDOW_MINUTES=15
```

### Development vs Production

| Feature | Development | Production |
|---------|-------------|------------|
| Rate Limits | Relaxed (50-1000 req) | Strict (5-100 req) |
| CSRF | Full protection | Full protection |
| HSTS | Disabled | Enabled (1 year) |
| CSP | Relaxed for hot reload | Strict |
| Session Security | Full validation | Full validation |
| Logging | Verbose warnings | Critical only |

## 🚀 Getting Started

### 1. Framework is Auto-Applied
The security framework automatically applies when the application starts. No additional configuration needed for basic protection.

### 2. CSRF Token Usage
```typescript
// Hooks automatically handle CSRF
const { token } = useCsrf();

// Manual usage in forms
<input type="hidden" name="_csrf" value={token} />

// Headers automatically added to API requests
```

### 3. Monitoring Security Events
```bash
# Watch for security events in logs
tail -f application.log | grep "🚨"

# Example security events:
# 🚨 Potential session hijacking detected
# 🚨 Suspicious request without User-Agent
# 🚨 State-changing request without referer/origin
```

## 📊 Security Metrics

The framework tracks:
- **Failed login attempts**: Rate limiting effectiveness
- **CSRF token generations**: Protection coverage
- **Session violations**: Hijacking attempts
- **Suspicious requests**: Threat detection
- **Input sanitization**: Attack prevention

## 🔮 Future Enhancements

Ready for implementation when deploying to production:

1. **Backup Encryption**: Framework ready for your encryption keys
2. **Advanced Logging**: Centralized security event monitoring
3. **Compliance Features**: GDPR/data protection ready
4. **Key Rotation**: Automated security key updates
5. **Advanced Threat Detection**: ML-based anomaly detection

## ⚠️ Security Warnings

- **Development Mode**: Some protections relaxed for development workflow
- **Key Management**: Production requires proper encryption key setup
- **Session Storage**: Consider Redis for production session scaling
- **Database Security**: Enable connection encryption for production
- **Regular Updates**: Keep security dependencies updated

This security framework provides enterprise-grade protection while maintaining development workflow efficiency.