// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'auth-middleware' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Authentication middleware
 * Verifies JWT tokens for protected routes
 */
const authenticate = (req, res, next) => {
  try {
    // Skip authentication for development mode
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
      req.user = { id: 'dev-user', role: 'admin' };
      return next();
    }

    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    logger.info(`User authenticated: ${decoded.id}`);
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token expired.'
      });
    }

    logger.error('Authentication error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Authentication failed.'
    });
  }
};

/**
 * Role-based authorization middleware
 * Checks if user has required role
 */
const authorize = (roles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          message: 'User not authenticated.'
        });
      }

      // If roles is a string, convert to array
      const allowedRoles = Array.isArray(roles) ? roles : [roles];

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. Insufficient permissions.'
        });
      }

      next();

    } catch (error) {
      logger.error('Authorization error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Authorization failed.'
      });
    }
  };
};

/**
 * Generate JWT token
 */
const generateToken = (user) => {
  try {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        issuer: 'edunudge-ai'
      }
    );

    return token;

  } catch (error) {
    logger.error('Token generation error:', error);
    throw error;
  }
};

/**
 * Refresh token middleware
 */
const refreshToken = (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({
        status: 'error',
        message: 'Refresh token required.'
      });
    }

    // In a real implementation, you'd store refresh tokens in database
    // For now, just verify it's a valid JWT
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    
    // Generate new access token
    const newToken = generateToken(decoded);
    
    res.json({
      status: 'success',
      accessToken: newToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });

  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({
      status: 'error',
      message: 'Invalid refresh token.'
    });
  }
};

module.exports = {
  authenticate,
  authorize,
  generateToken,
  refreshToken
};