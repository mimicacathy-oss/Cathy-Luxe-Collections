/**
 * ------------------------------------------------------------------
 * File name : routes/orderRoutes.js
 * Purpose   : All sales endpoints: list, read one, create, edit, cancel
 *             and delete. This file also owns ALL the stock movement.
 *
 *             The stock rules (no database transactions are used, because a
 *             local MongoDB is often not a replica set):
 *               1. Create  : check every perfume has enough stock, take it,
 *                            and only then save the order.
 *               2. Edit    : give the OLD items' stock back first, then take
 *                            the NEW items' stock; if the new items are
 *                            refused, put the old stock back so nothing is lost.
 *               3. Cancel  : mark Cancelled and give the stock back.
 *               4. Delete  : give the stock back first if the order was Completed.
 *
 * Connects  : Uses models/Order.js, models/Customer.js and models/Product.js.
 *             Every route is protected by middleware/authMiddleware.js.
 *             Mounted at /api/orders in server.js.
 * ------------------------------------------------------------------
 */

const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const { protect } = require('../middleware/authMiddleware');
const { createHttpError } = require('../middleware/errorHandler');

const router = express.Router();

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
    limit = 8;
  }
  if (limit > 100) {
    limit = 100;
  }

  return { page: page, limit: limit, skip: (page - 1) * limit };
}

/**
 * Build the MongoDB filter object from the query string.
 *
 * @param {Object} query - The Express req.query object with status, from and to.
 * @returns {Object} A filter object ready for Order.find().
 */
function buildOrderFilter(query) {
  const filter = {};

  // Step 1: "status" is an exact match against Completed or Cancelled.
  if (query.status && String(query.status).trim() !== '') {
    filter.status = String(query.status).trim();
  }

  // Step 2: "from" and "to" build a date range. The whole "from" day and the
  // whole "to" day are included, which is what a shopkeeper expects.
  const hasFrom = query.from && String(query.from).trim() !== '';
  const hasTo = query.to && String(query.to).trim() !== '';

  if (hasFrom || hasTo) {
    const dateFilter = {};

    if (hasFrom) {
      const fromDate = new Date(String(query.from));
      if (isNaN(fromDate.getTime()) === false) {
        fromDate.setHours(0, 0, 0, 0);
        dateFilter.$gte = fromDate;
      }
    }

    if (hasTo) {
      const toDate = new Date(String(query.to));
      if (isNaN(toDate.getTime()) === false) {
        toDate.setHours(23, 59, 59, 999);
        dateFilter.$lte = toDate;
      }
    }

    // Only apply the range when at least one bound was a real date.
    if (Object.keys(dateFilter).length > 0) {
      filter.createdAt = dateFilter;
    }
  }

  return filter;
}

/**
 * Turn the item list sent by the browser into the snapshot list we store.
 * It checks that every perfume exists and takes a copy of its CURRENT name and
 * price. It does NOT touch the stock; reduceStockForSnapshots does that.
 *
 * @param {Array} rawItems - Items from the request body: [{ product, quantity }].
 * @returns {Promise<Array>} Item snapshots: [{ product, name, price, quantity }].
 */
async function buildItemSnapshots(rawItems) {
  // Step 1: Combine repeated lines. If the same perfume is listed twice we add
  // the quantities together. Without this, ordering 3 + 3 bottles of a perfume
  // that has only 4 in stock would wrongly pass the stock check.
  const quantitiesByProductId = new Map();

  for (let index = 0; index < rawItems.length; index++) {
    const rawItem = rawItems[index] || {};
    const productId = rawItem.product;
    const quantity = Number(rawItem.quantity);

    if (!productId || mongoose.Types.ObjectId.isValid(productId) === false) {
      throw createHttpError(400, 'Item ' + (index + 1) + ' does not point at a valid perfume.');
    }

    if (Number.isInteger(quantity) === false || quantity < 1) {
      throw createHttpError(400, 'Item ' + (index + 1) + ' must have a whole-number quantity of at least 1.');
    }

    const alreadyOrdered = quantitiesByProductId.get(String(productId)) || 0;
    quantitiesByProductId.set(String(productId), alreadyOrdered + quantity);
  }

  // Step 2: Load each perfume once and snapshot its name and price.
  const snapshots = [];

  for (const entry of quantitiesByProductId) {
    const productId = entry[0];
    const quantity = entry[1];

    const product = await Product.findById(productId);

    if (!product) {
      throw createHttpError(404, 'One of the selected perfumes no longer exists.');
    }

    snapshots.push({
      product: product._id,
      name: product.name,
      price: product.price,
      quantity: quantity
    });
  }

  return snapshots;
}

/**
 * Give stock back for a list of changes (used to undo a partial reduction).
 *
 * @param {Array} appliedChanges - [{ productId, quantity }] already taken.
 * @returns {Promise<void>} Resolves when every product has its stock back.
 */
async function addBackStock(appliedChanges) {
  for (let index = 0; index < appliedChanges.length; index++) {
    const change = appliedChanges[index];
    await Product.updateOne({ _id: change.productId }, { $inc: { stock: change.quantity } });
  }
}

/**
 * Take the stock for every snapshot, refusing the whole list when any perfume
 * does not have enough. Anything already taken is put back before throwing, so
 * a refused order never leaves the shelf short.
 *
 * @param {Array} snapshots - [{ product, name, price, quantity }].
 * @returns {Promise<void>} Resolves when every reduction succeeded.
 */
async function reduceStockForSnapshots(snapshots) {
  const appliedChanges = [];

  for (let index = 0; index < snapshots.length; index++) {
    const snapshot = snapshots[index];
    const product = await Product.findById(snapshot.product);

    if (!product) {
      await addBackStock(appliedChanges);
      throw createHttpError(404, 'One of the selected perfumes no longer exists.');
    }

    // The whole order is refused when a single perfume is short, and the
    // message names that perfume so the staff knows exactly what to restock.
    if (product.stock < snapshot.quantity) {
      await addBackStock(appliedChanges);
      throw createHttpError(
        400,
        'Not enough stock for "' + product.name + '". Only ' + product.stock + ' left in stock.'
      );
    }

    product.stock = product.stock - snapshot.quantity;
    await product.save();

    appliedChanges.push({ productId: snapshot.product, quantity: snapshot.quantity });
  }
}

/**
 * Give stock back for a saved list of order items (used when cancelling,
 * deleting or re-editing an order).
 *
 * @param {Array} snapshots - Order items with { product, quantity }.
 * @returns {Promise<void>} Resolves when every product has its stock back.
 */
async function restoreStockForSnapshots(snapshots) {
  for (let index = 0; index < snapshots.length; index++) {
    const snapshot = snapshots[index];
    await Product.updateOne({ _id: snapshot.product }, { $inc: { stock: snapshot.quantity } });
  }
}

/**
 * Add up the money total of an order from its item snapshots.
 *
 * @param {Array} snapshots - Items with { price, quantity }.
 * @returns {number} The order total, calculated on the server.
 */
function calculateOrderTotal(snapshots) {
  let total = 0;

  for (let index = 0; index < snapshots.length; index++) {
    const snapshot = snapshots[index];
    total = total + snapshot.price * snapshot.quantity;
  }

  return total;
}

/**
 * Load one order by id and populate the customer name and phone.
 *
 * @param {string} orderId - The id from the URL.
 * @returns {Promise<Object>} The order document.
 * @throws {Error} A 404 error when the id is malformed or the order is missing.
 */
async function findOrderOrThrow(orderId) {
  if (mongoose.Types.ObjectId.isValid(orderId) === false) {
    throw createHttpError(404, 'Order not found.');
  }

  const order = await Order.findById(orderId);

  if (!order) {
    throw createHttpError(404, 'Order not found.');
  }

  return order;
}

// GET /api/orders
// Who may call it : Logged-in staff.
// What it does    : Lists orders with optional status and date filters plus
//                   pagination. The customer name is populated for the table.
router.get('/', protect, async function (req, res, next) {
  try {
    const pagination = parsePagination(req.query);
    const filter = buildOrderFilter(req.query);

    const totalItems = await Order.countDocuments(filter);
    const items = await Order.find(filter)
      .populate('customer', 'name phone')
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

// GET /api/orders/:id
// Who may call it : Logged-in staff.
// What it does    : Returns one order with its customer for the receipt.
router.get('/:id', protect, async function (req, res, next) {
  try {
    const order = await findOrderOrThrow(req.params.id);
    await order.populate('customer', 'name phone');
    res.json(order);
  } catch (error) {
    next(error);
  }
});

// POST /api/orders
// Who may call it : Logged-in staff.
// What it does    : Creates an order. The total is computed on the server and
//                   the stock of every perfume is reduced.
router.post('/', protect, async function (req, res, next) {
  try {
    const customerId = req.body.customer;
    const rawItems = req.body.items;
    const note = req.body.note;

    // Step 1: The customer must be a real, existing customer.
    if (!customerId || mongoose.Types.ObjectId.isValid(customerId) === false) {
      throw createHttpError(400, 'Please choose a valid customer.');
    }

    const customer = await Customer.findById(customerId);

    if (!customer) {
      throw createHttpError(404, 'The selected customer no longer exists.');
    }

    // Step 2: There must be at least one item.
    if (Array.isArray(rawItems) === false || rawItems.length === 0) {
      throw createHttpError(400, 'An order must contain at least one item.');
    }

    // Step 3: Build the snapshots (this also proves every perfume exists).
    const snapshots = await buildItemSnapshots(rawItems);

    // Step 4: Take the stock. This throws - and undoes itself - when a perfume
    // is short, so the order is never saved half-done.
    await reduceStockForSnapshots(snapshots);

    // Step 5: Compute the total on the server. The browser's own total is
    // ignored on purpose, so a tampered request cannot change the price.
    const total = calculateOrderTotal(snapshots);

    // Step 6: Save the order. If saving fails we must return the stock.
    let order;

    try {
      order = await Order.create({
        customer: customer._id,
        items: snapshots,
        total: total,
        status: 'Completed',
        note: note || ''
      });
    } catch (saveError) {
      await restoreStockForSnapshots(snapshots);
      throw saveError;
    }

    await order.populate('customer', 'name phone');

    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

// PUT /api/orders/:id
// Who may call it : Logged-in staff.
// What it does    : Edits the customer, the note or the items. Swapping the
//                   items also swaps the stock, with a rollback on failure.
router.put('/:id', protect, async function (req, res, next) {
  try {
    const order = await findOrderOrThrow(req.params.id);

    // Step 1: An optional customer change.
    if (req.body.customer !== undefined) {
      if (mongoose.Types.ObjectId.isValid(req.body.customer) === false) {
        throw createHttpError(400, 'Please choose a valid customer.');
      }

      const customer = await Customer.findById(req.body.customer);

      if (!customer) {
        throw createHttpError(404, 'The selected customer no longer exists.');
      }

      order.customer = customer._id;
    }

    // Step 2: An optional note change.
    if (req.body.note !== undefined) {
      order.note = req.body.note;
    }

    // Step 3: An optional item change, which is the careful part.
    if (req.body.items !== undefined) {
      if (Array.isArray(req.body.items) === false || req.body.items.length === 0) {
        throw createHttpError(400, 'An order must contain at least one item.');
      }

      if (order.status === 'Completed') {
        // 3a: Give the OLD items their stock back first.
        await restoreStockForSnapshots(order.items);

        let newSnapshots;

        try {
          // 3b: Validate and take the NEW items.
          newSnapshots = await buildItemSnapshots(req.body.items);
          await reduceStockForSnapshots(newSnapshots);
        } catch (itemError) {
          // 3c: The new items were refused, so put the OLD stock back exactly as
          // it was. The edit changes nothing and the caller sees the error.
          await reduceStockForSnapshots(order.items);
          throw itemError;
        }

        order.items = newSnapshots;
        order.total = calculateOrderTotal(newSnapshots);
      } else {
        // A Cancelled order has already returned its stock, so we only replace
        // the saved snapshot and total without touching the shelf.
        const newSnapshots = await buildItemSnapshots(req.body.items);
        order.items = newSnapshots;
        order.total = calculateOrderTotal(newSnapshots);
      }
    }

    // Step 4: Save and answer with the fresh customer details.
    await order.save();
    await order.populate('customer', 'name phone');

    res.json(order);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/orders/:id/cancel
// Who may call it : Logged-in staff.
// What it does    : Marks the order Cancelled and gives the stock back.
router.patch('/:id/cancel', protect, async function (req, res, next) {
  try {
    const order = await findOrderOrThrow(req.params.id);

    // Step 1: Cancelling twice would give the stock back twice, so refuse it.
    if (order.status === 'Cancelled') {
      throw createHttpError(400, 'This order is already cancelled.');
    }

    // Step 2: Give the stock back, then flip the status.
    await restoreStockForSnapshots(order.items);
    order.status = 'Cancelled';

    await order.save();
    await order.populate('customer', 'name phone');

    res.json(order);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/orders/:id
// Who may call it : Logged-in staff.
// What it does    : Deletes the order. A Completed order is holding stock, so
//                   the stock is given back before the order is removed.
router.delete('/:id', protect, async function (req, res, next) {
  try {
    const order = await findOrderOrThrow(req.params.id);

    // Step 1: Only a Completed order is holding stock. A Cancelled order has
    // already returned its stock, so giving it back again would be wrong.
    if (order.status === 'Completed') {
      await restoreStockForSnapshots(order.items);
    }

    // Step 2: Remove the order from the database.
    await order.deleteOne();

    res.json({ message: 'Order deleted.', id: order._id });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
