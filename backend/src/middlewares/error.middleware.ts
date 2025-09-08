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

  // 422：字段缺失
  if (err instanceof MissingFieldError) {
    res.status(422).json({
      error: err.message,
      missingFields: err.missingFields,
    });
    return;
  }

  // 400：ID格式/请求格式问题
  if (err instanceof InvalidObjectIdError) {
    res.status(400).json({ error: err.message });
    return;
  }

  // 404：未找到
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }

  // 400：通用 bad request
  if (err instanceof BadRequestError) {
    res.status(400).json({ error: err.message });
    return;
  }

  // 400：通用数据库错误（保持你原有语义）
  if (err instanceof DatabaseError) {
    res.status(400).json({ error: 'Database error' });
    return;
  }

  // 400：Prisma 已知错误（保持你原有语义）
  if (err instanceof PrismaClientKnownRequestError) {
    res.status(400).json({ error: 'Database error' });
    return;
  }

  // ===== 权限/鉴权细分：注意顺序，具体子类必须在 AuthError 之前 =====

  // 401：凭证无效
  if (err instanceof InvalidCredentialsError) {
    res.status(401).json({ error: err.message });
    return;
  }

  // 403：禁止访问
  if (err instanceof ForbiddenError) {
    res.status(403).json({ error: err.message });
    return;
  }

  // 409：用户已存在（你定义为 AuthError 的子类）
  if (err instanceof UserAlreadyExistsError) {
    res.status(409).json({ error: err.message });
    return;
  }

  // 401/自带状态码：通用鉴权错误（兜底到 AuthError）
  if (err instanceof AuthError) {
    res.status(err.statusCode || 401).json({ error: err.message });
    return;
  }

  // 409：冲突（并发/状态不满足等）
  if (err instanceof ConflictError) {
    res.status(409).json({ error: err.message });
    return;
  }

  // 400：未知/未处理
  res.status(400).json({ error: 'An unknown error occurred' });
  return;
};
