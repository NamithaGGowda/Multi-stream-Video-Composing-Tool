// ─────────────────────────────────────────────────────────────────────────────
// src/utils/response.utils.js
// Standardised JSON response helpers used by all controllers.
// Every API response follows the same envelope shape.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a successful response.
 *
 * @param {import('express').Response} res
 * @param {object}  data         - Payload to return
 * @param {string}  [message]    - Human-readable success message
 * @param {number}  [statusCode] - HTTP status (default 200)
 */
export function sendSuccess(res, data = {}, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

/**
 * Send a 201 Created response.
 *
 * @param {import('express').Response} res
 * @param {object} data
 * @param {string} [message]
 */
export function sendCreated(res, data = {}, message = 'Created successfully') {
  return sendSuccess(res, data, message, 201);
}

/**
 * Send a paginated list response.
 * Sets X-Total-Count, X-Page, X-Per-Page headers for the frontend.
 *
 * @param {import('express').Response} res
 * @param {Array}  items
 * @param {object} pagination
 * @param {number} pagination.total    - Total number of records
 * @param {number} pagination.page     - Current page (1-based)
 * @param {number} pagination.perPage  - Items per page
 * @param {string} [message]
 */
export function sendPaginated(res, items, pagination, message = 'Success') {
  const { total, page, perPage } = pagination;
  const totalPages = Math.ceil(total / perPage);

  res.set('X-Total-Count', String(total));
  res.set('X-Page',        String(page));
  res.set('X-Per-Page',    String(perPage));
  res.set('X-Total-Pages', String(totalPages));

  return res.status(200).json({
    success: true,
    message,
    data: items,
    pagination: {
      total,
      page,
      perPage,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
}

/**
 * Send an error response.
 *
 * @param {import('express').Response} res
 * @param {string}  message     - Human-readable error message
 * @param {number}  [statusCode] - HTTP status (default 400)
 * @param {object}  [errors]    - Field-level validation errors
 * @param {string}  [code]      - Machine-readable error code
 */
export function sendError(res, message = 'An error occurred', statusCode = 400, errors = null, code = null) {
  const body = {
    success: false,
    message,
  };

  if (code)   body.code   = code;
  if (errors) body.errors = errors;

  return res.status(statusCode).json(body);
}

/**
 * Send a 401 Unauthorized response.
 * @param {import('express').Response} res
 * @param {string} [message]
 */
export function sendUnauthorized(res, message = 'Unauthorized') {
  return sendError(res, message, 401, null, 'UNAUTHORIZED');
}

/**
 * Send a 403 Forbidden response.
 * @param {import('express').Response} res
 * @param {string} [message]
 */
export function sendForbidden(res, message = 'Forbidden') {
  return sendError(res, message, 403, null, 'FORBIDDEN');
}

/**
 * Send a 404 Not Found response.
 * @param {import('express').Response} res
 * @param {string} [resource]
 */
export function sendNotFound(res, resource = 'Resource') {
  return sendError(res, `${resource} not found`, 404, null, 'NOT_FOUND');
}

/**
 * Send a 409 Conflict response.
 * @param {import('express').Response} res
 * @param {string} [message]
 */
export function sendConflict(res, message = 'Conflict') {
  return sendError(res, message, 409, null, 'CONFLICT');
}

/**
 * Send a 422 Unprocessable Entity with field-level validation errors.
 * @param {import('express').Response} res
 * @param {Array}  errors   - Array of { field, message } objects
 * @param {string} [message]
 */
export function sendValidationError(res, errors, message = 'Validation failed') {
  return sendError(res, message, 422, errors, 'VALIDATION_ERROR');
}

/**
 * Send a 429 Too Many Requests response.
 * @param {import('express').Response} res
 * @param {string} [message]
 */
export function sendTooManyRequests(res, message = 'Too many requests') {
  return sendError(res, message, 429, null, 'RATE_LIMITED');
}

/**
 * Send a 500 Internal Server Error response.
 * Hides internal details in production.
 *
 * @param {import('express').Response} res
 * @param {Error|string} [err]
 */
export function sendServerError(res, err = null) {
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err instanceof Error
        ? err.message
        : String(err || 'Internal server error');

  return sendError(res, message, 500, null, 'SERVER_ERROR');
}