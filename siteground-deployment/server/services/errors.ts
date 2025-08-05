// Base service error class
export class ServiceError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly originalError?: any;

  constructor(message: string, originalError?: any, statusCode: number = 500, code: string = 'SERVICE_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.originalError = originalError;
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Validation errors (400)
export class ValidationError extends ServiceError {
  constructor(message: string, originalError?: any) {
    super(message, originalError, 400, 'VALIDATION_ERROR');
  }
}

// Not found errors (404)
export class NotFoundError extends ServiceError {
  constructor(message: string = 'Resource not found', originalError?: any) {
    super(message, originalError, 404, 'NOT_FOUND');
  }
}

// Conflict errors (409)
export class ConflictError extends ServiceError {
  constructor(message: string, originalError?: any) {
    super(message, originalError, 409, 'CONFLICT');
  }
}

// Unauthorized errors (401)
export class UnauthorizedError extends ServiceError {
  constructor(message: string = 'Unauthorized', originalError?: any) {
    super(message, originalError, 401, 'UNAUTHORIZED');
  }
}

// Forbidden errors (403)
export class ForbiddenError extends ServiceError {
  constructor(message: string = 'Forbidden', originalError?: any) {
    super(message, originalError, 403, 'FORBIDDEN');
  }
}

// Business logic errors (422)
export class BusinessLogicError extends ServiceError {
  constructor(message: string, originalError?: any) {
    super(message, originalError, 422, 'BUSINESS_LOGIC_ERROR');
  }
}

// External service errors (502)
export class ExternalServiceError extends ServiceError {
  constructor(message: string, originalError?: any) {
    super(message, originalError, 502, 'EXTERNAL_SERVICE_ERROR');
  }
}

// Rate limit errors (429)
export class RateLimitError extends ServiceError {
  constructor(message: string = 'Rate limit exceeded', originalError?: any) {
    super(message, originalError, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

// Helper function to determine if error is a service error
export function isServiceError(error: any): error is ServiceError {
  return error instanceof ServiceError;
}

// Error response formatter
export function formatErrorResponse(error: ServiceError) {
  return {
    error: error.code,
    message: error.message,
    statusCode: error.statusCode,
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      originalError: error.originalError
    })
  };
}