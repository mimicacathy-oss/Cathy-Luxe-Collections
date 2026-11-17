/**
 * ------------------------------------------------------------------
 * File name : routes/customerRoutes.js
 * Purpose   : All customer endpoints: searchable list, read one,
 *             create, update and delete. Deleting is refused while the
 *             customer still has orders so no sale loses its owner.
 * Connects  : Uses models/Customer.js and models/Order.js. Every route is
 *             protected by middleware/authMiddleware.js. Mounted at
 *             /api/customers in server.js.
 * ------------------------------------------------------------------
 */

const express = require('express');
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const { protect } = require('../middleware/authMiddleware');
const { createHttpError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * Escape the special characters that have a meaning inside a regular
 * expression, so a search for "(" cannot break the query.
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
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (Number.isInteger(page) === false || page < 1) {
    page = 1;
  }
  if (Number.isInteger(limit) === false || limit < 1) {
    limit = 10;
  }
  if (limit > 100) {
    limit = 100;
  }

  return { page: page, limit: limit, skip: (page - 1) * limit };
}

/**
 * Build the MongoDB filter object from the query string.
 *
 * @param {Object} query - The Express req.query object with an optional search.
 * @returns {Object} A filter object ready for Customer.find().
 */
function buildCustomerFilter(query) {
  const filter = {};

  // Step 1: "search" matches the name OR the phone number, case-insensitively.
  if (query.search && String(query.search).trim() !== '') {
    const safeSearch = escapeRegex(String(query.search).trim());
    filter.$or = [
      { name: { $regex: safeSearch, $options: 'i' } },
      { phone: { $regex: safeSearch, $options: 'i' } }
    ];
  }

  return filter;
}

/**
 * Copy the values the client sent onto a customer document, skipping any field
 * the client did not include. Only these four fields can ever be written.
 *
 * @param {Object} customer - The Mongoose customer document to modify.
 * @param {Object} body - The JSON body sent by the browser.
 * @returns {Object} The same customer document, ready to be saved.
 */
function applyCustomerPayload(customer, body) {
  if (body.name !== undefined) {
    customer.name = body.name;
  }
  if (body.phone !== undefined) {
    customer.phone = body.phone;
  }
  if (body.email !== undefined) {
    customer.email = body.email;
  }
  if (body.preferences !== undefined) {
    customer.preferences = body.preferences;
  }
  return customer;
}

// GET /api/customers
// Who may call it : Logged-in staff.
// What it does    : Lists customers with an optional search and pagination.
router.get('/', protect, async function (req, res, next) {
  try {
    const pagination = parsePagination(req.query);
    const filter = buildCustomerFilter(req.query);

    const totalItems = await Customer.countDocuments(filter);
    const items = await Customer.find(filter)
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

// GET /api/customers/:id
// Who may call it : Logged-in staff.
// What it does    : Returns one customer, or 404 when it does not exist.
router.get('/:id', protect, async function (req, res, next) {
  try {
    if (mongoose.Types.ObjectId.isValid(req.params.id) === false) {
      throw createHttpError(404, 'Customer not found.');
    }

    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      throw createHttpError(404, 'Customer not found.');
    }

    res.json(customer);
  } catch (error) {
    next(error);
  }
});

// POST /api/customers
// Who may call it : Logged-in staff.
// What it does    : Creates a customer. The phone number must be unique.
router.post('/', protect, async function (req, res, next) {
  try {
    const customer = new Customer();
    applyCustomerPayload(customer, req.body);

    await customer.save();

    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
});

// PUT /api/customers/:id
// Who may call it : Logged-in staff.
// What it does    : Updates an existing customer.
router.put('/:id', protect, async function (req, res, next) {
  try {
    if (mongoose.Types.ObjectId.isValid(req.params.id) === false) {
      throw createHttpError(404, 'Customer not found.');
    }

    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      throw createHttpError(404, 'Customer not found.');
    }

    applyCustomerPayload(customer, req.body);

    await customer.save();

    res.json(customer);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/customers/:id
// Who may call it : Logged-in staff.
// What it does    : Deletes a customer, but refuses when the customer still
//                   has orders (otherwise those orders would lose their owner).
router.delete('/:id', protect, async function (req, res, next) {
  try {
    if (mongoose.Types.ObjectId.isValid(req.params.id) === false) {
      throw createHttpError(404, 'Customer not found.');
    }

    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      throw createHttpError(404, 'Customer not found.');
    }

    // Step 1: Any order at all (Completed or Cancelled) blocks the delete,
    // because the order history would otherwise point at a missing customer.
    const orderCount = await Order.countDocuments({ customer: customer._id });

    if (orderCount > 0) {
      throw createHttpError(
        400,
        'Cannot delete "' + customer.name + '" because they have ' + orderCount +
          ' order(s). Delete those orders first.'
      );
    }

    // Step 2: No orders, so it is safe to remove the customer.
    await customer.deleteOne();

    res.json({ message: 'Customer deleted.', id: customer._id });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
