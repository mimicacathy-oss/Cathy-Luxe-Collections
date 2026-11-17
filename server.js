/**
 * ------------------------------------------------------------------
 * File name : server.js
 * Purpose   : The application entry point. It loads the environment
 *             variables, connects to MongoDB, mounts every API router,
 *             serves the frontend files out of public/, and finally
 *             starts listening on the port from .env.
 * Connects  : Requires config/db.js (database), every file in routes/
 *             (the API), and middleware/errorHandler.js (error replies).
 *             The browser files in public/ call these routes with fetch().
 *
 * Run it with : npm start   (or npm run dev for automatic restarts)
 * ------------------------------------------------------------------
 */

// Step 1: Read the .env file into process.env before anything else uses it,
// because the database URI, the port and the token secret all live there.
require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const { connectToDatabase } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const customerRoutes = require('./routes/customerRoutes');
const orderRoutes = require('./routes/orderRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Step 2: Global middleware.
// express.json() lets every route read req.body as JSON, which the whole API
// depends on. cors() allows the page to be opened from another origin during
// development without the browser blocking the requests.
app.use(express.json());
app.use(cors());

// Step 3: Serve the frontend. express.static maps the public/ folder to the
// site root, so /login.html, /products.html, /css/style.css and /js/api.js are
// all delivered by this same server. A request for "/" is answered with
// public/index.html automatically.
app.use(express.static(path.join(__dirname, 'public')));

// Step 4: Mount the API routers. Each router owns one area of the shop.
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Step 5: Any other /api path is a typo, so answer with JSON 404 instead of an
// HTML page that the frontend would fail to parse.
app.use('/api', notFoundHandler);

// Step 6: The central error handler must be registered LAST so that it catches
// the errors passed on by every router above it.
app.use(errorHandler);

/**
 * Connect to the database and only then start listening for requests. Starting
 * in this order means a request can never arrive before the database is ready.
 *
 * @returns {Promise<void>} Resolves once the server is listening.
 */
async function startServer() {
  try {
    await connectToDatabase(process.env.MONGO_URI);

    app.listen(PORT, function () {
      console.log('Cathy Luxe Collections is running at http://localhost:' + PORT);
    });
  } catch (error) {
    // A failed database connection means the app is useless, so report the
    // reason clearly and stop instead of running in a broken state.
    console.error('Could not start the server:', error.message);
    process.exit(1);
  }
}

startServer();
