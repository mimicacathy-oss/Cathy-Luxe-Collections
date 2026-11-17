/**
 * ------------------------------------------------------------------
 * File name : routes/dashboardRoutes.js
 * Purpose   : The one endpoint that powers the dashboard: money sold
 *             today and this month, counts of orders, perfumes and
 *             customers, the low-stock list, the five best sellers and
 *             the sales chart for the last seven days.
 *
 *             Every money figure uses COMPLETED orders only, because a
 *             cancelled order did not earn the shop anything.
 * Connects  : Uses models/Order.js, models/Product.js and models/Customer.js.
 *             Protected by middleware/authMiddleware.js. Mounted at
 *             /api/dashboard in server.js.
 * ------------------------------------------------------------------
 */

const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * Turn a Date into a short "YYYY-MM-DD" text key used by the sales chart.
 *
 * @param {Date} date - The day to format.
 * @returns {string} The date as "YYYY-MM-DD".
 */
function formatDateKey(date) {
  // Step 1: Months are zero based in JavaScript, so add one and pad it.
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

/**
 * Sum the money of the completed orders created on or after a given moment.
 *
 * @param {Date} startDate - The earliest moment to include.
 * @returns {Promise<number>} The total money for that period.
 */
async function sumCompletedSalesSince(startDate) {
  // Step 1: Group every matching order and add up the stored totals.
  const result = await Order.aggregate([
    { $match: { status: 'Completed', createdAt: { $gte: startDate } } },
    { $group: { _id: null, total: { $sum: '$total' } } }
  ]);

  // Step 2: An empty result (no orders in the period) means zero money.
  if (result.length === 0) {
    return 0;
  }

  return result[0].total;
}

// GET /api/dashboard/summary
// Who may call it : Logged-in staff.
// What it does    : Returns every number the dashboard needs in one call.
router.get('/summary', protect, async function (req, res, next) {
  try {
    // Step 1: Work out the time boundaries we need.
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const startOfSevenDayWindow = new Date(startOfToday);
    startOfSevenDayWindow.setDate(startOfSevenDayWindow.getDate() - 6);

    // Step 2: The low-stock level comes from .env so the shop can tune it
    // without touching the code.
    let lowStockLevel = parseInt(process.env.LOW_STOCK_LEVEL, 10);

    if (Number.isInteger(lowStockLevel) === false || lowStockLevel < 0) {
      lowStockLevel = 5;
    }

    // Step 3: Money figures for today and for the current month.
    const todaySales = await sumCompletedSalesSince(startOfToday);
    const monthSales = await sumCompletedSalesSince(startOfMonth);

    // Step 4: Simple counts. Orders are counted only when Completed, matching
    // the rule that cancelled orders are ignored by the dashboard.
    const totalOrders = await Order.countDocuments({ status: 'Completed' });
    const totalProducts = await Product.countDocuments({});
    const totalCustomers = await Customer.countDocuments({});

    // Step 5: Perfumes that need restocking, lowest stock first.
    const lowStock = await Product.find({ stock: { $lte: lowStockLevel } }).sort({ stock: 1 });

    // Step 6: The five best sellers by number of bottles sold.
    const bestSellers = await Order.aggregate([
      { $match: { status: 'Completed' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          quantitySold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      { $sort: { quantitySold: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, productId: '$_id', name: 1, quantitySold: 1, revenue: 1 } }
    ]);

    // Step 7: The sales chart. We fetch the completed orders of the last seven
    // days once and then bucket them per day, which avoids timezone problems
    // that a $dateToString grouping in the database could introduce.
    const recentOrders = await Order.find({
      status: 'Completed',
      createdAt: { $gte: startOfSevenDayWindow }
    }).select('total createdAt');

    const salesLast7Days = [];

    for (let offset = 0; offset < 7; offset++) {
      const dayStart = new Date(startOfSevenDayWindow);
      dayStart.setDate(startOfSevenDayWindow.getDate() + offset);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayStart.getDate() + 1);

      let dayTotal = 0;

      for (let index = 0; index < recentOrders.length; index++) {
        const order = recentOrders[index];

        if (order.createdAt >= dayStart && order.createdAt < dayEnd) {
          dayTotal = dayTotal + order.total;
        }
      }

      salesLast7Days.push({ date: formatDateKey(dayStart), total: dayTotal });
    }

    // Step 8: Answer with everything the dashboard cards and charts need.
    res.json({
      todaySales: todaySales,
      monthSales: monthSales,
      totalOrders: totalOrders,
      totalProducts: totalProducts,
      totalCustomers: totalCustomers,
      lowStockLevel: lowStockLevel,
      lowStock: lowStock,
      bestSellers: bestSellers,
      salesLast7Days: salesLast7Days
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
