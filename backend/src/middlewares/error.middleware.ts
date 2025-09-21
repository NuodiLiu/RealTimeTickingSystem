// src/middlewares/error.middleware.ts
import type { ErrorRequestHandler } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import {
  AuthError,
  BadRequestError,
  ConflictError,
  DatabaseError,
  InvalidObjectIdError,
  MissingFieldError,
  NotFoundError,
  ForbiddenError,
  InvalidCredentialsError,
  UserAlreadyExistsError,
} from '../error';

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


  if (err instanceof InvalidCredentialsError) {
    res.status(401).json({ error: err.message });
    return;
  }

  if (err instanceof ForbiddenError) {
    res.status(403).json({ error: err.message });
    return;
  }

  if (err instanceof UserAlreadyExistsError) {
    res.status(409).json({ error: err.message });
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

  // In development, provide more detailed error information
  console.error('Unhandled error:', err);
  if (process.env.NODE_ENV === 'development') {
    res.status(500).json({ 
      error: 'An unknown error occurred',
      details: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
  } else {
    res.status(500).json({ error: 'An unknown error occurred' });
  }
  return;
};
