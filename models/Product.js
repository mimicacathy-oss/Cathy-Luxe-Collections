/**
 * ------------------------------------------------------------------
 * File name : models/Product.js
 * Purpose   : Mongoose model for a perfume that the shop sells.
 * Connects  : Used by routes/productRoutes.js (full CRUD) and
 *             routes/orderRoutes.js (stock is reduced when a perfume is
 *             sold). The public catalogue also reads this model.
 * ------------------------------------------------------------------
 */

const mongoose = require('mongoose');

// The only categories the shop recognises. Mongoose rejects anything else,
// which keeps the database tidy even if the browser form is bypassed.
const PRODUCT_CATEGORIES = ['Men', 'Women', 'Unisex', 'Oud', 'Fresh', 'Floral'];

// The shape of one perfume inside MongoDB.
const productSchema = new mongoose.Schema(
  {
    // The perfume name, for example "Bleu Intense". Required and trimmed.
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true
    },

    // The house that makes the perfume, for example "Chanel". Required.
    brand: {
      type: String,
      required: [true, 'Brand is required'],
      trim: true
    },

    // One of the six allowed categories. Required because the catalogue and
    // the product filters both rely on it.
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: PRODUCT_CATEGORIES,
        message: 'Category must be one of: ' + PRODUCT_CATEGORIES.join(', ')
      }
    },

    // The bottle size as free text, for example "100ml". Optional.
    size: {
      type: String,
      trim: true,
      default: ''
    },

    // The selling price. Required and never allowed to be negative, because a
    // negative price would make the order total meaningless.
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative']
    },

    // How many bottles are on the shelf. Required, never negative, and must be
    // a whole number because you cannot sell half a bottle.
    stock: {
      type: Number,
      required: [true, 'Stock is required'],
      min: [0, 'Stock cannot be negative'],
      validate: {
        validator: function (value) {
          return Number.isInteger(value);
        },
        message: 'Stock must be a whole number'
      }
    },

    // A link to a product photo. Optional: the frontend shows a placeholder
    // image when this is empty or when the link is broken.
    imageUrl: {
      type: String,
      trim: true,
      default: ''
    },

    // Free text describing the scent, for example "Bergamot, amber, cedar".
    notes: {
      type: String,
      trim: true,
      default: ''
    }
  },
  // timestamps: true adds createdAt and updatedAt automatically.
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
