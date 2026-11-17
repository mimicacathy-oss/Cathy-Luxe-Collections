/**
 * ------------------------------------------------------------------
 * File name : public/js/customers.js
 * Purpose   : The logic of the customers page. It loads the searchable,
 *             paginated customer list, draws the table, and handles
 *             adding, editing and deleting a customer.
 * Connects  : Uses the api helpers from js/api.js and the shared helpers
 *             from js/ui.js. It talks to GET/POST/PUT/DELETE /api/customers.
 * ------------------------------------------------------------------
 */

// Which page of the list is showing.
let currentCustomerPage = 1;

// The text typed in the search box.
let currentCustomerSearch = '';

// The customers of the current page, keyed by id, so Edit can fill the form.
let customersById = {};

// A timer used to wait a moment after the user stops typing in the search box.
let customerSearchDebounceTimer = null;

/**
 * Build the HTML for the customer table.
 *
 * @param {Array} customers - The customers of the current page.
 * @returns {string} The table markup.
 */
function buildCustomerTableHtml(customers) {
  let rows = '';

  for (let index = 0; index < customers.length; index++) {
    const customer = customers[index];

    rows +=
      '<tr>' +
        '<td>' +
          '<div class="fw-semibold">' + escapeHtml(customer.name) + '</div>' +
          '<div class="text-muted-soft small">' + escapeHtml(customer.email || '-') + '</div>' +
        '</td>' +
        '<td><i class="bi bi-telephone me-1 text-muted-soft"></i>' + escapeHtml(customer.phone) + '</td>' +
        '<td class="text-muted-soft">' + escapeHtml(customer.preferences || '-') + '</td>' +
        '<td class="text-end text-nowrap">' +
          '<button type="button" class="btn btn-sm btn-outline-plum edit-button me-1" ' +
            'data-customer-id="' + escapeHtml(customer._id) + '">' +
            '<i class="bi bi-pencil me-1"></i>Edit' +
          '</button>' +
          '<button type="button" class="btn btn-sm btn-outline-danger delete-button" ' +
            'data-customer-id="' + escapeHtml(customer._id) + '" aria-label="Delete customer">' +
            '<i class="bi bi-trash"></i>' +
          '</button>' +
        '</td>' +
      '</tr>';
  }

  return (
    '<div class="table-responsive">' +
      '<table class="table table-luxury align-middle">' +
        '<thead>' +
          '<tr>' +
            '<th>Name</th>' +
            '<th>Phone</th>' +
            '<th>Favourite scents</th>' +
            '<th class="text-end">Actions</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>'
  );
}

/**
 * Draw the customer table and wire up the Edit and Delete buttons.
 *
 * @param {Array} customers - The customers of the current page.
 * @returns {void}
 */
function renderCustomerTable(customers) {
  const container = document.getElementById('customerTableContainer');

  // Step 1: Nothing matched the search.
  if (customers.length === 0) {
    showEmptyState('customerTableContainer', {
      icon: 'bi-people',
      title: 'No customers found',
      message: 'Try a different search, or add your first customer.'
    });
    return;
  }

  // Step 2: Draw the table.
  container.innerHTML = buildCustomerTableHtml(customers);

  // Step 3: Wire up the row buttons.
  const editButtons = container.querySelectorAll('.edit-button');
  const deleteButtons = container.querySelectorAll('.delete-button');

  for (let index = 0; index < editButtons.length; index++) {
    editButtons[index].addEventListener('click', handleCustomerEditClick);
  }

  for (let index = 0; index < deleteButtons.length; index++) {
    deleteButtons[index].addEventListener('click', handleCustomerDeleteClick);
  }
}

/**
 * Work out which page numbers to show in the pagination bar.
 *
 * @param {number} currentPage - The page being shown.
 * @param {number} totalPages - How many pages exist.
 * @returns {Array<number>} The page numbers to draw.
 */
function buildCustomerPageNumbers(currentPage, totalPages) {
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
 * Draw the pagination bar under the customer table.
 *
 * @param {number} currentPage - The page being shown.
 * @param {number} totalPages - How many pages exist.
 * @returns {void}
 */
function renderCustomerPagination(currentPage, totalPages) {
  const container = document.getElementById('paginationContainer');

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const pageNumbers = buildCustomerPageNumbers(currentPage, totalPages);
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
    pageButtons[index].addEventListener('click', handleCustomerPageClick);
  }
}

/**
 * React to a pagination button click.
 *
 * @param {Event} event - The click event.
 * @returns {void}
 */
function handleCustomerPageClick(event) {
  const page = Number(event.currentTarget.getAttribute('data-page'));

  if (page < 1 || page === currentCustomerPage) {
    return;
  }

  currentCustomerPage = page;
  loadCustomers();
}

/**
 * Fetch one page of customers and draw the table and the pagination bar.
 *
 * @returns {Promise<void>} Resolves when the page has been drawn.
 */
async function loadCustomers() {
  showLoadingState('customerTableContainer', 'Loading customers...');

  const countHint = document.getElementById('customerCountHint');

  try {
    const query = buildQueryString({
      search: currentCustomerSearch,
      page: currentCustomerPage,
      limit: 10
    });

    const result = await api.get('/customers' + query);

    // Step 1: Remember the customers so the Edit button can find them.
    customersById = {};

    for (let index = 0; index < result.items.length; index++) {
      const customer = result.items[index];
      customersById[String(customer._id)] = customer;
    }

    // Step 2: Draw everything.
    renderCustomerTable(result.items);
    renderCustomerPagination(result.page, result.totalPages);

    countHint.textContent = ' (' + result.totalItems + ')';
  } catch (error) {
    showToast(error.message, 'error');
    showEmptyState('customerTableContainer', {
      icon: 'bi-wifi-off',
      title: 'Could not load the customers',
      message: error.message
    });
  }
}

/**
 * Reset the form and open the modal for adding a brand new customer.
 *
 * @returns {void}
 */
function openAddCustomerModal() {
  document.getElementById('customerModalTitle').textContent = 'Add customer';
  document.getElementById('customerForm').reset();
  document.getElementById('customerForm').classList.remove('was-validated');
  document.getElementById('customerId').value = '';

  bootstrap.Modal.getOrCreateInstance(document.getElementById('customerModal')).show();
}

/**
 * React to an Edit button click by filling the form with that customer.
 *
 * @param {Event} event - The click event from the Edit button.
 * @returns {void}
 */
function handleCustomerEditClick(event) {
  const customerId = event.currentTarget.getAttribute('data-customer-id');
  const customer = customersById[customerId];

  if (!customer) {
    return;
  }

  document.getElementById('customerModalTitle').textContent = 'Edit customer';
  document.getElementById('customerForm').classList.remove('was-validated');
  document.getElementById('customerId').value = customer._id;
  document.getElementById('customerName').value = customer.name || '';
  document.getElementById('customerPhone').value = customer.phone || '';
  document.getElementById('customerEmail').value = customer.email || '';
  document.getElementById('customerPreferences').value = customer.preferences || '';

  bootstrap.Modal.getOrCreateInstance(document.getElementById('customerModal')).show();
}

/**
 * Save the customer form. It creates a new customer or updates an existing one.
 *
 * @param {Event} event - The form submit event.
 * @returns {Promise<void>} Resolves when the save finished.
 */
async function handleCustomerFormSubmit(event) {
  event.preventDefault();

  const form = document.getElementById('customerForm');
  const saveButton = document.getElementById('customerSaveButton');

  form.classList.add('was-validated');

  if (form.checkValidity() === false) {
    return;
  }

  const customerId = document.getElementById('customerId').value;

  const payload = {
    name: document.getElementById('customerName').value.trim(),
    phone: document.getElementById('customerPhone').value.trim(),
    email: document.getElementById('customerEmail').value.trim(),
    preferences: document.getElementById('customerPreferences').value.trim()
  };

  saveButton.disabled = true;

  try {
    if (customerId) {
      await api.put('/customers/' + customerId, payload);
      showToast('Customer updated.', 'success');
    } else {
      await api.post('/customers', payload);
      showToast('Customer added.', 'success');
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById('customerModal')).hide();
    await loadCustomers();
  } catch (error) {
    // A duplicate phone number is refused by the server, and its message says so.
    showToast(error.message, 'error');
  } finally {
    saveButton.disabled = false;
  }
}

/**
 * Ask for confirmation and then delete a customer.
 *
 * @param {Event} event - The click event from the Delete button.
 * @returns {Promise<void>} Resolves when the delete attempt finished.
 */
async function handleCustomerDeleteClick(event) {
  const customerId = event.currentTarget.getAttribute('data-customer-id');
  const customer = customersById[customerId];

  if (!customer) {
    return;
  }

  const confirmed = await confirmAction({
    title: 'Delete customer',
    message: 'Delete "' + customer.name + '"? This cannot be undone.',
    confirmText: 'Delete'
  });

  if (confirmed === false) {
    return;
  }

  try {
    await api.delete('/customers/' + customerId);
    showToast('Customer deleted.', 'success');
    await loadCustomers();
  } catch (error) {
    // The server refuses when the customer still has orders.
    showToast(error.message, 'error');
  }
}

/**
 * React to typing in the search box, waiting until the user pauses.
 *
 * @returns {void}
 */
function handleCustomerSearchInput() {
  if (customerSearchDebounceTimer) {
    clearTimeout(customerSearchDebounceTimer);
  }

  customerSearchDebounceTimer = setTimeout(function () {
    currentCustomerSearch = document.getElementById('customerSearchInput').value.trim();
    currentCustomerPage = 1;
    loadCustomers();
  }, 400);
}

/**
 * Start the customers page: guard the route, draw the navbar and load data.
 *
 * @returns {void}
 */
function startCustomersPage() {
  redirectToLoginIfNotLoggedIn();
  initUi('customers');

  document.getElementById('addCustomerButton').addEventListener('click', openAddCustomerModal);
  document.getElementById('customerForm').addEventListener('submit', handleCustomerFormSubmit);
  document.getElementById('customerSearchInput').addEventListener('input', handleCustomerSearchInput);

  loadCustomers();
}

// ===== Page start up =====
startCustomersPage();
