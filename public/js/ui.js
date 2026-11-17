/**
 * ------------------------------------------------------------------
 * File name : public/js/ui.js
 * Purpose   : The shared "look and feel" helpers used by every page:
 *             a reusable navbar, toast messages, a reusable confirmation
 *             modal, loading and empty states, the money and date
 *             formatters, and the escapeHtml function that protects the
 *             pages from cross-site scripting.
 * Connects  : Loaded AFTER api.js and auth.js (it uses getCurrentUser and
 *             logout), and BEFORE the page scripts, which call initUi()
 *             and the helper functions from here.
 * ------------------------------------------------------------------
 */

// Products at or below this stock level are shown with the orange badge.
const LOW_STOCK_BADGE_LEVEL = 5;

// A soft, on-brand image shown whenever a perfume has no picture or when the
// picture link is broken. It is a tiny inline SVG, so it never needs a request.
const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
      '<rect width="400" height="300" fill="#efe6d7"/>' +
      '<g fill="#c9a24d" opacity="0.85">' +
      '<rect x="178" y="70" width="44" height="38" rx="8"/>' +
      '<rect x="168" y="108" width="64" height="112" rx="18"/>' +
      '<rect x="186" y="58" width="28" height="16" rx="6"/>' +
      '</g>' +
      '<text x="200" y="252" font-family="Poppins, sans-serif" font-size="16" fill="#7b7285" text-anchor="middle">No image available</text>' +
      '</svg>'
  );

/**
 * Make a piece of text safe to place inside HTML. Any character that could
 * start a tag or an attribute is replaced by its entity, so a product named
 * "<script>" can never run code in the browser.
 *
 * @param {*} value - Any value; null and undefined become an empty string.
 * @returns {string} The escaped text.
 */
function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format a number as Ugandan Shillings with thousands separators.
 *
 * @param {number} amount - The money value, for example 150000.
 * @returns {string} For example "UGX 150,000".
 */
function formatMoney(amount) {
  let number = Number(amount);

  // A missing or non-numeric value must not print "UGX NaN".
  if (isNaN(number)) {
    number = 0;
  }

  // Step 1: Round to whole shillings; the shop does not use cents.
  number = Math.round(number);

  // Step 2: toLocaleString adds the comma separators, for example 150,000.
  return 'UGX ' + number.toLocaleString('en-US');
}

/**
 * Format a date value as a short, readable day.
 *
 * @param {string|Date} value - The date to format.
 * @returns {string} For example "27 Oct 2026".
 */
function formatDate(value) {
  let date = new Date(value);

  if (isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Format a date value together with the time of day.
 *
 * @param {string|Date} value - The date to format.
 * @returns {string} For example "27 Oct 2026, 14:05".
 */
function formatDateTime(value) {
  let date = new Date(value);

  if (isNaN(date.getTime())) {
    return '-';
  }

  let day = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  let time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return day + ', ' + time;
}

/**
 * Work out which stock badge a perfume should show.
 *
 * @param {number} stock - The number of bottles on the shelf.
 * @param {number} [lowLevel] - The level at or below which stock counts as low.
 * @returns {{label: string, className: string}} Text and CSS class for the badge.
 */
function getStockInfo(stock, lowLevel) {
  let level = Number(lowLevel);

  if (isNaN(level)) {
    level = LOW_STOCK_BADGE_LEVEL;
  }

  let quantity = Number(stock);

  if (quantity <= 0) {
    return { label: 'Out of stock', className: 'badge-stock badge-stock--out' };
  }

  if (quantity <= level) {
    return { label: 'Low stock: ' + quantity, className: 'badge-stock badge-stock--low' };
  }

  return { label: 'In stock: ' + quantity, className: 'badge-stock badge-stock--in' };
}

/**
 * Show a toast message in the corner of the screen.
 *
 * @param {string} message - The text to show.
 * @param {string} [type] - One of "success", "error", "warning" or "info".
 * @returns {void}
 */
function showToast(message, type) {
  let toastType = type || 'info';

  // Step 1: Map our type onto a Bootstrap background class.
  let backgroundClass = 'text-bg-secondary';
  let iconClass = 'bi-info-circle';

  if (toastType === 'success') {
    backgroundClass = 'text-bg-success';
    iconClass = 'bi-check-circle';
  } else if (toastType === 'error') {
    backgroundClass = 'text-bg-danger';
    iconClass = 'bi-exclamation-triangle';
  } else if (toastType === 'warning') {
    backgroundClass = 'text-bg-warning';
    iconClass = 'bi-exclamation-circle';
  }

  // Step 2: Make sure the container exists, even if initUi has not run yet.
  let container = document.getElementById('toastContainer');

  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container position-fixed top-0 end-0 p-3 app-toast-container';
    document.body.appendChild(container);
  }

  // Step 3: Build the toast element. The message is escaped because it may
  // contain text typed by a user (for example a perfume name).
  let toastElement = document.createElement('div');
  toastElement.className = 'toast app-toast ' + backgroundClass;
  toastElement.setAttribute('role', 'alert');
  toastElement.setAttribute('aria-live', 'assertive');
  toastElement.setAttribute('aria-atomic', 'true');
  toastElement.innerHTML =
    '<div class="d-flex">' +
      '<div class="toast-body d-flex align-items-center gap-2">' +
        '<i class="bi ' + iconClass + '"></i>' +
        '<span>' + escapeHtml(message) + '</span>' +
      '</div>' +
      '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>' +
    '</div>';

  container.appendChild(toastElement);

  // Step 4: Ask Bootstrap to animate it in, and remove it from the page once
  // it has been hidden so the DOM does not grow forever.
  let toastInstance = new bootstrap.Toast(toastElement, { delay: 4000 });
  toastElement.addEventListener('hidden.bs.toast', function () {
    toastElement.remove();
  });
  toastInstance.show();
}

/**
 * Draw the spinning loader inside a container while data is being fetched.
 *
 * @param {string} containerId - The id of the element to fill.
 * @param {string} [message] - Optional text under the spinner.
 * @returns {void}
 */
function showLoadingState(containerId, message) {
  let container = document.getElementById(containerId);

  if (!container) {
    return;
  }

  container.innerHTML =
    '<div class="loading-state">' +
      '<div class="spinner-border text-warning" role="status" aria-hidden="true"></div>' +
      '<p class="mt-3 mb-0">' + escapeHtml(message || 'Loading...') + '</p>' +
    '</div>';
}

/**
 * Draw a friendly "nothing here" message inside a container.
 *
 * @param {string} containerId - The id of the element to fill.
 * @param {Object} [options] - { icon, title, message } to customise the text.
 * @returns {void}
 */
function showEmptyState(containerId, options) {
  let container = document.getElementById(containerId);
  let settings = options || {};

  if (!container) {
    return;
  }

  let iconClass = settings.icon || 'bi-search';
  let title = settings.title || 'No results found';
  let message = settings.message || 'Try a different search or filter.';

  container.innerHTML =
    '<div class="empty-state">' +
      '<i class="bi ' + iconClass + '"></i>' +
      '<h5 class="mb-1">' + escapeHtml(title) + '</h5>' +
      '<p class="mb-0">' + escapeHtml(message) + '</p>' +
    '</div>';
}

/**
 * Ask the user to confirm a dangerous action (every delete uses this).
 *
 * @param {Object} options - { title, message, confirmText, confirmClass }.
 * @returns {Promise<boolean>} Resolves true when the user confirmed.
 */
function confirmAction(options) {
  let settings = options || {};

  return new Promise(function (resolve) {
    let modalElement = document.getElementById('confirmModal');

    // If the modal is missing for any reason we must not silently delete, so
    // we fall back to the browser's own confirm box.
    if (!modalElement) {
      resolve(window.confirm(settings.message || 'Are you sure?'));
      return;
    }

    let titleElement = document.getElementById('confirmModalTitle');
    let messageElement = document.getElementById('confirmModalMessage');
    let buttonElement = document.getElementById('confirmModalButton');

    titleElement.textContent = settings.title || 'Please confirm';
    messageElement.textContent = settings.message || 'Are you sure?';
    buttonElement.textContent = settings.confirmText || 'Delete';
    buttonElement.className = 'btn ' + (settings.confirmClass || 'btn-danger');

    let modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
    let answered = false;

    // Step 1: When the user clicks the confirm button we resolve true and hide
    // the modal. The listener is removed afterwards so it only ever runs once.
    function onConfirm() {
      answered = true;
      buttonElement.removeEventListener('click', onConfirm);
      modalElement.removeEventListener('hidden.bs.modal', onHidden);
      modalInstance.hide();
      resolve(true);
    }

    // Step 2: Closing the modal any other way (Cancel, X, Escape, backdrop)
    // means "no". We use the hidden event so every route is covered.
    function onHidden() {
      if (answered) {
        return;
      }
      buttonElement.removeEventListener('click', onConfirm);
      modalElement.removeEventListener('hidden.bs.modal', onHidden);
      resolve(false);
    }

    buttonElement.addEventListener('click', onConfirm);
    modalElement.addEventListener('hidden.bs.modal', onHidden);

    modalInstance.show();
  });
}

/**
 * Build the shared navbar. The link of the current page is highlighted.
 *
 * @param {string} activePage - One of "dashboard", "products", "customers", "orders".
 * @returns {string} The navbar HTML.
 */
function buildNavbarHtml(activePage) {
  let user = getCurrentUser();
  let userName = user && user.name ? user.name : 'Staff';

  // Step 1: Describe the menu once, then render it in a loop. The key also
  // tells us which link must carry the "active" class.
  let links = [
    { key: 'dashboard', label: 'Dashboard', href: 'index.html', icon: 'bi-speedometer2' },
    { key: 'products', label: 'Perfumes', href: 'products.html', icon: 'bi-droplet-half' },
    { key: 'customers', label: 'Customers', href: 'customers.html', icon: 'bi-people' },
    { key: 'orders', label: 'Orders', href: 'orders.html', icon: 'bi-receipt' }
  ];

  let navLinks = '';

  for (let index = 0; index < links.length; index++) {
    let link = links[index];
    let activeClass = link.key === activePage ? ' active' : '';

    navLinks +=
      '<li class="nav-item">' +
        '<a class="nav-link' + activeClass + '" href="' + link.href + '">' +
          '<i class="bi ' + link.icon + ' me-1"></i>' + link.label +
        '</a>' +
      '</li>';
  }

  return (
    '<nav class="navbar navbar-expand-lg app-navbar sticky-top">' +
      '<div class="container">' +
        '<a class="navbar-brand" href="index.html">' +
          '<span class="brand-mark"><i class="bi bi-flower1"></i></span>' +
          '<span>' +
            '<span class="brand-name d-block">Cathy Luxe Collections</span>' +
            '<span class="brand-tagline">Manager</span>' +
          '</span>' +
        '</a>' +
        '<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNavbar" ' +
          'aria-controls="mainNavbar" aria-expanded="false" aria-label="Toggle navigation">' +
          '<span class="navbar-toggler-icon"></span>' +
        '</button>' +
        '<div class="collapse navbar-collapse" id="mainNavbar">' +
          '<ul class="navbar-nav ms-auto align-items-lg-center">' +
            navLinks +
            '<li class="nav-item ms-lg-3 mt-2 mt-lg-0">' +
              '<span class="user-chip d-block mb-1 mb-lg-0">' +
                '<i class="bi bi-person-circle me-1"></i>' + escapeHtml(userName) +
              '</span>' +
            '</li>' +
            '<li class="nav-item">' +
              '<button type="button" class="btn btn-sm btn-gold rounded-pill px-3" id="logoutButton">' +
                '<i class="bi bi-box-arrow-right me-1"></i>Logout' +
              '</button>' +
            '</li>' +
          '</ul>' +
        '</div>' +
      '</div>' +
    '</nav>'
  );
}

/**
 * Inject the shared building blocks that every private page needs: the navbar,
 * the toast container and the reusable confirmation modal.
 *
 * @param {string} activePage - Which navbar link should look selected.
 * @returns {void}
 */
function initUi(activePage) {
  // Step 1: The navbar.
  let navbarHost = document.getElementById('appNavbar');

  if (navbarHost) {
    navbarHost.innerHTML = buildNavbarHtml(activePage);
  }

  // Step 2: The toast container.
  if (!document.getElementById('toastContainer')) {
    let toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3 app-toast-container';
    document.body.appendChild(toastContainer);
  }

  // Step 3: The one confirmation modal that every delete reuses.
  if (!document.getElementById('confirmModal')) {
    let modalHost = document.createElement('div');
    modalHost.innerHTML =
      '<div class="modal fade" id="confirmModal" tabindex="-1" aria-labelledby="confirmModalTitle" aria-hidden="true">' +
        '<div class="modal-dialog modal-dialog-centered">' +
          '<div class="modal-content">' +
            '<div class="modal-header">' +
              '<h5 class="modal-title" id="confirmModalTitle">Please confirm</h5>' +
              '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>' +
            '</div>' +
            '<div class="modal-body" id="confirmModalMessage">Are you sure?</div>' +
            '<div class="modal-footer">' +
              '<button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>' +
              '<button type="button" class="btn btn-danger" id="confirmModalButton">Delete</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modalHost.firstChild);
  }

  // Step 4: Wire up the Logout button, which appears in the navbar we just drew.
  let logoutButton = document.getElementById('logoutButton');

  if (logoutButton) {
    logoutButton.addEventListener('click', function () {
      logout();
    });
  }
}

/**
 * Attach a fallback picture to an <img> so a broken link never shows the
 * browser's broken-image icon. The error listener removes itself so the
 * placeholder cannot loop forever.
 *
 * @param {HTMLImageElement} imageElement - The image to protect.
 * @returns {void}
 */
function attachImageFallback(imageElement) {
  imageElement.addEventListener('error', function () {
    imageElement.src = PLACEHOLDER_IMAGE;
  });
}
