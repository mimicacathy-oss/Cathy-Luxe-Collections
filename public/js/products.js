/**
 * ------------------------------------------------------------------
 * File name : public/js/products.js
 * Purpose   : The logic of the perfumes page. It loads the searchable,
 *             filterable, paginated list of perfumes, draws each one as
 *             a card, and handles adding, editing and deleting.
 * Connects  : Uses the api helpers from js/api.js and the shared helpers
 *             from js/ui.js. It talks to GET/POST/PUT/DELETE /api/products.
 * ------------------------------------------------------------------
 */

// Which page of the list is showing. Changing a filter resets it to 1.
let currentProductPage = 1;

// The filters chosen in the filter bar.
let currentProductFilters = {
  search: '',
  category: '',
  minPrice: '',
  maxPrice: ''
};

// The perfumes of the current page, keyed by id, so the Edit button can fill
// the form without another request.
let productsById = {};

// A timer used to wait a moment after the user stops typing in the search box.
let searchDebounceTimer = null;

/**
 * Read the filter bar and copy the chosen values into currentProductFilters.
 *
 * @returns {void}
 */
function readProductFiltersFromInputs() {
  currentProductFilters.search = document.getElementById('searchInput').value.trim();
  currentProductFilters.category = document.getElementById('categorySelect').value;
  currentProductFilters.minPrice = document.getElementById('minPriceInput').value;
  currentProductFilters.maxPrice = document.getElementById('maxPriceInput').value;
}

/**
 * Build the HTML for a single perfume card.
 *
 * @param {Object} product - A product document from the API.
 * @returns {string} The card markup.
 */
function buildProductCardHtml(product) {
  const stockInfo = getStockInfo(product.stock);
  const sizeText = product.size ? ' &middot; ' + escapeHtml(product.size) : '';

  // Step 1: Choose the picture. An empty link uses the placeholder straight
  // away; a real link is protected by attachImageFallback after it is drawn.
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
            '<span class="' + stockInfo.className + '">' + escapeHtml(stockInfo.label) + '</span>' +
          '</div>' +
          '<p class="product-notes mb-0">' + escapeHtml(product.notes || '') + '</p>' +
          '<div class="product-actions">' +
            '<button type="button" class="btn btn-sm btn-outline-plum flex-fill edit-button" ' +
              'data-product-id="' + escapeHtml(product._id) + '">' +
              '<i class="bi bi-pencil me-1"></i>Edit' +
            '</button>' +
            '<button type="button" class="btn btn-sm btn-outline-danger delete-button" ' +
              'data-product-id="' + escapeHtml(product._id) + '" aria-label="Delete perfume">' +
              '<i class="bi bi-trash"></i>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

/**
 * Draw the list of cards and wire up the Edit and Delete buttons.
 *
 * @param {Array} products - The perfumes of the current page.
 * @returns {void}
 */
function renderProductGrid(products) {
  const grid = document.getElementById('productGrid');

  // Step 1: Nothing matched the filters.
  if (products.length === 0) {
    grid.innerHTML =
      '<div class="col-12">' +
        '<div class="empty-state">' +
          '<i class="bi bi-search"></i>' +
          '<h5 class="mb-1">No results found</h5>' +
          '<p class="mb-0">Try a different search or filter.</p>' +
        '</div>' +
      '</div>';
    return;
  }

  // Step 2: Build every card, then place them all in the grid at once.
  let cardsHtml = '';

  for (let index = 0; index < products.length; index++) {
    cardsHtml += buildProductCardHtml(products[index]);
  }

  grid.innerHTML = cardsHtml;

  // Step 3: A broken or empty image link must never show the browser's
  // broken-image icon, so every picture gets the fallback listener.
  const images = grid.querySelectorAll('img');

  for (let index = 0; index < images.length; index++) {
    attachImageFallback(images[index]);
  }

  // Step 4: Wire up the card buttons.
  const editButtons = grid.querySelectorAll('.edit-button');
  const deleteButtons = grid.querySelectorAll('.delete-button');

  for (let index = 0; index < editButtons.length; index++) {
    editButtons[index].addEventListener('click', handleEditClick);
  }

  for (let index = 0; index < deleteButtons.length; index++) {
    deleteButtons[index].addEventListener('click', handleDeleteClick);
  }
}

/**
 * Work out which page numbers to show in the pagination bar.
 *
 * @param {number} currentPage - The page being shown.
 * @param {number} totalPages - How many pages exist.
 * @returns {Array<number>} The page numbers to draw.
 */
function buildPageNumbers(currentPage, totalPages) {
  const numbers = [];

  // Step 1: With few pages we simply show them all.
  if (totalPages <= 7) {
    for (let page = 1; page <= totalPages; page++) {
      numbers.push(page);
    }
    return numbers;
  }

  // Step 2: With many pages we show a window around the current page.
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
 * Draw the pagination bar under the card grid.
 *
 * @param {number} currentPage - The page being shown.
 * @param {number} totalPages - How many pages exist.
 * @returns {void}
 */
function renderPagination(currentPage, totalPages) {
  const container = document.getElementById('paginationContainer');

  // Step 1: A single page needs no pagination bar at all.
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const pageNumbers = buildPageNumbers(currentPage, totalPages);
  let itemsHtml = '';

  // Step 2: The "Previous" button.
  const previousDisabled = currentPage <= 1 ? ' disabled' : '';
  itemsHtml +=
    '<li class="page-item' + previousDisabled + '">' +
      '<button class="page-link page-number-button" data-page="' + (currentPage - 1) + '">Previous</button>' +
    '</li>';

  // Step 3: The numbered buttons.
  for (let index = 0; index < pageNumbers.length; index++) {
    const page = pageNumbers[index];
    const activeClass = page === currentPage ? ' active' : '';

    itemsHtml +=
      '<li class="page-item' + activeClass + '">' +
        '<button class="page-link page-number-button" data-page="' + page + '">' + page + '</button>' +
      '</li>';
  }

  // Step 4: The "Next" button.
  const nextDisabled = currentPage >= totalPages ? ' disabled' : '';
  itemsHtml +=
    '<li class="page-item' + nextDisabled + '">' +
      '<button class="page-link page-number-button" data-page="' + (currentPage + 1) + '">Next</button>' +
    '</li>';

  container.innerHTML = '<ul class="pagination justify-content-center">' + itemsHtml + '</ul>';

  // Step 5: Every page button simply asks for that page.
  const pageButtons = container.querySelectorAll('.page-number-button');

  for (let index = 0; index < pageButtons.length; index++) {
    pageButtons[index].addEventListener('click', handlePageButtonClick);
  }
}

/**
 * React to a pagination button click.
 *
 * @param {Event} event - The click event.
 * @returns {void}
 */
function handlePageButtonClick(event) {
  const page = Number(event.currentTarget.getAttribute('data-page'));

  if (page < 1 || page === currentProductPage) {
    return;
  }

  currentProductPage = page;
  loadProducts();
}

/**
 * Fetch one page of perfumes and draw the grid and the pagination bar.
 *
 * @returns {Promise<void>} Resolves when the page has been drawn.
 */
async function loadProducts() {
  const grid = document.getElementById('productGrid');
  const countLabel = document.getElementById('productCount');

  grid.innerHTML =
    '<div class="col-12">' +
      '<div class="loading-state">' +
        '<div class="spinner-border text-warning" role="status" aria-hidden="true"></div>' +
        '<p class="mt-3 mb-0">Loading perfumes...</p>' +
      '</div>' +
    '</div>';

  try {
    // Step 1: Send the filters and the page number to the server.
    const query = buildQueryString({
      search: currentProductFilters.search,
      category: currentProductFilters.category,
      minPrice: currentProductFilters.minPrice,
      maxPrice: currentProductFilters.maxPrice,
      page: currentProductPage,
      limit: 8
    });

    const result = await api.get('/products' + query);

    // Step 2: Remember the perfumes so the Edit button can find them.
    productsById = {};

    for (let index = 0; index < result.items.length; index++) {
      const product = result.items[index];
      productsById[String(product._id)] = product;
    }

    // Step 3: Draw everything.
    renderProductGrid(result.items);
    renderPagination(result.page, result.totalPages);

    countLabel.textContent = result.totalItems + ' perfume(s) found.';
  } catch (error) {
    showToast(error.message, 'error');
    grid.innerHTML = '';
    countLabel.textContent = '';
    showEmptyState('productGrid', {
      icon: 'bi-wifi-off',
      title: 'Could not load the perfumes',
      message: error.message
    });
  }
}

/**
 * Reset the form and open the modal for adding a brand new perfume.
 *
 * @returns {void}
 */
function openAddProductModal() {
  document.getElementById('productModalTitle').textContent = 'Add perfume';
  document.getElementById('productForm').reset();
  document.getElementById('productForm').classList.remove('was-validated');
  document.getElementById('productId').value = '';
  document.getElementById('productCategory').value = 'Unisex';

  bootstrap.Modal.getOrCreateInstance(document.getElementById('productModal')).show();
}

/**
 * React to an Edit button click by filling the form with that perfume.
 *
 * @param {Event} event - The click event from the Edit button.
 * @returns {void}
 */
function handleEditClick(event) {
  const productId = event.currentTarget.getAttribute('data-product-id');
  const product = productsById[productId];

  if (!product) {
    return;
  }

  document.getElementById('productModalTitle').textContent = 'Edit perfume';
  document.getElementById('productForm').classList.remove('was-validated');
  document.getElementById('productId').value = product._id;
  document.getElementById('productName').value = product.name || '';
  document.getElementById('productBrand').value = product.brand || '';
  document.getElementById('productCategory').value = product.category || 'Unisex';
  document.getElementById('productSize').value = product.size || '';
  document.getElementById('productPrice').value = product.price;
  document.getElementById('productStock').value = product.stock;
  document.getElementById('productImageUrl').value = product.imageUrl || '';
  document.getElementById('productNotes').value = product.notes || '';

  bootstrap.Modal.getOrCreateInstance(document.getElementById('productModal')).show();
}

/**
 * Save the perfume form. It creates a new perfume or updates an existing one.
 *
 * @param {Event} event - The form submit event.
 * @returns {Promise<void>} Resolves when the save finished.
 */
async function handleProductFormSubmit(event) {
  event.preventDefault();

  const form = document.getElementById('productForm');
  const saveButton = document.getElementById('productSaveButton');

  form.classList.add('was-validated');

  if (form.checkValidity() === false) {
    return;
  }

  const productId = document.getElementById('productId').value;
  const imageFile = document.getElementById('productImage').files[0];

  saveButton.disabled = true;

  try {
    if (imageFile) {
      // Step 1: Use FormData when an image file is selected.
      const formData = new FormData();
      formData.append('name', document.getElementById('productName').value.trim());
      formData.append('brand', document.getElementById('productBrand').value.trim());
      formData.append('category', document.getElementById('productCategory').value);
      formData.append('size', document.getElementById('productSize').value.trim());
      formData.append('price', Number(document.getElementById('productPrice').value));
      formData.append('stock', Number(document.getElementById('productStock').value));
      formData.append('notes', document.getElementById('productNotes').value.trim());
      formData.append('image', imageFile);

      if (productId) {
        await api.put('/products/' + productId, formData);
        showToast('Perfume updated.', 'success');
      } else {
        await api.post('/products', formData);
        showToast('Perfume added.', 'success');
      }
    } else {
      // Step 2: Use JSON when no image file is selected.
      const payload = {
        name: document.getElementById('productName').value.trim(),
        brand: document.getElementById('productBrand').value.trim(),
        category: document.getElementById('productCategory').value,
        size: document.getElementById('productSize').value.trim(),
        price: Number(document.getElementById('productPrice').value),
        stock: Number(document.getElementById('productStock').value),
        imageUrl: document.getElementById('productImageUrl').value.trim(),
        notes: document.getElementById('productNotes').value.trim()
      };

      if (productId) {
        await api.put('/products/' + productId, payload);
        showToast('Perfume updated.', 'success');
      } else {
        await api.post('/products', payload);
        showToast('Perfume added.', 'success');
      }
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById('productModal')).hide();
    await loadProducts();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    saveButton.disabled = false;
  }
}

/**
 * Ask for confirmation and then delete a perfume.
 *
 * @param {Event} event - The click event from the Delete button.
 * @returns {Promise<void>} Resolves when the delete attempt finished.
 */
async function handleDeleteClick(event) {
  const productId = event.currentTarget.getAttribute('data-product-id');
  const product = productsById[productId];

  if (!product) {
    return;
  }

  const confirmed = await confirmAction({
    title: 'Delete perfume',
    message: 'Delete "' + product.name + '"? This cannot be undone.',
    confirmText: 'Delete'
  });

  if (confirmed === false) {
    return;
  }

  try {
    await api.delete('/products/' + productId);
    showToast('Perfume deleted.', 'success');
    await loadProducts();
  } catch (error) {
    // The server refuses the delete when the perfume is used by an order, and
    // its message explains exactly why.
    showToast(error.message, 'error');
  }
}

/**
 * React to typing in the search box, waiting until the user pauses.
 *
 * @returns {void}
 */
function handleSearchInput() {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }

  searchDebounceTimer = setTimeout(function () {
    readProductFiltersFromInputs();
    currentProductPage = 1;
    loadProducts();
  }, 400);
}

/**
 * React to a change in the category or price filters.
 *
 * @returns {void}
 */
function handleFilterChange() {
  readProductFiltersFromInputs();
  currentProductPage = 1;
  loadProducts();
}

/**
 * Clear every filter and reload the whole list.
 *
 * @returns {void}
 */
function handleClearFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('categorySelect').value = '';
  document.getElementById('minPriceInput').value = '';
  document.getElementById('maxPriceInput').value = '';

  readProductFiltersFromInputs();
  currentProductPage = 1;
  loadProducts();
}

/**
 * Start the perfumes page: guard the route, draw the navbar and load data.
 *
 * @returns {void}
 */
function startProductsPage() {
  redirectToLoginIfNotLoggedIn();
  initUi('products');

  document.getElementById('addProductButton').addEventListener('click', openAddProductModal);
  document.getElementById('productForm').addEventListener('submit', handleProductFormSubmit);
  document.getElementById('searchInput').addEventListener('input', handleSearchInput);
  document.getElementById('categorySelect').addEventListener('change', handleFilterChange);
  document.getElementById('minPriceInput').addEventListener('change', handleFilterChange);
  document.getElementById('maxPriceInput').addEventListener('change', handleFilterChange);
  document.getElementById('clearFiltersButton').addEventListener('click', handleClearFilters);

  loadProducts();
}

// ===== Page start up =====
startProductsPage();
