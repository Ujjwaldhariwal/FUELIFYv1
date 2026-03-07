// fuelify-backend/src/middleware/errorHandler.js
// Global error handler - must be last middleware registered in server.js
const errorHandler = (err, req, res, next) => {
  console.error('[ERROR]', err.message, err.stack);

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
