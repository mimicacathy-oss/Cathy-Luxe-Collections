/**
 * ------------------------------------------------------------------
 * File name : public/js/catalogue.js
 * Purpose   : The logic of the public catalogue. It loads the perfumes that
 *             are in stock, draws them as read-only cards and lets a visitor
 *             send a WhatsApp message about one. No login is needed here.
 * Connects  : Uses api.get and buildQueryString from js/api.js plus the
 *             shared helpers from js/ui.js. Its only endpoint is the public
 *             GET /api/products/public.
 * ------------------------------------------------------------------
 */

// Which page of the catalogue is showing.
let currentCataloguePage = 1;

// The search text and category chosen by the visitor.
let catalogueSearch = '';
let catalogueCategory = '';

// The perfumes of the current page, kept so the buttons can find one.
let catalogueProductsById = {};

// A timer used to wait a moment after the visitor stops typing.
let catalogueSearchDebounceTimer = null;

/**
 * Build the message that gets sent to WhatsApp for one perfume.
 *
 * @param {Object} product - A product document.
 * @returns {string} The plain text message.
 */
function buildOrderMessage(product) {
  let message = 'Hello! I would like to order this perfume:\n\n';
  message = message + product.name + ' by ' + product.brand + '\n';

  if (product.size) {
    message = message + 'Size: ' + product.size + '\n';
  }

  message = message + 'Price: ' + formatMoney(product.price) + '\n';

  if (product.notes) {
    message = message + 'Notes: ' + product.notes + '\n';
  }

  message = message + '\nPlease let me know if it is available.';

  return message;
}

/**
 * Build the HTML for one catalogue card.
 *
 * @param {Object} product - A product document from the public endpoint.
 * @returns {string} The card markup.
 */
function buildCatalogueCardHtml(product) {
  const sizeText = product.size ? ' &middot; ' + escapeHtml(product.size) : '';

  // Step 1: An empty or missing picture uses the on-brand placeholder.
  let imageUrl = product.imageUrl;

  if (!imageUrl) {
    imageUrl = PLACEHOLDER_IMAGE;
  }

  return (
    '<div class="col-12 col-sm-6 col-lg-4 col-xl-3">' +
      '<div class="product-card fade-in-up">' +
        '<div class="product-image-wrapper">' +
          '<span class="product-category-tag">' + escapeHtml(product.category) + '</span>' +
          '<img src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(product.name) + '" loading="lazy" />' +
        '</div>' +
        '<div class="product-body">' +
          '<div class="product-name">' + escapeHtml(product.name) + '</div>' +
          '<div class="product-brand">' + escapeHtml(product.brand) + sizeText + '</div>' +
          '<div class="d-flex justify-content-between align-items-center mb-2">' +
            '<span class="product-price">' + escapeHtml(formatMoney(product.price)) + '</span>' +
            '<span class="badge-stock badge-stock--in"><i class="bi bi-check-circle me-1"></i>Available</span>' +
          '</div>' +
          '<p class="product-notes mb-0">' + escapeHtml(product.notes || '') + '</p>' +
          '<div class="product-actions">' +
            '<button type="button" class="btn btn-sm btn-success w-100 rounded-pill whatsapp-button" ' +
              'data-product-id="' + escapeHtml(product._id) + '">' +
              '<i class="bi bi-whatsapp me-1"></i>Order on WhatsApp' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

/**
 * Draw the catalogue cards and wire up the WhatsApp buttons.
 *
 * @param {Array} products - The perfumes of the current page.
 * @returns {void}
 */
function renderCatalogueGrid(products) {
  const grid = document.getElementById('catalogueGrid');

  // Step 1: Nothing matched the filters.
  if (products.length === 0) {
    grid.innerHTML =
      '<div class="col-12">' +
        '<div class="empty-state">' +
          '<i class="bi bi-search"></i>' +
          '<h5 class="mb-1">No results found</h5>' +
          '<p class="mb-0">Try a different search or category.</p>' +
        '</div>' +
      '</div>';
    return;
  }

  // Step 2: Build every card, then place them all at once.
  let cardsHtml = '';

  for (let index = 0; index < products.length; index++) {
    cardsHtml += buildCatalogueCardHtml(products[index]);
  }

  grid.innerHTML = cardsHtml;

  // Step 3: Protect every picture with the fallback image.
  const images = grid.querySelectorAll('img');

  for (let index = 0; index < images.length; index++) {
    attachImageFallback(images[index]);
  }

  // Step 4: Wire up the WhatsApp buttons.
  const whatsappButtons = grid.querySelectorAll('.whatsapp-button');

  for (let index = 0; index < whatsappButtons.length; index++) {
    whatsappButtons[index].addEventListener('click', handleCatalogueWhatsAppClick);
  }
}

/**
 * Work out which page numbers to show in the pagination bar.
 *
 * @param {number} currentPage - The page being shown.
 * @param {number} totalPages - How many pages exist.
 * @returns {Array<number>} The page numbers to draw.
 */
function buildCataloguePageNumbers(currentPage, totalPages) {
  const numbers = [];

  if (totalPages <= 7) {
    for (let page = 1; page <= totalPages; page++) {
      numbers.push(page);
    }
    return numbers;
  }

  let start = currentPage - 2;
  let end = currentPage + 2;

  if (start < 1) {
    start = 1;
    end = 5;
  }

  if (end > totalPages) {
    end = totalPages;
    start = totalPages - 4;
  }

  for (let page = start; page <= end; page++) {
    numbers.push(page);
  }

  return numbers;
}

/**
 * Draw the pagination bar under the catalogue.
 *
 * @param {number} currentPage - The page being shown.
 * @param {number} totalPages - How many pages exist.
 * @returns {void}
 */
function renderCataloguePagination(currentPage, totalPages) {
  const container = document.getElementById('paginationContainer');

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const pageNumbers = buildCataloguePageNumbers(currentPage, totalPages);
  let itemsHtml = '';

  itemsHtml +=
    '<li class="page-item' + (currentPage <= 1 ? ' disabled' : '') + '">' +
      '<button class="page-link page-number-button" data-page="' + (currentPage - 1) + '">Previous</button>' +
    '</li>';

  for (let index = 0; index < pageNumbers.length; index++) {
    const page = pageNumbers[index];

    itemsHtml +=
      '<li class="page-item' + (page === currentPage ? ' active' : '') + '">' +
        '<button class="page-link page-number-button" data-page="' + page + '">' + page + '</button>' +
      '</li>';
  }

  itemsHtml +=
    '<li class="page-item' + (currentPage >= totalPages ? ' disabled' : '') + '">' +
      '<button class="page-link page-number-button" data-page="' + (currentPage + 1) + '">Next</button>' +
    '</li>';

  container.innerHTML = '<ul class="pagination justify-content-center">' + itemsHtml + '</ul>';

  const pageButtons = container.querySelectorAll('.page-number-button');

  for (let index = 0; index < pageButtons.length; index++) {
    pageButtons[index].addEventListener('click', handleCataloguePageClick);
  }
}

/**
 * React to a pagination button click.
 *
 * @param {Event} event - The click event.
 * @returns {void}
 */
function handleCataloguePageClick(event) {
  const page = Number(event.currentTarget.getAttribute('data-page'));

  if (page < 1 || page === currentCataloguePage) {
    return;
  }

  currentCataloguePage = page;
  loadCatalogueProducts();
}

/**
 * Fetch one page of the public catalogue and draw it.
 *
 * @returns {Promise<void>} Resolves when the page has been drawn.
 */
async function loadCatalogueProducts() {
  const grid = document.getElementById('catalogueGrid');
  const countLabel = document.getElementById('catalogueCount');

  grid.innerHTML =
    '<div class="col-12">' +
      '<div class="loading-state">' +
        '<div class="spinner-border text-warning" role="status" aria-hidden="true"></div>' +
        '<p class="mt-3 mb-0">Loading our perfumes...</p>' +
      '</div>' +
    '</div>';

  try {
    const query = buildQueryString({
      search: catalogueSearch,
      category: catalogueCategory,
      page: currentCataloguePage,
      limit: 8
    });

    const result = await api.get('/products/public' + query);

    catalogueProductsById = {};

    for (let index = 0; index < result.items.length; index++) {
      const product = result.items[index];
      catalogueProductsById[String(product._id)] = product;
    }

    renderCatalogueGrid(result.items);
    renderCataloguePagination(result.page, result.totalPages);

    countLabel.textContent = result.totalItems + ' perfume(s) available.';
  } catch (error) {
    showToast(error.message, 'error');
    grid.innerHTML =
      '<div class="col-12">' +
        '<div class="empty-state">' +
          '<i class="bi bi-wifi-off"></i>' +
          '<h5 class="mb-1">Could not load the catalogue</h5>' +
          '<p class="mb-0">' + escapeHtml(error.message) + '</p>' +
        '</div>' +
      '</div>';
    countLabel.textContent = '';
  }
}

/**
 * React to a WhatsApp button click by opening WhatsApp with a message.
 *
 * @param {Event} event - The click event.
 * @returns {void}
 */
function handleCatalogueWhatsAppClick(event) {
  const product = catalogueProductsById[event.currentTarget.getAttribute('data-product-id')];

  if (!product) {
    return;
  }

  const message = buildOrderMessage(product);
  const url = 'https://wa.me/?text=' + encodeURIComponent(message);

  window.open(url, '_blank');
}

/**
 * React to typing in the search box, waiting until the visitor pauses.
 *
 * @returns {void}
 */
function handleCatalogueSearchInput() {
  if (catalogueSearchDebounceTimer) {
    clearTimeout(catalogueSearchDebounceTimer);
  }

  catalogueSearchDebounceTimer = setTimeout(function () {
    catalogueSearch = document.getElementById('catalogueSearchInput').value.trim();
    currentCataloguePage = 1;
    loadCatalogueProducts();
  }, 400);
}

/**
 * React to a change in the category filter.
 *
 * @returns {void}
 */
function handleCatalogueCategoryChange() {
  catalogueCategory = document.getElementById('catalogueCategorySelect').value;
  currentCataloguePage = 1;
  loadCatalogueProducts();
}

/**
 * Clear the search and category filters.
 *
 * @returns {void}
 */
function handleCatalogueClearFilters() {
  document.getElementById('catalogueSearchInput').value = '';
  document.getElementById('catalogueCategorySelect').value = '';

  catalogueSearch = '';
  catalogueCategory = '';
  currentCataloguePage = 1;

  loadCatalogueProducts();
}

/**
 * Start the public catalogue. There is no login check here on purpose.
 *
 * @returns {void}
 */
function startCataloguePage() {
  document.getElementById('catalogueSearchInput').addEventListener('input', handleCatalogueSearchInput);
  document.getElementById('catalogueCategorySelect').addEventListener('change', handleCatalogueCategoryChange);
  document.getElementById('catalogueClearButton').addEventListener('click', handleCatalogueClearFilters);

  loadCatalogueProducts();
}

// ===== Page start up =====
startCataloguePage();
