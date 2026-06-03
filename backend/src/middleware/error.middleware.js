// ─────────────────────────────────────────────────────────────────────────────
// src/middleware/error.middleware.js
// Global Express error handler and 404 handler.
// Maps Prisma errors, JWT errors, Multer errors, and generic errors to
// clean JSON responses using the response utils envelope.
// ─────────────────────────────────────────────────────────────────────────────

import { Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import multer from 'multer';

// ─── 404 handler ──────────────────────────────────────────────────────────────

/**
 * Catch-all for routes that don't exist.
 * Mount this AFTER all route definitions.
 *
 * @type {import('express').RequestHandler}
 */
export function notFoundHandler(req, res, _next) {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    code:    'NOT_FOUND',
  });
}

// ─── Global error handler ─────────────────────────────────────────────────────

/**
 * Express global error handler.
 * Must have 4 parameters (err, req, res, next) to be recognised by Express.
 * Mount this LAST, after all routes and other middleware.
 *
 * @type {import('express').ErrorRequestHandler}
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Log the error (abbreviated in production)
  if (process.env.NODE_ENV !== 'production') {
    console.error('[ErrorHandler]', err);
  } else {
    console.error('[ErrorHandler]', err.message);
  }

  // ── Prisma: Record not found ───────────────────────────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return handlePrismaError(err, res);
  }

  // ── Prisma: Validation / schema error ─────────────────────────────────────
  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      success: false,
      message: 'Database validation error',
      code:    'DB_VALIDATION_ERROR',
      ...(process.env.NODE_ENV !== 'production' && { detail: err.message }),
    });
  }

  // ── JWT errors ────────────────────────────────────────────────────────────
  if (err instanceof jwt.TokenExpiredError) {
    return res.status(401).json({
      success: false,
      message: 'Token has expired',
      code:    'TOKEN_EXPIRED',
    });
  }

  if (err instanceof jwt.JsonWebTokenError) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      code:    'TOKEN_INVALID',
    });
  }

  if (err instanceof jwt.NotBeforeError) {
    return res.status(401).json({
      success: false,
      message: 'Token not yet valid',
      code:    'TOKEN_NOT_BEFORE',
    });
  }

  // ── Multer errors ─────────────────────────────────────────────────────────
  if (err instanceof multer.MulterError) {
    return handleMulterError(err, res);
  }

  // ── CORS errors ───────────────────────────────────────────────────────────
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({
      success: false,
      message: err.message,
      code:    'CORS_BLOCKED',
    });
  }

  // ── Custom app errors (thrown with a statusCode property) ─────────────────
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message || 'An error occurred',
      code:    err.code    || 'APP_ERROR',
      ...(err.errors && { errors: err.errors }),
    });
  }

  // ── Syntax error in JSON body ──────────────────────────────────────────────
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body',
      code:    'INVALID_JSON',
    });
  }

  // ── Payload too large ─────────────────────────────────────────────────────
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Request payload is too large',
      code:    'PAYLOAD_TOO_LARGE',
    });
  }

  // ── Generic fallback ──────────────────────────────────────────────────────
  const statusCode = err.status || err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error'
      : err.message || 'Internal server error';

  return res.status(statusCode).json({
    success: false,
    message,
    code:    'SERVER_ERROR',
    ...(process.env.NODE_ENV !== 'production' && statusCode === 500 && {
      stack: err.stack,
    }),
  });
}

// ─── Prisma error mapper ──────────────────────────────────────────────────────

function handlePrismaError(err, res) {
  switch (err.code) {
    // Unique constraint violation
    case 'P2002': {
      const field = err.meta?.target?.join(', ') || 'field';
      return res.status(409).json({
        success: false,
        message: `A record with this ${field} already exists`,
        code:    'DUPLICATE_ENTRY',
        field,
      });
    }

    // Record not found
    case 'P2025':
      return res.status(404).json({
        success: false,
        message: err.meta?.cause || 'Record not found',
        code:    'NOT_FOUND',
      });

    // Foreign key constraint failed
    case 'P2003':
      return res.status(400).json({
        success: false,
        message: 'Related record not found',
        code:    'FOREIGN_KEY_VIOLATION',
        field:   err.meta?.field_name,
      });

    // Required field missing
    case 'P2011':
      return res.status(400).json({
        success: false,
        message: `Required field is null: ${err.meta?.constraint}`,
        code:    'NULL_CONSTRAINT',
      });

    // Value too long for column
    case 'P2000':
      return res.status(400).json({
        success: false,
        message: `Value too long for field: ${err.meta?.column_name}`,
        code:    'VALUE_TOO_LONG',
      });

    // Database connection issue
    case 'P1001':
    case 'P1002':
      return res.status(503).json({
        success: false,
        message: 'Database connection error',
        code:    'DB_UNAVAILABLE',
      });

    default:
      return res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production'
          ? 'Database error'
          : `Prisma error ${err.code}: ${err.message}`,
        code: 'DB_ERROR',
      });
  }
}

// ─── Multer error mapper ──────────────────────────────────────────────────────

function handleMulterError(err, res) {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return res.status(413).json({
        success: false,
        message: 'File is too large. Check the maximum allowed size.',
        code:    'FILE_TOO_LARGE',
      });

    case 'LIMIT_FILE_COUNT':
      return res.status(400).json({
        success: false,
        message: 'Too many files uploaded at once.',
        code:    'TOO_MANY_FILES',
      });

    case 'LIMIT_UNEXPECTED_FILE':
      return res.status(400).json({
        success: false,
        message: `Unexpected file field: ${err.field}`,
        code:    'UNEXPECTED_FILE_FIELD',
      });

    default:
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
        code:    'UPLOAD_ERROR',
      });
  }
}

// ─── App error factory ────────────────────────────────────────────────────────

/**
 * Create a structured application error that the error handler understands.
 *
 * @param {string} message
 * @param {number} statusCode
 * @param {string} [code]
 * @param {Array}  [errors]
 * @returns {Error}
 */
export function createAppError(message, statusCode = 500, code = 'APP_ERROR', errors = null) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code       = code;
  if (errors) err.errors = errors;
  return err;
}