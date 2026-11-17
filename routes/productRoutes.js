/**
 * ------------------------------------------------------------------
 * File name : routes/productRoutes.js
 * Purpose   : All perfume endpoints: the public catalogue list, the
 *             private searchable list, and create / read / update /
 *             delete. Deleting is refused while a perfume is used by a
 *             completed order so old receipts stay meaningful.
 * Connects  : Uses models/Product.js and models/Order.js. Protected by
 *             middleware/authMiddleware.js (except the /public route).
 *             Mounted at /api/products in server.js.
 * ------------------------------------------------------------------
 */

const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { protect } = require('../middleware/authMiddleware');
const { createHttpError } = require('../middleware/errorHandler');

const router = express.Router();

// Configure multer for local image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed.'));
  }
});

/**
 * Escape the special characters that have a meaning inside a regular
 * expression. Without this, a search for "(" would crash the query.
 *
 * @param {string} text - The raw text typed by the user.
 * @returns {string} The same text, safe to use inside a RegExp.
 */
function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Read the page and limit query string values and turn them into numbers.
 *
 * @param {Object} query - The Express req.query object.
 * @returns {{page: number, limit: number, skip: number}} Safe paging values.
 */
function parsePagination(query) {
  // Step 1: Convert the text values to numbers.
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  // Step 2: Fall back to page 1 and 8 items per page when the value is missing
  // or not a sensible positive whole number.
  if (Number.isInteger(page) === false || page < 1) {
    page = 1;
  }
  if (Number.isInteger(limit) === false || limit < 1) {
    limit = 8;
  }

  // Step 3: Cap the page size so one request cannot ask for the whole table.
  if (limit > 100) {
    limit = 100;
  }

  return { page: page, limit: limit, skip: (page - 1) * limit };
}

/**
 * Build the MongoDB filter object from the query string.
 *
 * @param {Object} query - The Express req.query object with search, category,
 *   minPrice and maxPrice.
 * @returns {Object} A filter object ready for Product.find().
 */
function buildProductFilter(query) {
  const filter = {};

  // Step 1: "search" matches either the name or the brand, case-insensitively.
  if (query.search && String(query.search).trim() !== '') {
    const safeSearch = escapeRegex(String(query.search).trim());
    filter.$or = [
      { name: { $regex: safeSearch, $options: 'i' } },
      { brand: { $regex: safeSearch, $options: 'i' } }
    ];
  }

  // Step 2: "category" is an exact match against one of the six categories.
  if (query.category && String(query.category).trim() !== '') {
    filter.category = String(query.category).trim();
  }

  // Step 3: "minPrice" and "maxPrice" build an inclusive price range. We only
  // add the price block at all when the user actually typed a bound.
  const hasMinPrice = query.minPrice !== undefined && query.minPrice !== '';
  const hasMaxPrice = query.maxPrice !== undefined && query.maxPrice !== '';

  if (hasMinPrice || hasMaxPrice) {
    filter.price = {};
    if (hasMinPrice) {
      filter.price.$gte = Number(query.minPrice);
    }
    if (hasMaxPrice) {
      filter.price.$lte = Number(query.maxPrice);
    }
  }

  return filter;
}

/**
 * Copy the values the client sent onto a product document, skipping any field
 * the client did not include. Only these eight fields can ever be written.
 *
 * @param {Object} product - The Mongoose product document to modify.
 * @param {Object} body - The JSON body sent by the browser.
 * @returns {Object} The same product document, ready to be saved.
 */
function applyProductPayload(product, body) {
  if (body.name !== undefined) {
    product.name = body.name;
  }
  if (body.brand !== undefined) {
    product.brand = body.brand;
  }
  if (body.category !== undefined) {
    product.category = body.category;
  }
  if (body.size !== undefined) {
    product.size = body.size;
  }
  if (body.price !== undefined) {
    product.price = body.price;
  }
  if (body.stock !== undefined) {
    product.stock = body.stock;
  }
  if (body.imageUrl !== undefined) {
    product.imageUrl = body.imageUrl;
  }
  if (body.notes !== undefined) {
    product.notes = body.notes;
  }
  return product;
}

// GET /api/products/public
// Who may call it : PUBLIC (used by the catalogue page, no login needed).
// What it does    : Lists only the perfumes that are in stock, using the same
//                   search / category / price filters and pagination.
router.get('/public', async function (req, res, next) {
  try {
    const pagination = parsePagination(req.query);
    const filter = buildProductFilter(req.query);

    // Step 1: Force the stock rule of the public catalogue: only sellable
    // items are shown, so a sold-out perfume never appears here.
    filter.stock = { $gt: 0 };

    // Step 2: Count and fetch the requested page.
    const totalItems = await Product.countDocuments(filter);
    const items = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    // Step 3: Answer in the same shape as the private list, so the same
    // frontend helper can render both pages.
    res.json({
      items: items,
      page: pagination.page,
      totalPages: Math.ceil(totalItems / pagination.limit),
      totalItems: totalItems
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/products
// Who may call it : Logged-in staff.
// What it does    : The management list, including out-of-stock perfumes.
router.get('/', protect, async function (req, res, next) {
  try {
    const pagination = parsePagination(req.query);
    const filter = buildProductFilter(req.query);

    const totalItems = await Product.countDocuments(filter);
    const items = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    res.json({
      items: items,
      page: pagination.page,
      totalPages: Math.ceil(totalItems / pagination.limit),
      totalItems: totalItems
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/products/:id
// Who may call it : Logged-in staff.
// What it does    : Returns one perfume, or 404 when it does not exist.
router.get('/:id', protect, async function (req, res, next) {
  try {
    // Step 1: Reject a malformed id before asking MongoDB, so we answer with a
    // clean 404 instead of a database error.
    if (mongoose.Types.ObjectId.isValid(req.params.id) === false) {
      throw createHttpError(404, 'Product not found.');
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      throw createHttpError(404, 'Product not found.');
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});

// POST /api/products
// Who may call it : Logged-in staff.
// What it does    : Creates a new perfume with optional image upload.
router.post('/', protect, upload.single('image'), async function (req, res, next) {
  try {
    // Step 1: Build a document from the eight allowed fields only.
    const product = new Product();
    applyProductPayload(product, req.body);

    // Step 2: If an image was uploaded, set imageUrl to the local path.
    if (req.file) {
      product.imageUrl = '/uploads/' + req.file.filename;
    }

    // Step 3: Save. Mongoose throws a ValidationError when a rule is broken
    // (missing name, unknown category, negative price...) and the central
    // error handler turns that into a readable 400 response.
    await product.save();

    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

// PUT /api/products/:id
// Who may call it : Logged-in staff.
// What it does    : Updates an existing perfume with optional image upload.
router.put('/:id', protect, upload.single('image'), async function (req, res, next) {
  try {
    if (mongoose.Types.ObjectId.isValid(req.params.id) === false) {
      throw createHttpError(404, 'Product not found.');
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      throw createHttpError(404, 'Product not found.');
    }

    // Step 1: Overlay only the fields that were sent.
    applyProductPayload(product, req.body);

    // Step 2: If a new image was uploaded, update imageUrl.
    if (req.file) {
      product.imageUrl = '/uploads/' + req.file.filename;
    }

    // Step 3: Save, which again runs all the Mongoose validation rules.
    await product.save();

    res.json(product);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/products/:id
// Who may call it : Logged-in staff.
// What it does    : Deletes a perfume, but refuses when the perfume is part of
//                   a completed order, because that order's history must stay.
router.delete('/:id', protect, async function (req, res, next) {
  try {
    if (mongoose.Types.ObjectId.isValid(req.params.id) === false) {
      throw createHttpError(404, 'Product not found.');
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      throw createHttpError(404, 'Product not found.');
    }

    // Step 1: Count the completed orders that contain this perfume. Cancelled
    // orders do not block the delete, because they no longer affect the shop.
    const completedOrderCount = await Order.countDocuments({
      status: 'Completed',
      'items.product': product._id
    });

    if (completedOrderCount > 0) {
      throw createHttpError(
        400,
        'Cannot delete "' + product.name + '" because it appears in ' +
          completedOrderCount + ' completed order(s). Cancel or delete those orders first.'
      );
    }

    // Step 2: Nothing is holding the perfume back, so remove it.
    await product.deleteOne();

    res.json({ message: 'Perfume deleted.', id: product._id });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
