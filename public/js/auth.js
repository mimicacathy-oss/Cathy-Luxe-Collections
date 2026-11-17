/**
 * ------------------------------------------------------------------
 * File name : public/js/auth.js
 * Purpose   : The small amount of session logic that the pages share:
 *             sending the visitor to the login page when they are not
 *             logged in, sending them to the dashboard when they already
 *             are, and logging out.
 * Connects  : Loaded AFTER api.js (it uses getToken / clearSession) and
 *             BEFORE the page scripts, which call redirectToLoginIfNotLoggedIn
 *             at the very top of their own file.
 * ------------------------------------------------------------------
 */

/**
 * Protect a private page. When there is no saved token the visitor has no
 * business being here, so they are sent to the login page immediately.
 *
 * @returns {void}
 */
function redirectToLoginIfNotLoggedIn() {
  // Step 1: No token means not logged in.
  if (!getToken()) {
    window.location.href = 'login.html';
  }
}

/**
 * Keep a logged-in visitor away from the login page: there is no point in
 * showing the form again when a valid session already exists.
 *
 * @returns {void}
 */
function redirectToDashboardIfLoggedIn() {
  if (getToken()) {
    window.location.href = 'index.html';
  }
}

/**
 * Log out: forget the token and the user, then return to the login page.
 *
 * @returns {void}
 */
function logout() {
  clearSession();
  window.location.href = 'login.html';
}
