/**
 * ------------------------------------------------------------------
 * File name : public/js/orders.js
 * Purpose   : The logic of the orders page. It lists the sales, creates a
 *             new order with several product lines and a live running total,
 *             shows and prints a receipt, shares it on WhatsApp, and edits,
 *             cancels or deletes an order. The server owns the stock logic;
 *             this file only asks for it.
 * Connects  : Uses the api helpers from js/api.js and the shared helpers from
 *             js/ui.js. It calls /api/orders, and /api/customers and
 *             /api/products to fill the drop-downs.
 * ------------------------------------------------------------------
 */

// Which page of the list is showing.
let currentOrderPage = 1;

// The filters chosen in the filter bar.
let currentOrderFilters = {
  status: '',
  from: '',
  to: ''
};

// The orders of the current page, keyed by id, so the row buttons can find one.
let ordersById = {};

// The customers and perfumes used by the order form's drop-downs.
let customersList = [];
let productsList = [];
let productsById = {};

// A counter that gives every product line a unique id.
let orderLineCounter = 0;

// The order currently shown in the receipt modal, used by Print and Share.
let activeReceiptOrder = null;

/**
 * Count how many bottles an order contains in total.
 *
 * @param {Object} order - An order document.
 * @returns {number} The sum of every line's quantity.
 */
function countOrderItems(order) {
  let totalQuantity = 0;

  for (let index = 0; index < order.items.length; index++) {
    totalQuantity = totalQuantity + order.items[index].quantity;
  }

  return totalQuantity;
}

/**
 * Build the status badge of an order.
 *
 * @param {string} status - "Completed" or "Cancelled".
 * @returns {string} The badge markup.
 */
function buildStatusBadgeHtml(status) {
  if (status === 'Completed') {
    return '<span class="badge-status--completed"><i class="bi bi-check-circle me-1"></i>Completed</span>';
  }

  return '<span class="badge-status--cancelled"><i class="bi bi-x-circle me-1"></i>Cancelled</span>';
}

/**
 * Build the HTML for the orders table.
 *
 * @param {Array} orders - The orders of the current page.
 * @returns {string} The table markup.
 */
function buildOrderTableHtml(orders) {
  let rows = '';

  for (let index = 0; index < orders.length; index++) {
    const order = orders[index];
    const customerName = order.customer ? order.customer.name : 'Unknown customer';
    const customerPhone = order.customer ? order.customer.phone : '';

    // Step 1: A cancelled order can no longer be cancelled, so that button is
    // not drawn for it.
    let cancelButton = '';

    if (order.status === 'Completed') {
      cancelButton =
        '<button type="button" class="btn btn-sm btn-outline-warning cancel-button" ' +
          'data-order-id="' + escapeHtml(order._id) + '" aria-label="Cancel order">' +
          '<i class="bi bi-slash-circle"></i>' +
        '</button>';
    }

    rows +=
      '<tr>' +
        '<td class="text-nowrap">' + escapeHtml(formatDate(order.createdAt)) + '</td>' +
        '<td>' +
          '<div class="fw-semibold">' + escapeHtml(customerName) + '</div>' +
          '<div class="text-muted-soft small">' + escapeHtml(customerPhone) + '</div>' +
        '</td>' +
        '<td>' + countOrderItems(order) + ' item(s)</td>' +
        '<td class="fw-semibold">' + escapeHtml(formatMoney(order.total)) + '</td>' +
        '<td>' + buildStatusBadgeHtml(order.status) + '</td>' +
        '<td class="text-end text-nowrap">' +
          '<button type="button" class="btn btn-sm btn-outline-plum receipt-button me-1" ' +
            'data-order-id="' + escapeHtml(order._id) + '" aria-label="View receipt">' +
            '<i class="bi bi-receipt-cutoff"></i>' +
          '</button>' +
          '<button type="button" class="btn btn-sm btn-outline-plum edit-button me-1" ' +
            'data-order-id="' + escapeHtml(order._id) + '" aria-label="Edit order">' +
            '<i class="bi bi-pencil"></i>' +
          '</button>' +
          cancelButton +
          ' <button type="button" class="btn btn-sm btn-outline-danger delete-button" ' +
            'data-order-id="' + escapeHtml(order._id) + '" aria-label="Delete order">' +
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
            '<th>Date</th>' +
            '<th>Customer</th>' +
            '<th>Items</th>' +
            '<th>Total</th>' +
            '<th>Status</th>' +
            '<th class="text-end">Actions</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>'
  );
}

/**
 * Draw the orders table and wire up all the row buttons.
 *
 * @param {Array} orders - The orders of the current page.
 * @returns {void}
 */
function renderOrderTable(orders) {
  const container = document.getElementById('ordersTableContainer');

  // Step 1: No orders matched the filters.
  if (orders.length === 0) {
    showEmptyState('ordersTableContainer', {
      icon: 'bi-receipt',
      title: 'No orders found',
      message: 'Try different filters, or record your first sale.'
    });
    return;
  }

  // Step 2: Draw the table.
  container.innerHTML = buildOrderTableHtml(orders);

  // Step 3: Wire up every button in the rows.
  const receiptButtons = container.querySelectorAll('.receipt-button');
  const editButtons = container.querySelectorAll('.edit-button');
  const cancelButtons = container.querySelectorAll('.cancel-button');
  const deleteButtons = container.querySelectorAll('.delete-button');

  for (let index = 0; index < receiptButtons.length; index++) {
    receiptButtons[index].addEventListener('click', handleReceiptClick);
  }

  for (let index = 0; index < editButtons.length; index++) {
    editButtons[index].addEventListener('click', handleOrderEditClick);
  }

  for (let index = 0; index < cancelButtons.length; index++) {
    cancelButtons[index].addEventListener('click', handleOrderCancelClick);
  }

  for (let index = 0; index < deleteButtons.length; index++) {
    deleteButtons[index].addEventListener('click', handleOrderDeleteClick);
  }
}

/**
 * Work out which page numbers to show in the pagination bar.
 *
 * @param {number} currentPage - The page being shown.
 * @param {number} totalPages - How many pages exist.
 * @returns {Array<number>} The page numbers to draw.
 */
function buildOrderPageNumbers(currentPage, totalPages) {
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
 * Draw the pagination bar under the orders table.
 *
 * @param {number} currentPage - The page being shown.
 * @param {number} totalPages - How many pages exist.
 * @returns {void}
 */
function renderOrderPagination(currentPage, totalPages) {
  const container = document.getElementById('paginationContainer');

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const pageNumbers = buildOrderPageNumbers(currentPage, totalPages);
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
    pageButtons[index].addEventListener('click', handleOrderPageClick);
  }
}

/**
 * React to a pagination button click.
 *
 * @param {Event} event - The click event.
 * @returns {void}
 */
function handleOrderPageClick(event) {
  const page = Number(event.currentTarget.getAttribute('data-page'));

  if (page < 1 || page === currentOrderPage) {
    return;
  }

  currentOrderPage = page;
  loadOrders();
}

/**
 * Fetch one page of orders and draw the table and the pagination bar.
 *
 * @returns {Promise<void>} Resolves when the page has been drawn.
 */
async function loadOrders() {
  showLoadingState('ordersTableContainer', 'Loading orders...');

  const countHint = document.getElementById('orderCountHint');

  try {
    const query = buildQueryString({
      status: currentOrderFilters.status,
      from: currentOrderFilters.from,
      to: currentOrderFilters.to,
      page: currentOrderPage,
      limit: 10
    });

    const result = await api.get('/orders' + query);

    // Step 1: Remember the orders so the row buttons can find them.
    ordersById = {};

    for (let index = 0; index < result.items.length; index++) {
      const order = result.items[index];
      ordersById[String(order._id)] = order;
    }

    // Step 2: Draw everything.
    renderOrderTable(result.items);
    renderOrderPagination(result.page, result.totalPages);

    countHint.textContent = ' (' + result.totalItems + ')';
  } catch (error) {
    showToast(error.message, 'error');
    showEmptyState('ordersTableContainer', {
      icon: 'bi-wifi-off',
      title: 'Could not load the orders',
      message: error.message
    });
  }
}

/**
 * Load the customers and the perfumes that the order form needs, so the
 * drop-downs always show the latest stock levels.
 *
 * @returns {Promise<void>} Resolves when both lists are ready.
 */
async function loadOrderFormReferences() {
  const customersResult = await api.get('/customers' + buildQueryString({ limit: 100 }));
  const productsResult = await api.get('/products' + buildQueryString({ limit: 100 }));

  customersList = customersResult.items;
  productsList = productsResult.items;

  productsById = {};

  for (let index = 0; index < productsList.length; index++) {
    const product = productsList[index];
    productsById[String(product._id)] = product;
  }
}

/**
 * Build the <option> list for the customer drop-down.
 *
 * @returns {string} The option markup.
 */
function buildCustomerOptionsHtml() {
  let optionsHtml = '<option value="">Choose a customer...</option>';

  for (let index = 0; index < customersList.length; index++) {
    const customer = customersList[index];

    optionsHtml +=
      '<option value="' + escapeHtml(customer._id) + '">' +
        escapeHtml(customer.name + ' - ' + customer.phone) +
      '</option>';
  }

  return optionsHtml;
}

/**
 * Build the <option> list for a product drop-down, showing the stock so the
 * user can see what is available.
 *
 * @returns {string} The option markup.
 */
function buildProductOptionsHtml() {
  let optionsHtml = '<option value="">Choose a perfume...</option>';

  for (let index = 0; index < productsList.length; index++) {
    const product = productsList[index];
    const label = product.name + ' (' + product.brand + ') - ' +
      product.stock + ' in stock - ' + formatMoney(product.price);

    optionsHtml +=
      '<option value="' + escapeHtml(product._id) + '">' + escapeHtml(label) + '</option>';
  }

  return optionsHtml;
}

/**
 * Add one product line to the order form.
 *
 * @param {string} [productId] - A perfume to preselect (used when editing).
 * @param {number} [quantity] - The quantity to preselect.
 * @returns {void}
 */
function addOrderLine(productId, quantity) {
  orderLineCounter = orderLineCounter + 1;

  const container = document.getElementById('orderItemsContainer');
  const lineElement = document.createElement('div');

  lineElement.className = 'order-line row g-2 align-items-center mb-2';
  lineElement.setAttribute('data-line-id', 'line-' + orderLineCounter);
  lineElement.innerHTML =
    '<div class="col-7">' +
      '<select class="form-select form-select-sm order-line-product">' + buildProductOptionsHtml() + '</select>' +
    '</div>' +
    '<div class="col-3">' +
      '<input type="number" class="form-control form-control-sm order-line-quantity" min="1" step="1" value="1" />' +
    '</div>' +
    '<div class="col-2 text-end">' +
      '<button type="button" class="btn btn-sm btn-outline-danger order-line-remove" aria-label="Remove item">' +
        '<i class="bi bi-x-lg"></i>' +
      '</button>' +
    '</div>';

  container.appendChild(lineElement);

  const select = lineElement.querySelector('.order-line-product');
  const quantityInput = lineElement.querySelector('.order-line-quantity');

  // Step 1: Reselect a perfume when editing. If that perfume was deleted after
  // an older cancelled order, it is not in the list, so we add it by hand
  // using the name saved in the order snapshot.
  if (productId) {
    let optionExists = false;

    for (let index = 0; index < select.options.length; index++) {
      if (select.options[index].value === String(productId)) {
        optionExists = true;
      }
    }

    if (optionExists === false) {
      const extraOption = document.createElement('option');
      extraOption.value = String(productId);
      extraOption.textContent = '(no longer available)';
      select.appendChild(extraOption);
    }

    select.value = String(productId);
  }

  if (quantity) {
    quantityInput.value = quantity;
  }

  recalculateOrderTotal();
}

/**
 * Remove a product line, but never the last one, because an order must keep
 * at least one item.
 *
 * @param {HTMLElement} lineElement - The line to remove.
 * @returns {void}
 */
function removeOrderLine(lineElement) {
  const container = document.getElementById('orderItemsContainer');

  if (container.querySelectorAll('.order-line').length <= 1) {
    showToast('An order must keep at least one item.', 'warning');
    return;
  }

  lineElement.remove();
  recalculateOrderTotal();
}

/**
 * Add up the money of the lines currently in the form and show it.
 *
 * @returns {void}
 */
function recalculateOrderTotal() {
  const container = document.getElementById('orderItemsContainer');
  const lines = container.querySelectorAll('.order-line');
  let total = 0;

  for (let index = 0; index < lines.length; index++) {
    const select = lines[index].querySelector('.order-line-product');
    const quantityInput = lines[index].querySelector('.order-line-quantity');
    const product = productsById[select.value];
    const quantity = Number(quantityInput.value);

    // Step 1: Only complete lines with a real quantity count towards the total.
    if (product && Number.isInteger(quantity) && quantity > 0) {
      total = total + product.price * quantity;
    }
  }

  document.getElementById('orderTotalDisplay').textContent = formatMoney(total);
}

/**
 * React to any change inside the item list (choosing a perfume or typing a
 * quantity).
 *
 * @param {Event} event - The change or input event.
 * @returns {void}
 */
function handleOrderItemsChange(event) {
  recalculateOrderTotal();
}

/**
 * React to a click inside the item list (the remove button).
 *
 * @param {Event} event - The click event.
 * @returns {void}
 */
function handleOrderItemsClick(event) {
  const removeButton = event.target.closest('.order-line-remove');

  if (!removeButton) {
    return;
  }

  const lineElement = removeButton.closest('.order-line');

  if (lineElement) {
    removeOrderLine(lineElement);
  }
}

/**
 * Read the form and turn it into the items array the API expects.
 *
 * @returns {Array} That items, for example [{ product, quantity }].
 */
function readOrderItemsFromForm() {
  const container = document.getElementById('orderItemsContainer');
  const lines = container.querySelectorAll('.order-line');
  const items = [];

  for (let index = 0; index < lines.length; index++) {
    const select = lines[index].querySelector('.order-line-product');
    const quantityInput = lines[index].querySelector('.order-line-quantity');

    if (select.value) {
      items.push({
        product: select.value,
        quantity: Number(quantityInput.value)
      });
    }
  }

  return items;
}

/**
 * Open the modal to record a brand new sale.
 *
 * @returns {Promise<void>} Resolves when the modal is ready.
 */
async function openNewOrderModal() {
  const modalTitle = document.getElementById('orderModalTitle');
  const customerSelect = document.getElementById('orderCustomer');
  const form = document.getElementById('orderForm');

  try {
    // Step 1: Fresh customers and perfumes, so stock is up to date.
    await loadOrderFormReferences();
  } catch (error) {
    showToast(error.message, 'error');
    return;
  }

  // Step 2: Reset the form and the item list.
  modalTitle.textContent = 'New order';
  form.reset();
  form.classList.remove('was-validated');
  document.getElementById('orderId').value = '';
  document.getElementById('orderNote').value = '';
  customerSelect.innerHTML = buildCustomerOptionsHtml();
  document.getElementById('orderItemsContainer').innerHTML = '';

  addOrderLine();

  bootstrap.Modal.getOrCreateInstance(document.getElementById('orderModal')).show();
}

/**
 * Open the modal to edit an existing order.
 *
 * @param {Object} order - The order to edit.
 * @returns {Promise<void>} Resolves when the modal is ready.
 */
async function openEditOrderModal(order) {
  const modalTitle = document.getElementById('orderModalTitle');
  const customerSelect = document.getElementById('orderCustomer');
  const form = document.getElementById('orderForm');

  try {
    await loadOrderFormReferences();
  } catch (error) {
    showToast(error.message, 'error');
    return;
  }

  // Step 1: Fill the customer, the note and the id.
  modalTitle.textContent = 'Edit order';
  form.classList.remove('was-validated');
  document.getElementById('orderId').value = order._id;
  customerSelect.innerHTML = buildCustomerOptionsHtml();

  // The customer id may come back as an object (populated), so read it safely.
  const customerId = order.customer ? order.customer._id : '';
  customerSelect.value = String(customerId);

  document.getElementById('orderNote').value = order.note || '';

  // Step 2: Draw one line per item, using the saved quantities.
  document.getElementById('orderItemsContainer').innerHTML = '';

  for (let index = 0; index < order.items.length; index++) {
    const item = order.items[index];
    addOrderLine(item.product, item.quantity);
  }

  recalculateOrderTotal();

  bootstrap.Modal.getOrCreateInstance(document.getElementById('orderModal')).show();
}

/**
 * Save the order form, creating a new order or updating an existing one.
 *
 * @param {Event} event - The form submit event.
 * @returns {Promise<void>} Resolves when the save finished.
 */
async function handleOrderFormSubmit(event) {
  event.preventDefault();

  const form = document.getElementById('orderForm');
  const saveButton = document.getElementById('orderSaveButton');
  const customerSelect = document.getElementById('orderCustomer');

  form.classList.add('was-validated');

  if (form.checkValidity() === false) {
    return;
  }

  const items = readOrderItemsFromForm();

  // Step 1: A ring of empty lines would reach the server as an empty order, so
  // we stop it here with a clear message.
  if (items.length === 0) {
    showToast('Please choose at least one perfume for this order.', 'warning');
    return;
  }

  for (let index = 0; index < items.length; index++) {
    if (Number.isInteger(items[index].quantity) === false || items[index].quantity < 1) {
      showToast('Every item needs a whole-number quantity of at least 1.', 'warning');
      return;
    }
  }

  const orderId = document.getElementById('orderId').value;

  const payload = {
    customer: customerSelect.value,
    items: items,
    note: document.getElementById('orderNote').value.trim()
  };

  saveButton.disabled = true;

  try {
    if (orderId) {
      await api.put('/orders/' + orderId, payload);
      showToast('Order updated.', 'success');
    } else {
      await api.post('/orders', payload);
      showToast('Order saved and stock updated.', 'success');
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById('orderModal')).hide();
    await loadOrders();
  } catch (error) {
    // The server refuses an order that is larger than the stock, naming the
    // perfume that is short.
    showToast(error.message, 'error');
  } finally {
    saveButton.disabled = false;
  }
}

/**
 * React to an Edit button click.
 *
 * @param {Event} event - The click event.
 * @returns {void}
 */
function handleOrderEditClick(event) {
  const order = ordersById[event.currentTarget.getAttribute('data-order-id')];

  if (order) {
    openEditOrderModal(order);
  }
}

/**
 * React to a Cancel button click: confirm, then ask the server to cancel.
 *
 * @param {Event} event - The click event.
 * @returns {Promise<void>} Resolves when the cancel attempt finished.
 */
async function handleOrderCancelClick(event) {
  const order = ordersById[event.currentTarget.getAttribute('data-order-id')];

  if (!order) {
    return;
  }

  const confirmed = await confirmAction({
    title: 'Cancel order',
    message: 'Cancel this order? The stock will be returned to the shelf.',
    confirmText: 'Cancel order',
    confirmClass: 'btn-warning'
  });

  if (confirmed === false) {
    return;
  }

  try {
    await api.patch('/orders/' + order._id + '/cancel', {});
    showToast('Order cancelled and stock returned.', 'success');
    await loadOrders();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

/**
 * React to a Delete button click: confirm, then delete the order.
 *
 * @param {Event} event - The click event.
 * @returns {Promise<void>} Resolves when the delete attempt finished.
 */
async function handleOrderDeleteClick(event) {
  const order = ordersById[event.currentTarget.getAttribute('data-order-id')];

  if (!order) {
    return;
  }

  const confirmed = await confirmAction({
    title: 'Delete order',
    message: 'Delete this order permanently? Completed orders return their stock first.',
    confirmText: 'Delete'
  });

  if (confirmed === false) {
    return;
  }

  try {
    await api.delete('/orders/' + order._id);
    showToast('Order deleted.', 'success');
    await loadOrders();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

/**
 * Build the customer-facing receipt for an order.
 *
 * @param {Object} order - The order document.
 * @returns {string} The receipt markup.
 */
function buildReceiptHtml(order) {
  const customerName = order.customer ? order.customer.name : 'Unknown customer';
  const customerPhone = order.customer ? order.customer.phone : '';
  const shortId = String(order._id).slice(-6).toUpperCase();

  let itemRows = '';

  for (let index = 0; index < order.items.length; index++) {
    const item = order.items[index];

    itemRows +=
      '<tr>' +
        '<td>' + escapeHtml(item.name) + '</td>' +
        '<td>' + item.quantity + '</td>' +
        '<td>' + escapeHtml(formatMoney(item.price)) + '</td>' +
        '<td>' + escapeHtml(formatMoney(item.price * item.quantity)) + '</td>' +
      '</tr>';
  }

  return (
    '<div class="receipt-sheet">' +
      '<div class="receipt-header">' +
        '<div class="receipt-title">Cathy Luxe Collections</div>' +
        '<div>Receipt #' + escapeHtml(shortId) + '</div>' +
      '</div>' +
      '<div class="d-flex justify-content-between"><span>Date</span><span>' +
        escapeHtml(formatDateTime(order.createdAt)) + '</span></div>' +
      '<div class="d-flex justify-content-between"><span>Customer</span><span>' +
        escapeHtml(customerName) + '</span></div>' +
      '<div class="d-flex justify-content-between mb-2"><span>Phone</span><span>' +
        escapeHtml(customerPhone) + '</span></div>' +
      '<table>' +
        '<thead>' +
          '<tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr>' +
        '</thead>' +
        '<tbody>' + itemRows + '</tbody>' +
        '<tfoot>' +
          '<tr class="receipt-total-row">' +
            '<td colspan="3">Total</td>' +
            '<td>' + escapeHtml(formatMoney(order.total)) + '</td>' +
          '</tr>' +
        '</tfoot>' +
      '</table>' +
      '<div class="mt-2">Status: ' + escapeHtml(order.status) + '</div>' +
      '<div class="text-center mt-3">Thank you for shopping with us!</div>' +
    '</div>'
  );
}

/**
 * Build a short text summary of an order for WhatsApp.
 *
 * @param {Object} order - The order document.
 * @returns {string} The plain text message.
 */
function buildOrderSummaryText(order) {
  const customerName = order.customer ? order.customer.name : 'Customer';

  let text = 'Cathy Luxe Collections - Sales receipt\n';
  text = text + 'Date: ' + formatDateTime(order.createdAt) + '\n';
  text = text + 'Customer: ' + customerName + '\n\n';

  for (let index = 0; index < order.items.length; index++) {
    const item = order.items[index];
    text = text + item.quantity + ' x ' + item.name + ' = ' +
      formatMoney(item.price * item.quantity) + '\n';
  }

  text = text + '\nTotal: ' + formatMoney(order.total) + '\n';
  text = text + 'Status: ' + order.status + '\n';
  text = text + 'Thank you for your purchase!';

  return text;
}

/**
 * React to a View receipt button click by showing the receipt in a modal.
 *
 * @param {Event} event - The click event.
 * @returns {void}
 */
function handleReceiptClick(event) {
  const order = ordersById[event.currentTarget.getAttribute('data-order-id')];

  if (!order) {
    return;
  }

  // Step 1: Remember the order so Print and Share can use it.
  activeReceiptOrder = order;

  document.getElementById('receiptModalBody').innerHTML = buildReceiptHtml(order);

  bootstrap.Modal.getOrCreateInstance(document.getElementById('receiptModal')).show();
}

/**
 * Open WhatsApp with a prefilled message about the order.
 *
 * @returns {void}
 */
function shareActiveOrderOnWhatsApp() {
  if (!activeReceiptOrder) {
    return;
  }

  const message = buildOrderSummaryText(activeReceiptOrder);
  const url = 'https://wa.me/?text=' + encodeURIComponent(message);

  window.open(url, '_blank');
}

/**
 * Print the receipt: copy it into the print-only area and let the browser
 * print just that area.
 *
 * @returns {void}
 */
function printActiveOrder() {
  if (!activeReceiptOrder) {
    return;
  }

  document.getElementById('printArea').innerHTML = buildReceiptHtml(activeReceiptOrder);

  window.print();
}

/**
 * React to a change in the status or date filters.
 *
 * @returns {void}
 */
function handleOrderFilterChange() {
  currentOrderFilters.status = document.getElementById('statusFilter').value;
  currentOrderFilters.from = document.getElementById('fromDateFilter').value;
  currentOrderFilters.to = document.getElementById('toDateFilter').value;

  currentOrderPage = 1;
  loadOrders();
}

/**
 * Clear the filters and reload the whole list.
 *
 * @returns {void}
 */
function handleClearOrderFilters() {
  document.getElementById('statusFilter').value = '';
  document.getElementById('fromDateFilter').value = '';
  document.getElementById('toDateFilter').value = '';

  handleOrderFilterChange();
}

/**
 * Start the orders page: guard the route, draw the navbar and load data.
 *
 * @returns {void}
 */
function startOrdersPage() {
  redirectToLoginIfNotLoggedIn();
  initUi('orders');

  document.getElementById('newOrderButton').addEventListener('click', openNewOrderModal);
  document.getElementById('orderForm').addEventListener('submit', handleOrderFormSubmit);
  document.getElementById('addOrderLineButton').addEventListener('click', function () {
    addOrderLine();
  });
  document.getElementById('orderItemsContainer').addEventListener('change', handleOrderItemsChange);
  document.getElementById('orderItemsContainer').addEventListener('input', handleOrderItemsChange);
  document.getElementById('orderItemsContainer').addEventListener('click', handleOrderItemsClick);

  document.getElementById('statusFilter').addEventListener('change', handleOrderFilterChange);
  document.getElementById('fromDateFilter').addEventListener('change', handleOrderFilterChange);
  document.getElementById('toDateFilter').addEventListener('change', handleOrderFilterChange);
  document.getElementById('clearOrderFiltersButton').addEventListener('click', handleClearOrderFilters);

  document.getElementById('printReceiptButton').addEventListener('click', printActiveOrder);
  document.getElementById('shareWhatsAppButton').addEventListener('click', shareActiveOrderOnWhatsApp);

  // Step 1: Empty the print-only area again once printing has finished.
  window.addEventListener('afterprint', function () {
    document.getElementById('printArea').innerHTML = '';
  });

  loadOrders();
}

// ===== Page start up =====
startOrdersPage();
