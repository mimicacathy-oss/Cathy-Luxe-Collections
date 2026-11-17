/**
 * ------------------------------------------------------------------
 * File name : models/User.js
 * Purpose   : Mongoose model for a staff account that may log in.
 * Connects  : Used by routes/authRoutes.js (to check the login) and by
 *             middleware/authMiddleware.js (to load the logged-in user).
 *             Passwords are stored only as a bcrypt hash and are never
 *             sent to the browser.
 * ------------------------------------------------------------------
 */

const mongoose = require('mongoose');

// The shape of one staff account inside MongoDB.
const userSchema = new mongoose.Schema({
  // The display name shown in the navbar greeting. Required, trimmed so that
  // accidental leading/trailing spaces are removed.
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },

  // The login email address. Required, stored in lower case and unique so two
  // accounts cannot be created with the same address (differing only by case).
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },

  // The bcrypt hash of the password. We never store the plain password, and
  // this field is never returned to the browser by any route.
  passwordHash: {
    type: String,
    required: [true, 'Password hash is required']
  },

  // The moment the account was created. Defaults to "now" so it is always set.
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);
