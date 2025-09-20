export declare class NotFoundError extends Error {
    constructor(message: string);
}
export declare class BadRequestError extends Error {
    constructor(message: string);
}
export declare class DatabaseError extends Error {
    constructor(message: string);
}
export declare class AuthError extends Error {
    statusCode: number;
    constructor(message?: string, statusCode?: number);
}
export declare class ForbiddenError extends AuthError {
    constructor(message?: string);
}
export declare class UserAlreadyExistsError extends AuthError {
    constructor();
}
export declare class InvalidCredentialsError extends AuthError {
    constructor();
}
export declare class InvalidObjectIdError extends BadRequestError {
    constructor(id: string);
}
export declare class MissingFieldError extends BadRequestError {
    missingFields: string[];
    constructor(missingFields: string[]);
}
export declare class ForbiddenRoleError extends ForbiddenError {
    constructor(message?: string);
}
export declare class ConflictError extends Error {
    statusCode: number;
    constructor(message?: string);
}
//# sourceMappingURL=index.d.ts.map