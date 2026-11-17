/**
 * ------------------------------------------------------------------
 * File name : config/db.js
 * Purpose   : The single place that opens the MongoDB connection used
 *             by the whole application.
 * Connects  : This file is required once by server.js. Every Mongoose
 *             model inside models/ automatically uses the connection
 *             that is created here.
 * ------------------------------------------------------------------
 */

const mongoose = require('mongoose');

/**
 * Open the connection to MongoDB.
 *
 * @param {string} mongoUri - The connection string read from the MONGO_URI
 *   environment variable, for example "mongodb://127.0.0.1:27017/perfume_shop".
 * @returns {Promise<void>} Resolves once the connection is open, and rejects
 *   when the database cannot be reached so the caller can stop the server.
 */
async function connectToDatabase(mongoUri) {
  // Step 1: Stop immediately when the operator forgot to create a .env file.
  // Without a URI there is nothing to connect to, and a clear error is better
  // than a confusing "undefined is not a valid host" message later.
  if (!mongoUri) {
    throw new Error('MONGO_URI is not set. Copy .env.example to .env and fill it in.');
  }

  // Step 2: Turn on strict query filtering so unknown query fields are ignored
  // instead of silently returning an empty result set.
  mongoose.set('strictQuery', true);

  // Step 3: Wait for the connection before the server starts listening.
  // Using await means any failure is reported to the caller as a rejection.
  await mongoose.connect(mongoUri);

  // Step 4: Print the database name so the operator can confirm that the app
  // connected to the expected database and not to some other one.
  console.log('MongoDB connected to database: ' + mongoose.connection.name);
}

module.exports = {
  connectToDatabase: connectToDatabase
};
