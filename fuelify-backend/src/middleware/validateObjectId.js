const mongoose = require('mongoose');

const validateObjectIdParam = (paramName) => (req, res, next) => {
  const value = req.params[paramName];
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return res.status(400).json({ error: `Invalid ${paramName}` });
  }
  return next();
};

module.exports = { validateObjectIdParam };
