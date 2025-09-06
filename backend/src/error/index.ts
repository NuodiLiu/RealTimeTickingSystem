export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class AuthError extends Error {
  statusCode: number;
  
  constructor(message = 'Authentication error', statusCode = 401) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

export class ForbiddenError extends AuthError {
  constructor(message = 'Forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

export class UserAlreadyExistsError extends AuthError {
  constructor() {
    super('User already exists', 409);
    this.name = 'UserAlreadyExistsError';
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor() {
    super('Invalid credentials', 401);
    this.name = 'InvalidCredentialsError';
  }
}

export class InvalidObjectIdError extends BadRequestError {
  constructor(id: string) {
    super(`Invalid ObjectId: ${id}`);
    this.name = 'InvalidObjectIdError';
  }
}

export class MissingFieldError extends BadRequestError {
  constructor(public missingFields: string[]) {
    super(`Missing required fields: ${missingFields.join(', ')}`);
    this.name = 'MissingFieldError';
  }
}

export class ConflictError extends Error {
  statusCode: number;

  constructor(message = "Conflict") {
    super(message);
    this.name = "ConflictError";
    this.statusCode = 409;
  }
}