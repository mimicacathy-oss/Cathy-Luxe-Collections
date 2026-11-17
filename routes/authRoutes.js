/**
 * ------------------------------------------------------------------
 * File name : routes/authRoutes.js
 * Purpose   : The single authentication endpoint. It checks the email
 *             and password against the stored bcrypt hash and, when they
 *             match, returns a signed JSON Web Token that the browser
 *             sends with every private request.
 * Connects  : Uses models/User.js. The token it creates is verified by
 *             middleware/authMiddleware.js. Mounted at /api/auth in
 *             server.js.
 * ------------------------------------------------------------------
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createHttpError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * Create a signed JSON Web Token for a user.
 *
 * @param {Object} user - The Mongoose user document that just logged in.
 * @returns {string} A token that expires after 8 hours.
 */
function createTokenForUser(user) {
  // Step 1: Put only the user id in the payload. Anything else would be
  // readable by the browser, and the id is all we need to reload the user.
  const payload = { id: user._id.toString() };

  // Step 2: Sign the payload with the secret from .env and give the token an
  // 8 hour lifetime, so a stolen token stops working after one working day.
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

  return token;
}

// POST /api/auth/login
// Who may call it : PUBLIC (no token required, this is where you get the token).
// What it does    : Validates the credentials and returns { token, user }.
router.post('/login', async function (req, res, next) {
  try {
    // Step 1: Normalise the input. Trimming and lower-casing the email means
    // "Admin@Perfume.com " still matches the stored account.
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    // Step 2: Both fields are mandatory. An empty password can never match a hash.
    if (email === '' || password === '') {
      throw createHttpError(400, 'Please enter both your email and your password.');
    }

    // Step 3: Look the account up by email.
    const user = await User.findOne({ email: email });

    if (!user) {
      // Step 4: We deliberately use the SAME message for "unknown email" and
      // "wrong password". That way nobody can use this endpoint to discover
      // which email addresses have accounts.
      throw createHttpError(401, 'Incorrect email or password.');
    }

    // Step 5: bcrypt.compare re-hashes the typed password with the stored salt
    // and compares the results. The plain password is never stored anywhere.
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (passwordMatches === false) {
      throw createHttpError(401, 'Incorrect email or password.');
    }

    // Step 6: Build the token and answer. Notice that passwordHash is NOT
    // included in the response, so it can never leak to the browser.
    const token = createTokenForUser(user);

    res.json({
      token: token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    // Step 7: Hand any unexpected problem to the central error handler.
    next(error);
  }
});

module.exports = router;
