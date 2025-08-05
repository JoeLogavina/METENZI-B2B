import winston from 'winston';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  levels,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'b2b-platform',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Error logs
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    // Combined logs
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      tailable: true
    }),
  ],
});

// Console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
      })
    )
  }));
}

// Helper functions for common logging patterns
export const logAuth = {
  loginAttempt: (username: string, ip: string, userAgent?: string) => {
    logger.info('User login attempt', {
      category: 'auth',
      username,
      ip,
      userAgent: userAgent?.substring(0, 200) // Truncate long user agents
    });
  },
  loginSuccess: (userId: string, username: string, ip: string) => {
    logger.info('User login successful', {
      category: 'auth',
      userId,
      username,
      ip
    });
  },
  loginFailure: (username: string, ip: string, reason: string) => {
    logger.warn('User login failed', {
      category: 'auth',
      username,
      ip,
      reason
    });
  },
  logout: (userId: string, username: string) => {
    logger.info('User logout', {
      category: 'auth',
      userId,
      username
    });
  }
};

export const logSecurity = {
  rateLimitHit: (ip: string, endpoint: string) => {
    logger.warn('Rate limit exceeded', {
      category: 'security',
      ip,
      endpoint
    });
  },
  suspiciousActivity: (ip: string, details: any) => {
    logger.warn('Suspicious activity detected', {
      category: 'security',
      ip,
      details
    });
  },
  csrfTokenIssue: (ip: string, endpoint: string) => {
    logger.warn('CSRF token validation failed', {
      category: 'security',
      ip,
      endpoint
    });
  }
};

export const logBusiness = {
  orderCreated: (orderId: string, userId: string, tenantId: string, amount: number) => {
    logger.info('Order created', {
      category: 'business',
      orderId,
      userId,
      tenantId,
      amount
    });
  },
  paymentProcessed: (orderId: string, amount: number, method: string) => {
    logger.info('Payment processed', {
      category: 'business',
      orderId,
      amount,
      method
    });
  },
  licenseAssigned: (licenseId: string, productId: string, userId: string) => {
    logger.info('License key assigned', {
      category: 'business',
      licenseId,
      productId,
      userId
    });
  }
};

export const logPerformance = {
  slowQuery: (query: string, duration: number, table?: string) => {
    logger.warn('Slow database query detected', {
      category: 'performance',
      query: query.substring(0, 500), // Truncate long queries
      duration,
      table
    });
  },
  cacheEvent: (event: 'hit' | 'miss' | 'set' | 'invalidate', key: string) => {
    logger.debug('Cache event', {
      category: 'performance',
      event,
      key: key.substring(0, 100) // Truncate long keys
    });
  }
};

// Express middleware for request logging
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const user = req.user ? { id: req.user.id, username: req.user.username } : null;
    
    logger.info('HTTP Request', {
      category: 'http',
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent')?.substring(0, 200),
      user,
      tenantId: req.user?.tenantId
    });
    
    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow HTTP request', {
        category: 'performance',
        method: req.method,
        url: req.originalUrl,
        duration,
        user
      });
    }
  });
  
  next();
};

export default logger;