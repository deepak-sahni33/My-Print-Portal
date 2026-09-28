/* ============================================================
   PrintEase – Application JavaScript
   ============================================================ */

'use strict';

// ─── State ────────────────────────────────────────────────────
const state = {
  files: [],
  settings: {
    colorMode: 'bw',
    sideMode:  'single',
    paperSize: 'a4',
    copies:    1,
    pages:     1
  },
  pricing: {
    bw_a4:     2,
    bw_a3:     4,
    bw_legal:  3,
    color_a4:  8,
    color_a3:  10,
    color_legal: 9
  },
  orders: [],
  currentOrderId: null
};

// ─── Server State Helpers ────────────────────────────────────
async function loadPricingFromServer() {
  try {
    const response = await fetch('/api/pricing');
    if (response.ok) {
      const data = await response.json();
      state.pricing = data;
      updateSummary();
      updatePricingRef();
    }
  } catch (err) {
    console.error('Failed to load pricing from server:', err);
    showToast('Failed to load live pricing. Using cached rates.', 'error');
  }
}

// ─── Page Navigation ────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  const page = document.getElementById(`page-${name}`);
  if (page) page.classList.add('active');

  const link = document.querySelector(`[data-page="${name}"]`);
  if (link) link.classList.add('active');

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Close mobile nav
  document.getElementById('navLinks').classList.remove('open');

  // Refresh admin if needed
  if (name === 'admin') {
    renderAdminStats();
    renderAdminOrders();
    renderPricingAdmin();
  }
}

function toggleNav() {
  document.getElementById('navLinks').classList.toggle('open');
}

// Navbar scroll shadow
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 10);
});

// ─── File Handling ───────────────────────────────────────────
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function handleFileSelect(e) {
  addFiles(Array.from(e.target.files));
  e.target.value = '';
}
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.add('drag-over');
}
function handleDragLeave(e) {
  document.getElementById('uploadZone').classList.remove('drag-over');
}
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.remove('drag-over');
  addFiles(Array.from(e.dataTransfer.files));
}

function addFiles(incoming) {
  const allowed = ['pdf','docx','jpg','jpeg','png'];
  incoming.forEach(file => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      showToast(`"${file.name}" is not a supported file type.`, 'error');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast(`"${file.name}" exceeds 20 MB limit.`, 'error');
      return;
    }
    if (state.files.find(f => f.name === file.name)) {
      showToast(`"${file.name}" is already added.`, 'error');
      return;
    }
    state.files.push(file);
  });
  renderFileList();
  updateSummary();
}

function removeFile(index) {
  state.files.splice(index, 1);
  renderFileList();
  updateSummary();
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024*1024)).toFixed(1) + ' MB';
}

function renderFileList() {
  const list = document.getElementById('fileList');
  list.innerHTML = '';
  state.files.forEach((file, i) => {
    const ext = file.name.split('.').pop().toLowerCase();
    const el = document.createElement('div');
    el.className = 'file-item';
    el.innerHTML = `
      <div class="file-type-badge ft-${ext}">${ext.toUpperCase()}</div>
      <div class="file-info">
        <div class="file-name" title="${file.name}">${file.name}</div>
        <div class="file-size">${formatSize(file.size)}</div>
      </div>
      <button class="file-remove" onclick="removeFile(${i})" title="Remove">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    list.appendChild(el);
  });
}

// ─── Options Selection ───────────────────────────────────────
function selectOption(group, value, el) {
  const container = document.getElementById(group);
  container.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  state.settings[group] = value;
  updatePrice();
  updateSummary();
}

function changeCopies(delta) {
  const input = document.getElementById('copiesInput');
  let val = parseInt(input.value) + delta;
  val = Math.max(1, Math.min(100, val));
  input.value = val;
  state.settings.copies = val;
  updatePrice();
  updateSummary();
}

function updateCopies() {
  let val = parseInt(document.getElementById('copiesInput').value) || 1;
  val = Math.max(1, Math.min(100, val));
  document.getElementById('copiesInput').value = val;
  state.settings.copies = val;
  updatePrice();
  updateSummary();
}

// ─── Price Calculation ───────────────────────────────────────
function getPricePerPage() {
  const { colorMode, paperSize } = state.settings;
  const key = `${colorMode}_${paperSize}`;
  return state.pricing[key] || 2;
}

function calcTotal() {
  const { copies, pages } = state.settings;
  const ppp = getPricePerPage();
  const fileCount = Math.max(state.files.length, 1);
  return ppp * pages * fileCount * copies;
}

function updatePrice() {
  const pages = parseInt(document.getElementById('pagesInput').value) || 1;
  state.settings.pages = Math.max(1, pages);
  document.getElementById('pagesInput').value = state.settings.pages;
  updateSummary();
}

function updateSummary() {
  const s = state.settings;
  const pages = parseInt(document.getElementById('pagesInput')?.value) || 1;
  state.settings.pages = Math.max(1, pages);

  const colorLabel   = s.colorMode === 'bw' ? 'Black & White' : 'Color';
  const sideLabel    = s.sideMode  === 'single' ? 'Single Side' : 'Double Side';
  const paperLabel   = s.paperSize.toUpperCase();
  const ppp          = getPricePerPage();
  const total        = calcTotal();

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('sum-files',  `${state.files.length} file(s)`);
  set('sum-pages',  `${state.settings.pages} page(s) per file`);
  set('sum-color',  colorLabel);
  set('sum-sides',  sideLabel);
  set('sum-paper',  paperLabel);
  set('sum-copies', s.copies);
  set('sum-ppp',    `₹${ppp.toFixed(2)}`);
  set('sum-total',  `₹${total.toFixed(2)}`);

  // Update pricing reference table
  updatePricingRef();
}

function updatePricingRef() {
  const p = state.pricing;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = `₹${val}`; };
  set('ref-bw-a4',     p.bw_a4);
  set('ref-color-a4',  p.color_a4);
  set('ref-bw-a3',     p.bw_a3);
  set('ref-color-a3',  p.color_a3);
  set('ref-bw-legal',  p.bw_legal);
  set('ref-color-legal', p.color_legal);
  set('bw-price',      p.bw_a4 + '/page');
  set('color-price',   p.color_a4 + '/page');
}

// ─── Order Preview Modal ─────────────────────────────────────
function showOrderPreview() {
  // Validate
  const name  = document.getElementById('custName').value.trim();
  const phone = document.getElementById('custPhone').value.trim();
  let valid = true;

  document.getElementById('nameError').textContent  = '';
  document.getElementById('phoneError').textContent = '';

  if (!name) {
    document.getElementById('nameError').textContent = 'Full name is required.';
    valid = false;
  }
  if (!phone || !/^\d{7,15}$/.test(phone.replace(/[\s\-+]/g, ''))) {
    document.getElementById('phoneError').textContent = 'Enter a valid phone number.';
    valid = false;
  }
  if (state.files.length === 0) {
    showToast('Please upload at least one file.', 'error');
    document.getElementById('step-upload').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (!valid) return;

  const s = state.settings;
  const email = document.getElementById('custEmail').value.trim();
  const notes = document.getElementById('custNotes').value.trim();
  const ppp   = getPricePerPage();
  const total = calcTotal();

  const html = `
    <div class="preview-section">
      <h3>Files</h3>
      <div class="preview-rows">
        ${state.files.map(f => `<div class="preview-row"><span>${f.name}</span><span>${formatSize(f.size)}</span></div>`).join('')}
      </div>
    </div>
    <div class="preview-section">
      <h3>Print Settings</h3>
      <div class="preview-rows">
        <div class="preview-row"><span>Color Mode</span><span>${s.colorMode === 'bw' ? 'Black & White' : 'Color'}</span></div>
        <div class="preview-row"><span>Sides</span><span>${s.sideMode === 'single' ? 'Single Side' : 'Double Side'}</span></div>
        <div class="preview-row"><span>Paper Size</span><span>${s.paperSize.toUpperCase()}</span></div>
        <div class="preview-row"><span>Pages per File</span><span>${s.pages}</span></div>
        <div class="preview-row"><span>Number of Copies</span><span>${s.copies}</span></div>
        <div class="preview-row"><span>Price per Page</span><span>₹${ppp.toFixed(2)}</span></div>
      </div>
    </div>
    <div class="preview-section">
      <h3>Customer Details</h3>
      <div class="preview-rows">
        <div class="preview-row"><span>Name</span><span>${escHtml(name)}</span></div>
        <div class="preview-row"><span>Phone</span><span>${escHtml(phone)}</span></div>
        ${email ? `<div class="preview-row"><span>Email</span><span>${escHtml(email)}</span></div>` : ''}
        ${notes ? `<div class="preview-row"><span>Notes</span><span style="max-width:220px;text-align:right">${escHtml(notes)}</span></div>` : ''}
      </div>
    </div>
    <div class="preview-total">
      <span>Total Amount</span>
      <span>₹${total.toFixed(2)}</span>
    </div>
  `;

  document.getElementById('previewContent').innerHTML = html;
  openModal('previewModal');
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

// ─── Order Generation ────────────────────────────────────────
async function placeOrder() {
  const s     = state.settings;
  const name  = document.getElementById('custName').value.trim();
  const phone = document.getElementById('custPhone').value.trim();
  const email = document.getElementById('custEmail').value.trim();
  const notes = document.getElementById('custNotes').value.trim();
  const ppp   = getPricePerPage();
  const total = calcTotal();

  // Show loading state
  const placeOrderBtn = document.querySelector('#previewModal .btn-primary');
  const cancelBtn = document.querySelector('#previewModal .btn-outline');
  if (placeOrderBtn) {
    placeOrderBtn.disabled = true;
    placeOrderBtn.innerHTML = `<span class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px;vertical-align:middle"></span> Placing Order...`;
  }
  if (cancelBtn) cancelBtn.disabled = true;

  try {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('phone', phone);
    formData.append('email', email);
    formData.append('notes', notes);
    formData.append('colorMode', s.colorMode);
    formData.append('sideMode', s.sideMode);
    formData.append('paperSize', s.paperSize);
    formData.append('copies', s.copies);
    formData.append('pages', s.pages);
    formData.append('pricePerPage', ppp);
    formData.append('totalPrice', total);

    state.files.forEach(file => {
      formData.append('files', file);
    });

    const response = await fetch('/api/orders', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Failed to place order');
    }

    const createdOrder = await response.json();
    state.currentOrderId = createdOrder.orderId;

    closeModal('previewModal');
    showConfirmation(createdOrder);
    resetOrderForm();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    if (placeOrderBtn) {
      placeOrderBtn.disabled = false;
      placeOrderBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Confirm &amp; Place Order
      `;
    }
    if (cancelBtn) cancelBtn.disabled = false;
  }
}

function resetOrderForm() {
  state.files = [];
  state.settings = { colorMode: 'bw', sideMode: 'single', paperSize: 'a4', copies: 1, pages: 1 };

  renderFileList();

  // Reset option cards
  const resetGroup = (id, val) => {
    const container = document.getElementById(id);
    if (!container) return;
    container.querySelectorAll('.option-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.value === val);
    });
  };
  resetGroup('colorMode', 'bw');
  resetGroup('sideMode',  'single');
  resetGroup('paperSize', 'a4');

  document.getElementById('copiesInput').value = 1;
  document.getElementById('pagesInput').value  = 1;
  document.getElementById('custName').value    = '';
  document.getElementById('custPhone').value   = '';
  document.getElementById('custEmail').value   = '';
  document.getElementById('custNotes').value   = '';
  document.getElementById('nameError').textContent  = '';
  document.getElementById('phoneError').textContent = '';

  updateSummary();
}

// ─── Confirmation Page ───────────────────────────────────────
function showConfirmation(order) {
  document.getElementById('confirmOrderId').textContent = order.orderId;

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const detailsHtml = `
    <div class="confirm-detail-row"><span>Files</span><span>${order.files.length} file(s)</span></div>
    <div class="confirm-detail-row"><span>Color</span><span>${order.settings.colorMode === 'bw' ? 'Black & White' : 'Color'}</span></div>
    <div class="confirm-detail-row"><span>Sides</span><span>${order.settings.sideMode === 'single' ? 'Single Side' : 'Double Side'}</span></div>
    <div class="confirm-detail-row"><span>Paper</span><span>${order.settings.paperSize.toUpperCase()}</span></div>
    <div class="confirm-detail-row"><span>Copies</span><span>${order.settings.copies}</span></div>
    <div class="confirm-detail-row"><span>Customer</span><span>${escHtml(order.customer.name)}</span></div>
    <div class="confirm-detail-row"><span>Date</span><span>${formatDate(order.createdAt || order.date)}</span></div>
    <div class="confirm-detail-row" style="font-weight:700;color:var(--primary)"><span>Total</span><span>₹${order.pricing.total.toFixed(2)}</span></div>
  `;
  document.getElementById('confirmDetails').innerHTML = detailsHtml;

  showPage('confirmation');
  showToast(`Order ${order.orderId} placed successfully! 🎉`, 'success');
}

function copyOrderId() {
  const oid = document.getElementById('confirmOrderId').textContent;
  navigator.clipboard.writeText(oid).then(() => {
    showToast('Order ID copied to clipboard!', 'info');
  }).catch(() => {
    showToast('Could not copy. Please copy manually.', 'error');
  });
}

// ─── Order Tracking ──────────────────────────────────────────
async function trackOrder() {
  const raw = document.getElementById('trackInput').value.trim().toUpperCase();
  const errEl = document.getElementById('trackError');
  const resultEl = document.getElementById('trackResult');

  errEl.textContent = '';
  resultEl.classList.add('hidden');
  resultEl.innerHTML = '';

  if (!raw) {
    errEl.textContent = 'Please enter an Order ID.';
    return;
  }

  // Show loading indicator
  resultEl.classList.remove('hidden');
  resultEl.innerHTML = `<div style="text-align:center;padding:20px;"><div class="spinner"></div> Searching...</div>`;

  try {
    const res = await fetch(`/api/orders/${raw}`);
    if (res.status === 404) {
      resultEl.innerHTML = `
        <div class="track-error">
          <div class="track-error-icon">🔍</div>
          <h3>Order Not Found</h3>
          <p>No order found with ID <strong>${escHtml(raw)}</strong>. Please check and try again.</p>
        </div>
      `;
      return;
    }
    if (!res.ok) throw new Error('Server error');
    
    const order = await res.json();
    renderTrackResult(order, resultEl);
  } catch (err) {
    resultEl.innerHTML = `
      <div class="track-error">
        <div class="track-error-icon">⚠️</div>
        <h3>Failed to Track Order</h3>
        <p>There was an issue communicating with the server. Please try again later.</p>
      </div>
    `;
  }
}

function renderTrackResult(order, container) {
  const statusMap = {
    pending:   { label: 'Pending',          cls: 'status-pending',   dot: 0 },
    printing:  { label: 'Printing',         cls: 'status-printing',  dot: 1 },
    ready:     { label: 'Ready for Pickup', cls: 'status-ready',     dot: 2 },
    completed: { label: 'Completed',        cls: 'status-completed', dot: 3 }
  };
  const sm = statusMap[order.status] || statusMap.pending;

  const steps = [
    { label: 'Order Placed', icon: '📋' },
    { label: 'Printing',     icon: '🖨️' },
    { label: 'Ready',        icon: '✅' },
    { label: 'Completed',    icon: '🎉' }
  ];

  const timelineHtml = steps.map((step, i) => {
    let dotCls = '';
    if (i < sm.dot)       dotCls = 'done';
    else if (i === sm.dot) dotCls = 'current';
    const labelCls = i <= sm.dot ? 'active' : '';

    const lineHtml = i < steps.length - 1
      ? `<div class="timeline-line${i < sm.dot ? ' done' : ''}"></div>`
      : '';

    return `
      <div class="timeline-step">
        <div class="timeline-dot ${dotCls}">${dotCls === 'done' ? '✓' : step.icon}</div>
        <div class="timeline-label ${labelCls}">${step.label}</div>
      </div>
      ${lineHtml}
    `;
  }).join('');

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const orderDate = order.createdAt || order.date;

  container.classList.remove('hidden');
  container.innerHTML = `
    <div class="track-card">
      <div class="track-card-header">
        <div>
          <div class="track-order-id">${escHtml(order.orderId)}</div>
          <div class="track-order-date">Placed on ${formatDate(orderDate)} at ${formatTime(orderDate)}</div>
        </div>
        <div class="status-badge ${sm.cls}">${sm.label}</div>
      </div>
      <div class="status-timeline">${timelineHtml}</div>
      <div class="track-details">
        <div class="track-detail-item">
          <label>Customer</label>
          <span>${escHtml(order.customer.name)}</span>
        </div>
        <div class="track-detail-item">
          <label>Phone</label>
          <span>${escHtml(order.customer.phone)}</span>
        </div>
        <div class="track-detail-item">
          <label>Files</label>
          <span>${order.files.length} file(s)</span>
        </div>
        <div class="track-detail-item">
          <label>Print Settings</label>
          <span>${order.settings.colorMode === 'bw' ? 'B&W' : 'Color'} · ${order.settings.paperSize.toUpperCase()} · ${order.settings.sideMode === 'single' ? '1-Side' : '2-Side'}</span>
        </div>
        <div class="track-detail-item">
          <label>Copies</label>
          <span>${order.settings.copies}</span>
        </div>
        <div class="track-detail-item">
          <label>Total Amount</label>
          <span style="color:var(--primary);font-weight:700">₹${order.pricing.total.toFixed(2)}</span>
        </div>
        ${order.customer.notes ? `
        <div class="track-detail-item" style="grid-column:1/-1">
          <label>Notes</label>
          <span>${escHtml(order.customer.notes)}</span>
        </div>` : ''}
      </div>
    </div>
  `;
}

// Pre-fill track input if coming from confirmation
const _origShowPage = showPage;

// ─── Admin Dashboard ─────────────────────────────────────────
async function renderAdminStats() {
  const el = document.getElementById('adminStats');
  if (!el) return;

  try {
    const res = await fetch('/api/orders/stats');
    if (!res.ok) throw new Error('Failed to fetch stats');
    const stats = await res.json();

    el.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon blue">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
          </svg>
        </div>
        <div class="stat-info"><span>Total Orders</span><strong>${stats.total}</strong></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <div class="stat-info"><span>Pending / Printing</span><strong>${stats.pending + stats.printing}</strong></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <div class="stat-info"><span>Ready / Completed</span><strong>${stats.ready + stats.completed}</strong></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        </div>
        <div class="stat-info"><span>Total Revenue</span><strong>₹${stats.revenue.toFixed(0)}</strong></div>
      </div>
    `;
  } catch (err) {
    console.error('Failed to render stats:', err);
  }
}

async function renderAdminOrders() {
  const search  = (document.getElementById('adminSearch')?.value || '').trim();
  const filter  = document.getElementById('adminFilter')?.value || 'all';
  const listEl  = document.getElementById('adminOrdersList');
  if (!listEl) return;

  try {
    const url = new URL('/api/orders', window.location.origin);
    if (filter !== 'all') url.searchParams.set('filter', filter);
    if (search) url.searchParams.set('search', search);

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch orders');
    const orders = await res.json();
    state.orders = orders;

    if (orders.length === 0) {
      listEl.innerHTML = `
        <div class="no-orders">
          <div class="no-orders-icon">📭</div>
          <p>No orders match your filter.</p>
        </div>
      `;
      return;
    }

    const statusMap = {
      pending:   { label: 'Pending',          cls: 'status-pending'   },
      printing:  { label: 'Printing',         cls: 'status-printing'  },
      ready:     { label: 'Ready for Pickup', cls: 'status-ready'     },
      completed: { label: 'Completed',        cls: 'status-completed' }
    };

    const formatDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    const rows = orders.map(o => {
      const sm = statusMap[o.status] || statusMap.pending;
      const fileNames = o.files.map(f => f.originalName).join(', ');
      const fileNamesShort = fileNames.length > 30 ? fileNames.substring(0, 28) + '…' : fileNames;

      return `
        <tr>
          <td><strong>${escHtml(o.orderId)}</strong><br><small style="color:var(--text-muted)">${formatDate(o.createdAt)}</small></td>
          <td>${escHtml(o.customer.name)}<br><small style="color:var(--text-muted)">${escHtml(o.customer.phone)}</small></td>
          <td title="${escHtml(fileNames)}">${escHtml(fileNamesShort)}</td>
          <td>${o.settings.colorMode === 'bw' ? 'B&W' : 'Color'} · ${o.settings.paperSize.toUpperCase()}<br><small style="color:var(--text-muted)">${o.settings.copies} cop. · ${o.settings.pages} pg</small></td>
          <td><span class="admin-status-badge ${sm.cls}">${sm.label}</span></td>
          <td><strong style="color:var(--primary)">₹${o.pricing.total.toFixed(2)}</strong></td>
          <td>
            <select class="admin-status-select" onchange="updateOrderStatus('${o.orderId}', this.value)">
              <option value="pending"   ${o.status === 'pending'   ? 'selected' : ''}>Pending</option>
              <option value="printing"  ${o.status === 'printing'  ? 'selected' : ''}>Printing</option>
              <option value="ready"     ${o.status === 'ready'     ? 'selected' : ''}>Ready for Pickup</option>
              <option value="completed" ${o.status === 'completed' ? 'selected' : ''}>Completed</option>
            </select>
          </td>
          <td>
            <button class="download-btn" onclick="downloadOrderFiles('${o.orderId}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Files
            </button>
          </td>
        </tr>
      `;
    }).join('');

    listEl.innerHTML = `
      <div class="orders-table-wrap">
        <table class="orders-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Files</th>
              <th>Settings</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Update Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.error('Failed to render admin orders:', err);
  }
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) throw new Error('Failed to update status');

    showToast(`Order ${orderId} updated to "${newStatus}".`, 'success');
    renderAdminStats();
    renderAdminOrders();
  } catch (err) {
    showToast(`Failed to update status: ${err.message}`, 'error');
    renderAdminOrders();
  }
}

function downloadOrderFiles(orderId) {
  const order = state.orders.find(o => o.orderId === orderId);
  if (!order || !order.files || order.files.length === 0) {
    showToast('No files associated with this order.', 'error');
    return;
  }

  order.files.forEach(f => {
    const a = document.createElement('a');
    a.href = f.path;
    a.download = f.originalName;
    a.target = '_blank';
    a.click();
  });
  showToast(`Downloading ${order.files.length} file(s)...`, 'info');
}

// ─── Pricing Admin ────────────────────────────────────────────
function renderPricingAdmin() {
  const grid = document.getElementById('pricingAdminGrid');
  if (!grid) return;

  const fields = [
    { key: 'bw_a4',     label: 'B&W – A4 (₹/page)' },
    { key: 'color_a4',  label: 'Color – A4 (₹/page)' },
    { key: 'bw_a3',     label: 'B&W – A3 (₹/page)' },
    { key: 'color_a3',  label: 'Color – A3 (₹/page)' },
    { key: 'bw_legal',  label: 'B&W – Legal (₹/page)' },
    { key: 'color_legal', label: 'Color – Legal (₹/page)' }
  ];

  grid.innerHTML = fields.map(f => `
    <div class="pricing-field">
      <label>${f.label}</label>
      <input type="number" min="0.5" step="0.5" class="pricing-field-input" id="pi_${f.key}" value="${state.pricing[f.key]}" />
    </div>
  `).join('');
}

async function savePricing() {
  const keys = ['bw_a4', 'color_a4', 'bw_a3', 'color_a3', 'bw_legal', 'color_legal'];
  const updates = {};
  keys.forEach(k => {
    const val = parseFloat(document.getElementById(`pi_${k}`)?.value);
    if (!isNaN(val) && val >= 0.5) updates[k] = val;
  });

  try {
    const res = await fetch('/api/pricing/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update pricing');

    Object.assign(state.pricing, updates);
    updateSummary();

    const ind = document.getElementById('pricingSaved');
    if (ind) {
      ind.textContent = '✓ Saved!';
      ind.classList.add('visible');
      setTimeout(() => ind.classList.remove('visible'), 2500);
    }
    showToast('Pricing updated successfully!', 'success');
  } catch (err) {
    showToast(`Failed to save pricing: ${err.message}`, 'error');
  }
}

// ─── Tab Switching ────────────────────────────────────────────
function switchTab(name, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`tab-${name}`)?.classList.add('active');
  if (name === 'pricing') renderPricingAdmin();
}

// ─── Toast Notifications ──────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3800);
}

// ─── Utility ──────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Track shortcut ──────────────────────────────────────────
// Allow pressing Enter in track input
document.addEventListener('DOMContentLoaded', () => {
  const ti = document.getElementById('trackInput');
  if (ti) {
    ti.addEventListener('keydown', e => { if (e.key === 'Enter') trackOrder(); });
  }

  // Load pricing configuration from server
  loadPricingFromServer();

  // Show home by default
  showPage('home');
});
