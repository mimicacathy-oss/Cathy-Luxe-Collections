/**
 * ------------------------------------------------------------------
 * File name : middleware/authMiddleware.js
 * Purpose   : Protects private API routes. It reads the JSON Web Token
 *             from the "Authorization: Bearer <token>" header, checks the
 *             signature and the expiry date, loads the matching user and
 *             attaches it to the request as req.user.
 * Connects  : The token is created in routes/authRoutes.js. Every private
 *             router (products, customers, orders, dashboard) uses the
 *             exported "protect" function.
 * ------------------------------------------------------------------
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Express middleware that rejects any request without a valid token.
 *
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 * @param {Function} next - Callback that continues to the route handler when
 *   the caller is allowed in.
 * @returns {Promise<void>} Sends a 401 JSON response when the caller is not
 *   allowed, otherwise it calls next() and returns nothing.
 */
async function protect(req, res, next) {
  try {
    // Step 1: Read the Authorization header. A missing header means the browser
    // never logged in, so we answer 401 "not logged in" instead of crashing.
    const authHeader = req.headers.authorization || '';

    if (authHeader.startsWith('Bearer ') === false) {
      res.status(401).json({ message: 'Not authorised. Please log in.' });
      return;
    }

    // Step 2: Split "Bearer abc.def.ghi" and keep only the token part.
    const token = authHeader.slice(7);

    // Step 3: Verify the signature and the expiry date. jwt.verify throws when
    // the token was edited or when the 8 hour lifetime has passed.
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Step 4: Load the user again. This means a deleted account cannot keep
    // using an old token that has not expired yet.
    const user = await User.findById(payload.id).select('-passwordHash');

    if (!user) {
      res.status(401).json({ message: 'Your account no longer exists. Please log in again.' });
      return;
    }

    // Step 5: Attach the user so later handlers (and the audit trail) know who
    // is making the request, then continue to the route handler.
    req.user = user;
    next();
  } catch (error) {
    // Any problem with the token (bad signature, expired, malformed) is a 401.
    res.status(401).json({ message: 'Your session is invalid or has expired. Please log in again.' });
  }
}

module.exports = {
  protect: protect
};
