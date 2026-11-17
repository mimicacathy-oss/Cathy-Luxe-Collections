/**
 * ------------------------------------------------------------------
 * File name : middleware/errorHandler.js
 * Purpose   : Central error handling. Instead of repeating try/catch
 *             responses in every route, routes call next(error) and this
 *             middleware turns the error into the correct JSON response
 *             with a readable message and the right HTTP status code.
 * Connects  : Mounted last in server.js, after all the routers.
 * ------------------------------------------------------------------
 */

/**
 * Build an Error that already carries the HTTP status code it should produce.
 * Route handlers use this to say "this is a 400" or "this is a 404".
 *
 * @param {number} statusCode - The HTTP status code to send to the browser.
 * @param {string} message - A readable explanation shown to the user.
 * @returns {Error} An Error object with an extra statusCode property.
 */
function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/**
 * Express error middleware. It must keep the four arguments (error, req, res,
 * next) so Express recognises it as an error handler.
 *
 * @param {Error} error - The error passed on by a route or by an earlier middleware.
 * @param {Object} req - The Express request object (unused, but required by Express).
 * @param {Object} res - The Express response object used to send the JSON message.
 * @param {Function} next - The next middleware (unused, but required by Express).
 * @returns {void} Always sends a JSON response.
 */
function errorHandler(error, req, res, next) {
  // Step 1: Mongoose validation errors (a required field missing, a bad enum
  // value, a negative price...) become a 400 with the first readable message.
  if (error.name === 'ValidationError') {
    const fieldNames = Object.keys(error.errors);
    const firstMessage = error.errors[fieldNames[0]].message;
    res.status(400).json({ message: firstMessage });
    return;
  }

  // Step 2: A malformed id such as "/api/products/not-an-id" makes Mongoose
  // throw a CastError. We answer 400 instead of letting the server crash.
  if (error.name === 'CastError') {
    res.status(400).json({ message: 'Invalid value for "' + error.path + '".' });
    return;
  }

  // Step 3: MongoDB error 11000 means a unique field was reused, for example
  // the same customer phone number twice. That is a user mistake, so 400.
  if (error.code === 11000) {
    const keyNames = Object.keys(error.keyValue || {});
    const fieldName = keyNames.length > 0 ? keyNames[0] : 'value';
    res.status(400).json({ message: 'That ' + fieldName + ' is already in use.' });
    return;
  }

  // Step 4: Errors we raised ourselves with createHttpError already know the
  // status code they want (400, 401, 404 ...).
  if (error.statusCode) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  // Step 5: Anything unexpected is a real server fault. Log it for the
  // developer and send a 500 with a friendly message that hides the details.
  console.error('Unexpected server error:', error);
  res.status(500).json({ message: 'Something went wrong on the server. Please try again.' });
}

/**
 * Handles requests to API paths that do not exist, for example a typo in the
 * URL. Returning JSON (instead of an HTML page) keeps the frontend simple.
 *
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 * @returns {void} Sends a 404 JSON response.
 */
function notFoundHandler(req, res) {
  res.status(404).json({ message: 'Route not found: ' + req.method + ' ' + req.originalUrl });
}

module.exports = {
  createHttpError: createHttpError,
  errorHandler: errorHandler,
  notFoundHandler: notFoundHandler
};
