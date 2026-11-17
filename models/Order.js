/**
 * ------------------------------------------------------------------
 * File name : models/Order.js
 * Purpose   : Mongoose model for a sale. One order belongs to one
 *             customer and contains one or more perfume lines.
 * Connects  : Used by routes/orderRoutes.js (create/edit/cancel/delete,
 *             including all the stock movement) and by
 *             routes/dashboardRoutes.js (sales totals and best sellers).
 *             References models/Customer.js and models/Product.js.
 * ------------------------------------------------------------------
 */

const mongoose = require('mongoose');

// One line of an order. The name and price are copied (snapshotted) from the
// product at the moment of the sale, so a later price change does not rewrite
// the history of an old receipt.
const orderItemSchema = new mongoose.Schema(
  {
    // Reference to the perfume that was sold. Required so stock can be given
    // back if the order is later cancelled or deleted.
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Item product is required']
    },

    // SNAPSHOT of the perfume name at sale time (never changes afterwards).
    name: {
      type: String,
      required: [true, 'Item name is required']
    },

    // SNAPSHOT of the unit price at sale time.
    price: {
      type: Number,
      required: [true, 'Item price is required'],
      min: [0, 'Item price cannot be negative']
    },

    // How many bottles were sold. Must be a whole number of at least one.
    quantity: {
      type: Number,
      required: [true, 'Item quantity is required'],
      min: [1, 'Quantity must be at least 1']
    }
  },
  // Lines do not need their own _id: the frontend addresses them by position.
  { _id: false }
);

// The shape of one order inside MongoDB.
const orderSchema = new mongoose.Schema(
  {
    // The customer who placed the order. Required, and always populated with
    // the name when the list of orders is requested.
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer is required']
    },

    // The perfume lines. At least one line is required: an empty order would
    // make no sense and would break the order total.
    items: {
      type: [orderItemSchema],
      validate: {
        validator: function (value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: 'An order must contain at least one item'
      }
    },

    // The money total. It is always calculated on the server from the item
    // snapshots, never taken from the browser, so it cannot be tampered with.
    total: {
      type: Number,
      required: [true, 'Order total is required'],
      min: [0, 'Order total cannot be negative']
    },

    // The life cycle of the order. Only these two values are allowed.
    status: {
      type: String,
      enum: {
        values: ['Completed', 'Cancelled'],
        message: 'Status must be Completed or Cancelled'
      },
      default: 'Completed'
    },

    // An optional note written by the staff, for example a delivery remark.
    note: {
      type: String,
      trim: true,
      default: ''
    }
  },
  // timestamps: true adds createdAt and updatedAt automatically.
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
