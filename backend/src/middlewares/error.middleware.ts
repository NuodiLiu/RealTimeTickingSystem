// error.middleware.ts
import type { ErrorRequestHandler } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { AuthError, BadRequestError, ConflictError, DatabaseError, InvalidObjectIdError, MissingFieldError, NotFoundError } from '../error';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next): void => {
  console.error(err);

  if (err instanceof MissingFieldError) {
    res.status(422).json({
      error: err.message,
      missingFields: err.missingFields,
    });
    return;
  }

  if (err instanceof InvalidObjectIdError) {
    res.status(400).json({ error: err.message });
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }
  if (err instanceof BadRequestError) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (err instanceof DatabaseError) {
    res.status(400).json({ error: 'Database error' });
    return;
  }
  if (err instanceof PrismaClientKnownRequestError) {
    res.status(400).json({ error: 'Database error' });
    return;
  }
  if (err instanceof AuthError) {
    res.status(err.statusCode || 401).json({ error: err.message });
    return;
  }
  if (err instanceof ConflictError) {
    res.status(409).json({ error: err.message });
    return;
  }

  // For any unknown or unhandled errors
  res.status(400).json({ error: 'An unknown error occurred' });
  return;
};