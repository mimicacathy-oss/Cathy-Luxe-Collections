/**
 * ------------------------------------------------------------------
 * File name : public/js/api.js
 * Purpose   : One small wrapper around the browser's fetch() function.
 *             Every page uses it so that the JSON headers, the saved
 *             login token and the error handling live in a single place
 *             instead of being repeated on each page.
 * Connects  : Loaded BEFORE auth.js, ui.js and the page scripts in every
 *             HTML file. auth.js uses getToken/clearSession from here,
 *             and every page script calls api.get / api.post / ...
 * ------------------------------------------------------------------
 */

// The base path of the API. Because the frontend is served by the same
// Express server, a relative path works and there is no host to configure.
const API_BASE_URL = '/api';

// The names used inside localStorage to remember the logged-in session.
const TOKEN_STORAGE_KEY = 'perfume_shop_token';
const USER_STORAGE_KEY = 'perfume_shop_user';

/**
 * Read the saved login token.
 *
 * @returns {string|null} The token, or null when nobody is logged in.
 */
function getToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

/**
 * Save the login token so later requests can prove who we are.
 *
 * @param {string} token - The token returned by the login endpoint.
 * @returns {void}
 */
function saveToken(token) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

/**
 * Read the saved user details (name, email, id) for the navbar greeting.
 *
 * @returns {Object|null} The user object, or null when absent/corrupted.
 */
function getCurrentUser() {
  let rawUser = localStorage.getItem(USER_STORAGE_KEY);

  if (!rawUser) {
    return null;
  }

  // A corrupted entry should simply mean "not logged in", never a crash.
  try {
    return JSON.parse(rawUser);
  } catch (error) {
    return null;
  }
}

/**
 * Save the user details so the navbar can greet the staff member by name.
 *
 * @param {Object} user - The user object returned by the login endpoint.
 * @returns {void}
 */
function saveCurrentUser(user) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

/**
 * Forget the session. Used by the Logout button and whenever the server
 * answers 401 (the token expired or was rejected).
 *
 * @returns {void}
 */
function clearSession() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

/**
 * Send one request to the API and return the parsed JSON body.
 *
 * @param {string} path - The API path, for example "/products?page=2".
 * @param {Object} [options] - Optional settings: { method, body }.
 * @returns {Promise<Object|null>} The JSON response, or null for an empty body.
 * @throws {Error} When the network fails or the server answers with an error.
 */
async function apiRequest(path, options) {
  let settings = options || {};
  let method = settings.method || 'GET';

  // Step 1: Attach the token when we have one. Public endpoints simply receive
  // no Authorization header and still work.
  let headers = {};
  let token = getToken();

  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  // Step 2: If the body is FormData, do NOT set Content-Type (the browser sets
  // it automatically with the correct boundary). Otherwise, use JSON.
  let body = settings.body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  // Step 3: Perform the request. A network failure (server stopped, no Wi-Fi)
  // throws here, so we convert it into a friendly message.
  let response;

  try {
    response = await fetch(API_BASE_URL + path, {
      method: method,
      headers: headers,
      body: body
    });
  } catch (networkError) {
    throw new Error('Cannot reach the server. Please check that it is running.');
  }

  // Step 4: A 401 means the session is gone. Clear it and go back to the login
  // page, which is the only place where a new token can be obtained.
  if (response.status === 401) {
    clearSession();
    window.location.href = 'login.html';
    throw new Error('Your session has expired. Please log in again.');
  }

  // Step 5: Read the body as text first, because a 204 or an empty body would
  // make response.json() throw.
  let responseText = await response.text();
  let data = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      data = null;
    }
  }

  // Step 6: Turn an error status into a thrown Error carrying the readable
  // message the server sent inside { message: "..." }.
  if (response.ok === false) {
    let message = 'Something went wrong. Please try again.';

    if (data && data.message) {
      message = data.message;
    }

    throw new Error(message);
  }

  return data;
}

// The short helpers each page uses. They keep the page scripts readable.
const api = {
  get: function (path) {
    return apiRequest(path, { method: 'GET' });
  },
  post: function (path, body) {
    return apiRequest(path, { method: 'POST', body: body });
  },
  put: function (path, body) {
    return apiRequest(path, { method: 'PUT', body: body });
  },
  patch: function (path, body) {
    return apiRequest(path, { method: 'PATCH', body: body });
  },
  delete: function (path) {
    return apiRequest(path, { method: 'DELETE' });
  }
};

/**
 * Build a query string from an object of filters, skipping empty values.
 *
 * @param {Object} parameters - For example { search: 'oud', page: 1 }.
 * @returns {string} For example "?search=oud&page=1" or "" when empty.
 */
function buildQueryString(parameters) {
  let parts = [];

  for (let key in parameters) {
    if (Object.prototype.hasOwnProperty.call(parameters, key)) {
      let value = parameters[key];

      // Empty filters must not appear in the URL, otherwise the server would
      // receive "search=" and filter on an empty string.
      if (value !== undefined && value !== null && String(value) !== '') {
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
      }
    }
  }

  if (parts.length === 0) {
    return '';
  }

  return '?' + parts.join('&');
}
