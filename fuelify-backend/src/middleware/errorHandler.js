// fuelify-backend/src/middleware/errorHandler.js
// Global error handler - must be last middleware registered in server.js
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  console.error('[ERROR]', err.message, err.stack);

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';
  const code = err.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED');
  res.status(status).json({
    success: false,
    error: message,
    code,
    requestId: req.requestId || null,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
