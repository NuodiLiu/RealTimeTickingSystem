"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const library_1 = require("@prisma/client/runtime/library");
const error_1 = require("../error");
const errorHandler = (err, _req, res, _next) => {
    console.error(err);
    if (err instanceof error_1.MissingFieldError) {
        res.status(422).json({
            error: err.message,
            missingFields: err.missingFields,
        });
        return;
    }
    if (err instanceof error_1.InvalidObjectIdError) {
        res.status(400).json({ error: err.message });
        return;
    }
    if (err instanceof error_1.NotFoundError) {
        res.status(404).json({ error: err.message });
        return;
    }
    if (err instanceof error_1.BadRequestError) {
        res.status(400).json({ error: err.message });
        return;
    }
    if (err instanceof error_1.DatabaseError) {
        res.status(400).json({ error: 'Database error' });
        return;
    }
    if (err instanceof library_1.PrismaClientKnownRequestError) {
        res.status(400).json({ error: 'Database error' });
        return;
    }
    if (err instanceof error_1.InvalidCredentialsError) {
        res.status(401).json({ error: err.message });
        return;
    }
    if (err instanceof error_1.ForbiddenError) {
        res.status(403).json({ error: err.message });
        return;
    }
    if (err instanceof error_1.UserAlreadyExistsError) {
        res.status(409).json({ error: err.message });
        return;
    }
    if (err instanceof error_1.AuthError) {
        res.status(err.statusCode || 401).json({ error: err.message });
        return;
    }
    if (err instanceof error_1.ConflictError) {
        res.status(409).json({ error: err.message });
        return;
    }
    // In development, provide more detailed error information
    console.error('Unhandled error:', err);
    if (process.env.NODE_ENV === 'development') {
        res.status(500).json({
            error: 'An unknown error occurred',
            details: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined
        });
    }
    else {
        res.status(500).json({ error: 'An unknown error occurred' });
    }
    return;
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=error.middleware.js.map