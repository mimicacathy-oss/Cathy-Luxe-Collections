/**
 * ------------------------------------------------------------------
 * File name : models/Customer.js
 * Purpose   : Mongoose model for a person who buys perfume from the shop.
 * Connects  : Used by routes/customerRoutes.js (full CRUD) and referenced
 *             by models/Order.js so every sale points at one customer.
 * ------------------------------------------------------------------
 */

const mongoose = require('mongoose');

// The shape of one customer inside MongoDB.
const customerSchema = new mongoose.Schema(
  {
    // The customer's full name. Required so the order list can show who bought.
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true
    },

    // The phone number. Required and unique because it is the shop's main way
    // of contacting a customer and distinguishing two people with the same name.
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true
    },

    // An optional email address used for receipts.
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },

    // Free text about the customer's taste, for example "Loves oud and amber".
    // Staff use it to recommend the next purchase.
    preferences: {
      type: String,
      trim: true,
      default: ''
    }
  },
  // timestamps: true adds createdAt and updatedAt automatically.
  { timestamps: true }
);

module.exports = mongoose.model('Customer', customerSchema);
