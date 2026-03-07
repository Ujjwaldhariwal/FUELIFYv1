const crypto = require('crypto');

const createRequestId = () => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const requestContext = (req, res, next) => {
  const incomingId = req.header('x-request-id');
  req.requestId = incomingId && incomingId.trim() ? incomingId.trim() : createRequestId();
  res.setHeader('x-request-id', req.requestId);
  next();
};

module.exports = { requestContext };
