// Typed application errors. The global error handler in app.js reads .status + .code
// and renders them as JSON. Business rules throw these; routes don't construct ad-hoc
// { status: 400, message } responses.

export class AppError extends Error {
  constructor(message, { status = 500, code = 'INTERNAL_ERROR', meta } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.meta = meta;
  }
}

export class ValidationError extends AppError {
  constructor(message, meta) {
    super(message, { status: 400, code: 'VALIDATION_ERROR', meta });
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, { status: 401, code: 'UNAUTHORIZED' });
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, { status: 403, code: 'FORBIDDEN' });
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, { status: 404, code: 'NOT_FOUND' });
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', meta) {
    super(message, { status: 409, code: 'CONFLICT', meta });
    this.name = 'ConflictError';
  }
}
