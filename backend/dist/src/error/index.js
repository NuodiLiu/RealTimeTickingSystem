"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictError = exports.ForbiddenRoleError = exports.MissingFieldError = exports.InvalidObjectIdError = exports.InvalidCredentialsError = exports.UserAlreadyExistsError = exports.ForbiddenError = exports.AuthError = exports.DatabaseError = exports.BadRequestError = exports.NotFoundError = void 0;
class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class BadRequestError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BadRequestError';
    }
}
exports.BadRequestError = BadRequestError;
class DatabaseError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DatabaseError';
    }
}
exports.DatabaseError = DatabaseError;
class AuthError extends Error {
    constructor(message = 'Authentication error', statusCode = 401) {
        super(message);
        this.name = 'AuthError';
        this.statusCode = statusCode;
    }
}
exports.AuthError = AuthError;
class ForbiddenError extends AuthError {
    constructor(message = 'Forbidden') {
        super(message, 403);
        this.name = 'ForbiddenError';
    }
}
exports.ForbiddenError = ForbiddenError;
class UserAlreadyExistsError extends AuthError {
    constructor() {
        super('User already exists', 409);
        this.name = 'UserAlreadyExistsError';
    }
}
exports.UserAlreadyExistsError = UserAlreadyExistsError;
class InvalidCredentialsError extends AuthError {
    constructor() {
        super('Invalid credentials', 401);
        this.name = 'InvalidCredentialsError';
    }
}
exports.InvalidCredentialsError = InvalidCredentialsError;
class InvalidObjectIdError extends BadRequestError {
    constructor(id) {
        super(`Invalid ObjectId: ${id}`);
        this.name = 'InvalidObjectIdError';
    }
}
exports.InvalidObjectIdError = InvalidObjectIdError;
class MissingFieldError extends BadRequestError {
    constructor(missingFields) {
        super(`Missing required fields: ${missingFields.join(', ')}`);
        this.missingFields = missingFields;
        this.name = 'MissingFieldError';
    }
}
exports.MissingFieldError = MissingFieldError;
class ForbiddenRoleError extends ForbiddenError {
    constructor(message = 'Insufficient role permissions') {
        super(message);
        this.name = 'ForbiddenRoleError';
    }
}
exports.ForbiddenRoleError = ForbiddenRoleError;
class ConflictError extends Error {
    constructor(message = "Conflict") {
        super(message);
        this.name = "ConflictError";
        this.statusCode = 409;
    }
}
exports.ConflictError = ConflictError;
//# sourceMappingURL=index.js.map