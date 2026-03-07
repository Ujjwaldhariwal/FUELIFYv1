const mongoose = require('mongoose');

const validateObjectIdParam = (paramName) => (req, res, next) => {
  const value = req.params[paramName];
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return res.status(400).json({ error: `Invalid ${paramName}`, code: 'INVALID_OBJECT_ID', requestId: req.requestId });
  }
  return next();
};

module.exports = { validateObjectIdParam };
