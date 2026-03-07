const jwt = require('jsonwebtoken');

const verifyLocalToken = (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (!decoded?.id) {
    const err = new Error('Invalid local token');
    err.status = 401;
    throw err;
  }
  return { ownerId: decoded.id, mode: 'LOCAL' };
};

const decodeUnverifiedToken = (token) => {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded !== 'object') return null;
  return decoded;
};

const verifyCognitoTransitionToken = (token) => {
  const allowUnverified =
    process.env.COGNITO_TRANSITION_ALLOW_UNVERIFIED === 'true' &&
    process.env.NODE_ENV !== 'production';

  if (!allowUnverified) {
    const err = new Error('Cognito verification not fully configured');
    err.status = 503;
    throw err;
  }

  const decoded = decodeUnverifiedToken(token);
  const cognitoSub = decoded?.sub || decoded?.username;
  if (!cognitoSub) {
    const err = new Error('Invalid Cognito transition token');
    err.status = 401;
    throw err;
  }

  return { cognitoSub, mode: 'COGNITO_TRANSITION' };
};

const verifyAccessToken = (token) => {
  const authProvider = (process.env.AUTH_PROVIDER || 'LOCAL').toUpperCase();

  if (authProvider === 'LOCAL') return verifyLocalToken(token);
  if (authProvider === 'COGNITO_TRANSITION') {
    try {
      return verifyLocalToken(token);
    } catch (localErr) {
      return verifyCognitoTransitionToken(token);
    }
  }

  const err = new Error('Unsupported auth provider');
  err.status = 500;
  throw err;
};

module.exports = { verifyAccessToken };
