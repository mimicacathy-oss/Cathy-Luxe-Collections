/**
 * ------------------------------------------------------------------
 * File name : public/js/dashboard.js
 * Purpose   : Draws the dashboard: the four statistic cards, the sales
 *             line chart, the best-seller doughnut chart and the
 *             low-stock table. It also lets staff top up the stock of a
 *             low item through the shared edit form.
 * Connects  : Uses api.get / api.put from js/api.js, redirectToLoginIfNotLoggedIn
 *             from js/auth.js and the helpers in js/ui.js. Its only data
 *             sources are GET /api/dashboard/summary and PUT /api/products/:id.
 * ------------------------------------------------------------------
 */

// Chart.js keeps a chart alive until it is destroyed. Storing the two
// instances means a refresh can replace the old charts instead of stacking
// new ones on top of them.
let salesChartInstance = null;
let bestSellersChartInstance = null;

// The perfumes shown in the low-stock table, keyed by their id, so the
// Restock button can fill the edit form without another request.
let lowStockProductsById = {};

// The warning level used by the "Low-stock items" card and the badge colours.
let currentLowStockLevel = 5;

/**
 * Write a value into one of the statistic cards.
 *
 * @param {string} elementId - The id of the value element.
 * @param {string} text - The text to show.
 * @returns {void}
 */
function updateStatCard(elementId, text) {
  const element = document.getElementById(elementId);

  if (element) {
    element.textContent = text;
  }
}

/**
 * Turn a "YYYY-MM-DD" key into a short label such as "27 Oct" for the chart.
 *
 * @param {string} dateKey - The date key produced by the server.
 * @returns {string} A short label for the chart axis.
 */
function formatChartLabel(dateKey) {
  // Step 1: Split the key by hand instead of using new Date(), because the
  // browser would treat a bare date as UTC and could shift it by a day.
  const parts = String(dateKey).split('-');

  if (parts.length !== 3) {
    return String(dateKey);
  }

  const year = Number(parts[0]);
  const monthIndex = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  const date = new Date(year, monthIndex, day);

  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/**
 * Fill the four statistic cards from the summary response.
 *
 * @param {Object} summary - The object returned by GET /api/dashboard/summary.
 * @returns {void}
 */
function renderStatCards(summary) {
  // Step 1: Money and counts are formatted for a shopkeeper, not a programmer.
  updateStatCard('todaySalesValue', formatMoney(summary.todaySales));
  updateStatCard('monthSalesValue', formatMoney(summary.monthSales));
  updateStatCard('totalOrdersValue', String(summary.totalOrders));
  updateStatCard('lowStockValue', String(summary.lowStock.length));
}

/**
 * Draw the line chart of the money sold on each of the last seven days.
 *
 * @param {Array} salesLast7Days - [{ date: "2026-10-27", total: 150000 }].
 * @returns {void}
 */
function renderSalesChart(salesLast7Days) {
  const canvas = document.getElementById('salesChart');

  if (!canvas) {
    return;
  }

  // Step 1: Build the two arrays Chart.js needs: labels and values.
  const labels = [];
  const values = [];

  for (let index = 0; index < salesLast7Days.length; index++) {
    labels.push(formatChartLabel(salesLast7Days[index].date));
    values.push(salesLast7Days[index].total);
  }

  // Step 2: Remove the previous chart so a refresh does not stack canvases.
  if (salesChartInstance) {
    salesChartInstance.destroy();
  }

  // Step 3: Create the chart with the gold theme colour.
  salesChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Sales (UGX)',
          data: values,
          borderColor: '#c9a24d',
          backgroundColor: 'rgba(201, 162, 77, 0.18)',
          borderWidth: 3,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#a8853a',
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            // The tooltip shows proper money instead of a raw number.
            label: function (context) {
              return formatMoney(context.parsed.y);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              return Number(value).toLocaleString('en-US');
            }
          }
        }
      }
    }
  });
}

/**
 * Draw the doughnut chart of the five best selling perfumes.
 *
 * @param {Array} bestSellers - [{ productId, name, quantitySold, revenue }].
 * @returns {void}
 */
function renderBestSellersChart(bestSellers) {
  const container = document.getElementById('bestSellersContainer');

  if (!container) {
    return;
  }

  // Step 1: Destroy any previous chart and forget the reference.
  if (bestSellersChartInstance) {
    bestSellersChartInstance.destroy();
    bestSellersChartInstance = null;
  }

  // Step 2: With no completed sales yet there is nothing to draw, so we show
  // a friendly message instead of an empty ring.
  if (bestSellers.length === 0) {
    container.innerHTML =
      '<div class="empty-state py-4">' +
        '<i class="bi bi-pie-chart"></i>' +
        '<h5 class="mb-1">No sales yet</h5>' +
        '<p class="mb-0">Best sellers appear here after the first order.</p>' +
      '</div>';
    return;
  }

  // Step 3: Rebuild the canvas (the empty state above replaced it).
  container.innerHTML = '<canvas id="bestSellersChart" height="200"></canvas>';

  const labels = [];
  const values = [];

  for (let index = 0; index < bestSellers.length; index++) {
    labels.push(bestSellers[index].name);
    values.push(bestSellers[index].quantitySold);
  }

  const canvas = document.getElementById('bestSellersChart');

  bestSellersChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [
        {
          data: values,
          backgroundColor: ['#2a1f2d', '#c9a24d', '#7b7285', '#e6d3a3', '#a8853a'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 12, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return context.label + ': ' + context.parsed + ' sold';
            }
          }
        }
      }
    }
  });
}

/**
 * Build the row of buttons for the low-stock table.
 *
 * @returns {string} The HTML for the Low-stock alert table.
 */
function buildLowStockTableHtml(products, lowStockLevel) {
  let rows = '';

  for (let index = 0; index < products.length; index++) {
    const product = products[index];
    const stockInfo = getStockInfo(product.stock, lowStockLevel);

    rows +=
      '<tr>' +
        '<td>' +
          '<div class="fw-semibold">' + escapeHtml(product.name) + '</div>' +
          '<div class="text-muted-soft small">' + escapeHtml(product.brand) + '</div>' +
        '</td>' +
        '<td>' + escapeHtml(product.size || '-') + '</td>' +
        '<td><span class="' + stockInfo.className + '">' + escapeHtml(stockInfo.label) + '</span></td>' +
        '<td>' + escapeHtml(formatMoney(product.price)) + '</td>' +
        '<td class="text-end">' +
          '<button type="button" class="btn btn-sm btn-gold rounded-pill px-3 restock-button" ' +
            'data-product-id="' + escapeHtml(product._id) + '">' +
            '<i class="bi bi-box-arrow-in-down me-1"></i>Restock' +
          '</button>' +
        '</td>' +
      '</tr>';
  }

  return (
    '<div class="table-responsive">' +
      '<table class="table table-luxury align-middle">' +
        '<thead>' +
          '<tr>' +
            '<th>Perfume</th>' +
            '<th>Size</th>' +
            '<th>Stock</th>' +
            '<th>Price</th>' +
            '<th class="text-end">Action</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>'
  );
}

/**
 * Draw the low-stock alert table, or a friendly message when nothing is low.
 *
 * @param {Array} products - The low-stock products from the summary.
 * @param {number} lowStockLevel - The level at or below which stock is low.
 * @returns {void}
 */
function renderLowStockTable(products, lowStockLevel) {
  const container = document.getElementById('lowStockContainer');

  if (!container) {
    return;
  }

  // Step 1: With nothing low we show the happy empty state.
  if (products.length === 0) {
    showEmptyState('lowStockContainer', {
      icon: 'bi-check-circle',
      title: 'Stock levels are healthy',
      message: 'No perfume is at or below ' + lowStockLevel + ' bottles.'
    });
    return;
  }

  // Step 2: Otherwise draw the table and wire up the Restock buttons.
  container.innerHTML = buildLowStockTableHtml(products, lowStockLevel);

  const restockButtons = container.querySelectorAll('.restock-button');

  for (let index = 0; index < restockButtons.length; index++) {
    restockButtons[index].addEventListener('click', handleRestockClick);
  }
}

/**
 * React to a Restock button click by opening the edit form for that perfume.
 *
 * @param {Event} event - The click event from the Restock button.
 * @returns {void}
 */
function handleRestockClick(event) {
  const productId = event.currentTarget.getAttribute('data-product-id');
  const product = lowStockProductsById[productId];

  if (!product) {
    return;
  }

  openProductEditModal(product);
}

/**
 * Fill the edit form with a perfume and open the modal.
 *
 * @param {Object} product - The product document to edit.
 * @returns {void}
 */
function openProductEditModal(product) {
  document.getElementById('productModalTitle').textContent = 'Restock / edit perfume';
  document.getElementById('productId').value = product._id;
  document.getElementById('productName').value = product.name || '';
  document.getElementById('productBrand').value = product.brand || '';
  document.getElementById('productCategory').value = product.category || 'Unisex';
  document.getElementById('productSize').value = product.size || '';
  document.getElementById('productPrice').value = product.price;
  document.getElementById('productStock').value = product.stock;
  document.getElementById('productImageUrl').value = product.imageUrl || '';
  document.getElementById('productNotes').value = product.notes || '';

  // Step 1: Remove any "was-validated" look from a previous attempt.
  document.getElementById('productForm').classList.remove('was-validated');

  const modalElement = document.getElementById('productModal');
  bootstrap.Modal.getOrCreateInstance(modalElement).show();
}

/**
 * Save the perfume that was edited from the dashboard.
 *
 * @param {Event} event - The form submit event.
 * @returns {Promise<void>} Resolves when the save finished.
 */
async function handleProductFormSubmit(event) {
  event.preventDefault();

  const form = document.getElementById('productForm');
  const saveButton = document.getElementById('productSaveButton');

  // Step 1: Use the browser's own checks first, then let the server validate
  // the same values again with Mongoose.
  form.classList.add('was-validated');

  if (form.checkValidity() === false) {
    return;
  }

  const productId = document.getElementById('productId').value;
  const imageFile = document.getElementById('productImage').files[0];

  // Step 2: Stop double submissions while the request is in flight.
  saveButton.disabled = true;

  try {
    if (imageFile) {
      const formData = new FormData();
      formData.append('name', document.getElementById('productName').value.trim());
      formData.append('brand', document.getElementById('productBrand').value.trim());
      formData.append('category', document.getElementById('productCategory').value);
      formData.append('size', document.getElementById('productSize').value.trim());
      formData.append('price', Number(document.getElementById('productPrice').value));
      formData.append('stock', Number(document.getElementById('productStock').value));
      formData.append('notes', document.getElementById('productNotes').value.trim());
      formData.append('image', imageFile);

      await api.put('/products/' + productId, formData);
    } else {
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

      await api.put('/products/' + productId, payload);
    }

    showToast('Perfume updated.', 'success');

    bootstrap.Modal.getOrCreateInstance(document.getElementById('productModal')).hide();

    // Step 3: Reload the numbers so the new stock is reflected immediately.
    await loadDashboardSummary();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    saveButton.disabled = false;
  }
}

/**
 * Fetch the dashboard summary and draw every part of the page.
 *
 * @returns {Promise<void>} Resolves when the page has been drawn.
 */
async function loadDashboardSummary() {
  showLoadingState('lowStockContainer', 'Loading stock levels...');

  try {
    // Step 1: One request gives us every number the page needs.
    const summary = await api.get('/dashboard/summary');

    currentLowStockLevel = summary.lowStockLevel;

    // Step 2: Remember the low-stock perfumes so Restock can fill the form.
    lowStockProductsById = {};

    for (let index = 0; index < summary.lowStock.length; index++) {
      const product = summary.lowStock[index];
      lowStockProductsById[String(product._id)] = product;
    }

    // Step 3: Draw each section.
    renderStatCards(summary);
    renderSalesChart(summary.salesLast7Days);
    renderBestSellersChart(summary.bestSellers);
    renderLowStockTable(summary.lowStock, summary.lowStockLevel);

    document.getElementById('lowStockHint').textContent =
      ' (at or below ' + summary.lowStockLevel + ' bottles)';
  } catch (error) {
    showToast(error.message, 'error');
    showEmptyState('lowStockContainer', {
      icon: 'bi-wifi-off',
      title: 'Could not load the dashboard',
      message: error.message
    });
  }
}

/**
 * Start the dashboard page: guard the route, draw the navbar and load data.
 *
 * @returns {void}
 */
function startDashboard() {
  // Step 1: Nobody sees the dashboard without a token.
  redirectToLoginIfNotLoggedIn();

  // Step 2: Draw the shared navbar and the confirmation modal.
  initUi('dashboard');

  // Step 3: Wire up the buttons, then load the data.
  document.getElementById('refreshButton').addEventListener('click', loadDashboardSummary);
  document.getElementById('productForm').addEventListener('submit', handleProductFormSubmit);

  loadDashboardSummary();
}

// ===== Page start up =====
startDashboard();
