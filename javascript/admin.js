/* ============================================================
   Digispex — admin.js  (Inventory · Add Product · Orders · Audit Trail)
============================================================ */
'use strict';

const STOCK_KEY = 'ds_stock';
const CUSTOM_KEY = 'ds_custom_products';
const IMG_KEY = 'ds_custom_images';
const DESC_KEY = 'ds_custom_descs';
const AUDIT_KEY = 'ds_audit_log';
const ORDER_KEY = 'ds_audit_log';  // orders also go here

let selected = new Set();
let filtered = [];

/* Categories that require a benchmark score (used in PC Builder performance) */
const BENCH_CATEGORIES = ['CPU', 'GPU', 'RAM', 'Storage'];

/**
 * Show/hide compatibility and benchmark fields based on the selected category.
 */
function _toggleCompatFields(cat) {
  // 1. Benchmarks
  const benchGroup = document.getElementById('apBenchGroup');
  const benchIn = document.getElementById('apBenchScore');
  const needsBench = ['CPU', 'GPU', 'RAM', 'Storage'].includes(cat);
  if (benchGroup) benchGroup.style.display = needsBench ? '' : 'none';
  if (!needsBench && benchIn) {
    benchIn.value = '';
    if (typeof updateBenchPreview === 'function') updateBenchPreview('');
  }

  // 2. Compatibility (Socket & RAM Type)
  const compatRow = document.getElementById('apCompatGroup');
  const sockGroup = document.getElementById('apSocketGroup');
  const memGroup = document.getElementById('apMemGroup');

  const needsSock = ['CPU', 'Motherboard'].includes(cat);
  const needsMem = ['CPU', 'Motherboard', 'RAM'].includes(cat);

  if (compatRow) compatRow.style.display = (needsSock || needsMem) ? 'flex' : 'none';
  if (sockGroup) sockGroup.style.display = needsSock ? '' : 'none';
  if (memGroup) memGroup.style.display = needsMem ? '' : 'none';

  // 3. Power Details (Wattage, TDP, GPU Power)
  const powerRow = document.getElementById('apPowerGroup');
  const wattGroup = document.getElementById('apWattageGroup');
  const tdpGroup = document.getElementById('apTDPGroup');
  const gpuPowerGroup = document.getElementById('apGpuPowerGroup');

  const isPSU = cat === 'PSU';
  const isCPU = cat === 'CPU';
  const isGPU = cat === 'GPU';
  const isMB = cat === 'Motherboard';
  const isCase = cat === 'Case';

  if (powerRow) powerRow.style.display = (isPSU || isCPU || isGPU) ? 'flex' : 'none';
  if (wattGroup) wattGroup.style.display = isPSU ? '' : 'none';
  if (tdpGroup) tdpGroup.style.display = isCPU ? '' : 'none';
  if (gpuPowerGroup) gpuPowerGroup.style.display = isGPU ? '' : 'none';

  // 4. Physical & Form Factor
  const physGroup = document.getElementById('apPhysicalGroup');
  const gpuLenGroup = document.getElementById('apGpuLengthGroup');
  const maxGpuLenGroup = document.getElementById('apMaxGpuLengthGroup');
  const ffGroup = document.getElementById('apFormFactorGroup');
  const supplFfGroup = document.getElementById('apSupportedFfGroup');

  if (physGroup) physGroup.style.display = (isGPU || isMB || isCase) ? 'flex' : 'none';
  if (gpuLenGroup) gpuLenGroup.style.display = isGPU ? '' : 'none';
  if (maxGpuLenGroup) maxGpuLenGroup.style.display = isCase ? '' : 'none';
  if (ffGroup) ffGroup.style.display = isMB ? '' : 'none';
  if (supplFfGroup) supplFfGroup.style.display = isCase ? '' : 'none';

  // 5. Clear values if hidden
  if (!needsSock) { document.getElementById('apSocket').value = ''; }
  if (!needsMem) { document.getElementById('apMemType').value = ''; }
  if (!isPSU) { document.getElementById('apWattage').value = ''; }
  if (!isCPU) { document.getElementById('apTDP').value = ''; }
  if (!isGPU) { document.getElementById('apGpuPower').value = ''; }
  if (!isGPU) { document.getElementById('apGpuLength').value = ''; }
  if (!isCase) { document.getElementById('apMaxGpuLength').value = ''; }
  if (!isMB) { document.getElementById('apFormFactor').value = ''; }
  if (!isCase) { document.getElementById('apSupportedFf').value = ''; }

  updatePreview();
}

/*  localStorage helpers  */
function readLS(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function writeLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }

function getStock() { return readLS(STOCK_KEY) || {}; }
function getStatus(id) { return (getStock())[id] || 'normal'; }

function setStockVal(id, status, productName) {
  const s = getStock();
  const old = s[id] || 'normal';
  if (status === 'normal') delete s[id]; else s[id] = status;
  writeLS(STOCK_KEY, s);
  pushAudit({ type: 'status_change', productId: id, productName: productName || id, oldStatus: old, newStatus: status });
  /* Sync to Supabase */
  if (typeof SB !== 'undefined') SB.updateProduct(id, { stock_status: status });
}

function bulkSetStockVals(ids, status, allProds) {
  const s = getStock();
  ids.forEach(id => {
    const old = s[id] || 'normal';
    if (status === 'normal') delete s[id]; else s[id] = status;
    const name = (allProds.find(p => p.id === id) || {}).name || id;
    pushAudit({ type: 'status_change', productId: id, productName: name, oldStatus: old, newStatus: status });
  });
  writeLS(STOCK_KEY, s);
}

function pushAudit(entry) {
  const log = readLS(AUDIT_KEY) || [];
  log.unshift({ ...entry, ts: Date.now() });
  if (log.length > 500) log.splice(500);
  writeLS(AUDIT_KEY, log);
  /* Sync to Supabase */
  if (typeof SB !== 'undefined') SB.pushAuditEntry(entry);
}

function getCustomProducts() { return readLS(CUSTOM_KEY) || []; }
function getCustomImages() { return readLS(IMG_KEY) || {}; }
function getCustomDescs() { return readLS(DESC_KEY) || {}; }
function allProducts() {
  const hidden = readLS('ds_hidden_products') || [];
  const base = hidden.length ? PRODUCTS.filter(p => !hidden.includes(p.id)) : PRODUCTS;
  return [...base, ...getCustomProducts()];
}

/*  TABS  */
function switchTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  ['panelInventory', 'panelAddProduct', 'panelOrders', 'panelAudit', 'panelPackages'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const panelEl = document.getElementById('panel' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (panelEl) panelEl.style.display = '';
  if (tab === 'orders') renderOrders();
  if (tab === 'audit') renderAudit();
  if (tab === 'packages') adminRenderPackages();
}

/* 
   PANEL 1 — INVENTORY
 */
function renderTable() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const cat = document.getElementById('catFilter').value;
  const status = document.getElementById('statusFilter').value;

  filtered = allProducts().filter(p => {
    const mQ = !q || p.name.toLowerCase().includes(q) || p.specs.toLowerCase().includes(q);
    const mC = cat === 'All' || p.cat === cat;
    const mS = status === 'All' || getStatus(p.id) === status;
    return mQ && mC && mS;
  });

  const imgs = getCustomImages();
  const tbody = document.getElementById('tableBody');

  if (!filtered.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No products match your filters.</td></tr>';
    renderStats(); return;
  }

  tbody.innerHTML = filtered.map(p => {
    const st = getStatus(p.id);
    const php = Math.round(p.price * 57);
    const salePHP = Math.round(php * 0.85);
    const isChecked = selected.has(p.id);

    const imgSrc = imgs[p.id];

    const priceHtml = st === 'sale'
      ? `<span class="price-orig">&#8369;${php.toLocaleString()}</span><span class="price-sale">&#8369;${salePHP.toLocaleString()}</span>`
      : `&#8369;${php.toLocaleString()}`;

    const statusLabels = { normal: 'In Stock', sale: 'On Sale', lowstock: 'Low Stock', outofstock: 'Out of Stock' };
    const dotLabel = '&#9679; ' + (statusLabels[st] || 'In Stock');

    const thumb = imgSrc
      ? `<img src="${imgSrc}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;display:block;">`
      : `<div style="width:36px;height:36px;border-radius:6px;background:var(--s2);display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:0.48rem;font-weight:700;text-transform:uppercase;color:var(--accent);letter-spacing:0.5px;text-align:center;line-height:1.2">${p.cat.slice(0, 3).toUpperCase()}</div>`;

    const socketBadge = (p.socket && (p.cat === 'CPU' || p.cat === 'Motherboard'))
      ? `<span style="font-size:0.56rem;padding:1px 5px;border-radius:3px;background:rgba(255,107,53,0.1);color:#ff6b35;font-family:'JetBrains Mono',monospace;letter-spacing:0.5px;vertical-align:middle;margin-left:5px;border:1px solid rgba(255,107,53,0.2)">${p.socket}</span>`
      : '';
    const memBadge = (p.memType && (p.cat === 'CPU' || p.cat === 'Motherboard' || p.cat === 'RAM'))
      ? `<span style="font-size:0.56rem;padding:1px 5px;border-radius:3px;background:rgba(37,99,235,0.1);color:var(--accent);font-family:'JetBrains Mono',monospace;letter-spacing:0.5px;vertical-align:middle;margin-left:5px;border:1px solid rgba(37,99,235,0.2)">${p.memType}</span>`
      : '';

    return `<tr id="row-${p.id}" class="${isChecked ? 'selected' : ''}">
      <td><input type="checkbox" data-id="${p.id}" ${isChecked ? 'checked' : ''} onchange="toggleRow('${p.id}',this)"></td>
      <td>
        <div style="display:flex;align-items:center;gap:0.65rem">
          ${thumb}
          <div>
            <div class="prod-name">${p.name}${socketBadge}${memBadge}</div>
            <div class="prod-specs">${p.specs.length > 65 ? p.specs.slice(0, 65) + '…' : p.specs}</div>
            ${(function () {
        const bs = p.benchScore || 0;
        if (!bs) return '';
        let bc = '#94a3b8', bl = 'Entry';
        if (bs >= 95) { bc = '#ef4444'; bl = 'Flagship'; }
        else if (bs >= 80) { bc = '#f97316'; bl = 'High-End'; }
        else if (bs >= 55) { bc = '#2563eb'; bl = 'Mid-Range'; }
        else if (bs >= 30) { bc = '#22c55e'; bl = 'Budget'; }
        return `<div style="display:flex;align-items:center;gap:0.35rem;margin-top:3px">
                <div style="width:50px;height:3px;border-radius:2px;background:var(--border);overflow:hidden">
                  <div style="height:100%;width:${bs}%;background:${bc}"></div>
                </div>
                <span style="font-size:0.62rem;font-weight:700;color:${bc}">Score: ${bs} · ${bl}</span>
              </div>`;
      })()}
          </div>
        </div>
      </td>
      <td><span class="cat-tag">${p.cat}</span></td>
      <td class="price-col">${priceHtml}</td>
      <td>
        <div class="inv-qty-cell" id="qty-cell-${p.id}">
          ${_renderQtyCell(p.id)}
        </div>
      </td>
      <td><span class="status-badge ${st}"><span class="status-dot"></span>${dotLabel}</span></td>
      <td>
        <div class="row-actions" data-id="${p.id}" data-name="${p.name.replace(/"/g, '&quot;')}">
          <button class="btn-action btn-normal" onclick="rowAct(this,'normal')"   ${st === 'normal' ? 'disabled' : ''}>In Stock</button>
          <button class="btn-action btn-low"    onclick="rowAct(this,'lowstock')" ${st === 'lowstock' ? 'disabled' : ''}>Low Stock</button>
          <button class="btn-action btn-oos"    onclick="rowAct(this,'outofstock')" ${st === 'outofstock' ? 'disabled' : ''}>OOS</button>
          <button class="btn-action btn-sale"   onclick="rowAct(this,'sale')"     ${st === 'sale' ? 'disabled' : ''}>Sale</button>
          <button class="btn-action btn-img"    onclick="rowActImg(this)">Image</button>
          <button class="btn-action btn-del" onclick="rowActDel(this)" title="Delete product">Del</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  renderStats();
  updateSelCount();
}


/*  Row action helpers (avoid quote-escaping in template literals)  */
function _rowData(btn) {
  const div = btn.closest('.row-actions');
  return { id: div.dataset.id, name: div.dataset.name };
}
function rowAct(btn, status) {
  const { id, name } = _rowData(btn);
  setStatus(id, status, name);
}
function rowActImg(btn) {
  const { id, name } = _rowData(btn);
  openChangeImage(id, name);
}
function rowActDel(btn) {
  const { id } = _rowData(btn);
  deleteCustomProduct(id);
}

function renderStats() {
  const stock = getStock();
  const products = allProducts();
  const total = products.length;

  /* Only count stock entries for products that actually exist */
  const productIds = new Set(products.map(p => p.id));
  const validStock = Object.entries(stock).filter(([id]) => productIds.has(id));
  const saleCount = validStock.filter(([, v]) => v === 'sale').length;
  const lowCount = validStock.filter(([, v]) => v === 'lowstock').length;
  const oosCount = validStock.filter(([, v]) => v === 'outofstock').length;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statNormal').textContent = total - saleCount - lowCount - oosCount;
  document.getElementById('statSale').textContent = saleCount;
  document.getElementById('statLow').textContent = lowCount;
  document.getElementById('statOOS').textContent = oosCount;
  _updateRestockBanner();

  /* Also clean up orphaned stock entries */
  if (validStock.length < Object.keys(stock).length) {
    const cleaned = {};
    validStock.forEach(([id, v]) => { cleaned[id] = v; });
    writeLS(STOCK_KEY, cleaned);
  }
  /* Show restore button only when there are hidden built-in products */
  const hiddenCount = (readLS('ds_hidden_products') || []).length;
  const restoreBtn = document.getElementById('restoreHiddenBtn');
  if (restoreBtn) restoreBtn.style.display = hiddenCount > 0 ? '' : 'none';
  if (restoreBtn && hiddenCount > 0) restoreBtn.textContent = 'Restore Hidden (' + hiddenCount + ')';
}

/*  Admin qty helper — render qty cell HTML  */
function _renderQtyCell(productId) {
  if (typeof INVENTORY === 'undefined') return '<span style="color:var(--text3);font-size:0.7rem">N/A</span>';
  const qty = INVENTORY.getQty(productId);
  if (qty === null) return '<span style="color:var(--text3);font-size:0.7rem">N/A</span>';
  const cls = qty === 0 ? 'qty-oos' : qty <= INVENTORY.getLowStockThreshold() ? 'qty-low' : 'qty-ok';
  return `<span class="inv-qty-badge ${cls}" id="qbadge-${productId}">${qty}</span>
    <button class="inv-qty-edit-btn" onclick="openQtyEditor('${productId}')" title="Edit quantity">Edit</button>`;
}

/*  Open inline qty editor  */
function openQtyEditor(productId) {
  const cell = document.getElementById('qty-cell-' + productId);
  if (!cell) return;
  const current = typeof INVENTORY !== 'undefined' ? (INVENTORY.getQty(productId) ?? 0) : 0;
  cell.innerHTML = `
    <div class="inv-qty-editor">
      <input type="number" class="inv-qty-input" id="qinput-${productId}"
             value="${current}" min="0" max="9999"
             onkeydown="if(event.key==='Enter')saveQty('${productId}');if(event.key==='Escape')cancelQtyEdit('${productId}')">
      <button class="inv-qty-save-btn"   onclick="saveQty('${productId}')">Save</button>
      <button class="inv-qty-cancel-btn" onclick="cancelQtyEdit('${productId}')">Cancel</button>
    </div>`;
  const input = document.getElementById('qinput-' + productId);
  if (input) { input.focus(); input.select(); }
}

/*  Save qty from inline editor  */
function saveQty(productId) {
  const input = document.getElementById('qinput-' + productId);
  if (!input) return;
  const newQty = Math.max(0, parseInt(input.value, 10) || 0);
  if (typeof INVENTORY !== 'undefined') {
    INVENTORY.setQty(productId, newQty);
  }
  const cell = document.getElementById('qty-cell-' + productId);
  if (cell) cell.innerHTML = _renderQtyCell(productId);
  /* Sync status badge row */
  renderTable();
  showToast('Stock updated: ' + newQty + ' units');
}

/*  Cancel qty edit  */
function cancelQtyEdit(productId) {
  const cell = document.getElementById('qty-cell-' + productId);
  if (cell) cell.innerHTML = _renderQtyCell(productId);
}

/*  Update restock banner  */
function _updateRestockBanner() {
  const banner = document.getElementById('invRestockBanner');
  if (!banner || typeof INVENTORY === 'undefined') return;
  const products = typeof allProducts === 'function' ? allProducts() : [];
  const oosCount = products.filter(p => INVENTORY.getQty(p.id) === 0).length;
  if (oosCount > 0) {
    banner.classList.add('visible');
    const countEl = banner.querySelector('.inv-restock-count');
    if (countEl) countEl.textContent = oosCount;
  } else {
    banner.classList.remove('visible');
  }
}

function setStatus(productId, status, productName) {
  setStockVal(productId, status, productName);
  /* Auto-sync qty when admin manually marks OOS */
  if (typeof INVENTORY !== 'undefined') {
    if (status === 'outofstock') {
      INVENTORY.setQty(productId, 0);
    } else if (status === 'normal') {
      /* Restore to default if qty was 0 */
      const current = INVENTORY.getQty(productId);
      if (current === 0) INVENTORY.setQty(productId, INVENTORY.getLowStockThreshold() * 2 + 1);
    }
  }
  renderTable();
  const labels = { normal: 'marked In Stock', sale: 'marked On Sale', lowstock: 'marked Low Stock', outofstock: 'marked Out of Stock' };
  showToast(' ' + (productName || productId) + ' ' + (labels[status] || status));
}

function bulkSet(status) {
  if (!selected.size) { showToast('Select products first'); return; }
  bulkSetStockVals([...selected], status, allProducts());
  const labels = { normal: 'reset to In Stock', sale: 'on sale', lowstock: 'low stock', outofstock: 'out of stock' };
  showToast(' ' + selected.size + ' product(s) marked ' + (labels[status] || status));
  selected.clear();
  renderTable();
}

function toggleRow(id, cb) {
  cb.checked ? selected.add(id) : selected.delete(id);
  const row = document.getElementById('row-' + id);
  if (row) row.classList.toggle('selected', cb.checked);
  updateSelCount();
}

function toggleAll(masterCb) {
  filtered.forEach(p => {
    masterCb.checked ? selected.add(p.id) : selected.delete(p.id);
    const row = document.getElementById('row-' + p.id);
    const cb = row && row.querySelector('input[type=checkbox]');
    if (cb) cb.checked = masterCb.checked;
    if (row) row.classList.toggle('selected', masterCb.checked);
  });
  updateSelCount();
}

function updateSelCount() {
  document.getElementById('selCount').textContent =
    selected.size ? selected.size + ' selected' : '0 selected';
}

/**
 * Purge a product from the ENTIRE system — removes all traces from
 * every user's cart, wishlists, builds, stock, inventory, images, packages, etc.
 */
function _purgeProductFromSystem(productId) {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));

  keys.forEach(key => {
    if (!key) return;
    try {
      if (key.includes('cart')) {
        const arr = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(arr)) {
          const cleaned = arr.filter(item => item.productId !== productId);
          if (cleaned.length !== arr.length) localStorage.setItem(key, JSON.stringify(cleaned));
        }
      }
      if (key.includes('wishlist')) {
        const arr = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(arr)) {
          const cleaned = arr.filter(id => id !== productId);
          if (cleaned.length !== arr.length) localStorage.setItem(key, JSON.stringify(cleaned));
        }
      }
      if (key.includes('build')) {
        const obj = JSON.parse(localStorage.getItem(key) || '{}');
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          let changed = false;
          Object.keys(obj).forEach(slot => {
            if (obj[slot] === productId) { delete obj[slot]; changed = true; }
          });
          if (changed) localStorage.setItem(key, JSON.stringify(obj));
        }
      }
      /* Clean from order items — flag deleted product names */
      if (key.includes('orders')) {
        const arr = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(arr)) {
          let changed = false;
          arr.forEach(order => {
            if (order && Array.isArray(order.items)) {
              order.items.forEach(item => {
                if (item.productId === productId && !item.name.includes('[Deleted]')) {
                  item.name = item.name + ' [Deleted]';
                  changed = true;
                }
              });
            }
          });
          if (changed) localStorage.setItem(key, JSON.stringify(arr));
        }
      }
    } catch (e) { }
  });

  /* Clean from custom packages (slot references) */
  try {
    const pkgs = JSON.parse(localStorage.getItem('ds_custom_packages') || 'null');
    if (Array.isArray(pkgs)) {
      let pkgChanged = false;
      pkgs.forEach(pkg => {
        if (pkg && pkg.slots) {
          Object.keys(pkg.slots).forEach(slot => {
            if (pkg.slots[slot] === productId) {
              delete pkg.slots[slot];
              pkgChanged = true;
            }
          });
        }
      });
      if (pkgChanged) localStorage.setItem('ds_custom_packages', JSON.stringify(pkgs));
    }
  } catch (e) { }

  const stock = readLS(STOCK_KEY) || {};
  if (stock[productId] !== undefined) { delete stock[productId]; writeLS(STOCK_KEY, stock); }

  const saleCfg = readLS('ds_sale_config') || {};
  if (saleCfg[productId] !== undefined) { delete saleCfg[productId]; writeLS('ds_sale_config', saleCfg); }

  /* Also clean from the inventory tracking key */
  const invTrack = readLS('ds_inv') || {};
  if (invTrack[productId] !== undefined) { delete invTrack[productId]; writeLS('ds_inv', invTrack); }

  try { localStorage.removeItem('ds_reviews_' + productId); } catch (e) { }

  const imgs = getCustomImages(); if (imgs[productId]) { delete imgs[productId]; writeLS(IMG_KEY, imgs); }
  const desc = getCustomDescs(); if (desc[productId]) { delete desc[productId]; writeLS(DESC_KEY, desc); }

  const hidden = readLS('ds_hidden_products') || [];
  const hidIdx = hidden.indexOf(productId);
  if (hidIdx !== -1) { hidden.splice(hidIdx, 1); writeLS('ds_hidden_products', hidden); }

  /* ── Broadcast to trigger real-time UI updates ─────────── */
  try {
    /* Cross-tab sync via StorageEvent */
    window.dispatchEvent(new StorageEvent('storage', { key: 'ds_custom_products' }));
    window.dispatchEvent(new StorageEvent('storage', { key: STOCK_KEY }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'ds_custom_packages' }));

    /* Custom event for same-tab listeners (cart, wishlist, builder) */
    window.dispatchEvent(new CustomEvent('ds:product:deleted', { detail: { productId } }));
  } catch (e) { }

  /* ── Refresh all visible UI indicators ────────────────── */
  /* Cart count */
  if (typeof renderNav === 'function') try { renderNav(); } catch (e) { }
  if (typeof renderCart === 'function') try { renderCart(); } catch (e) { }
  /* Wishlist badge — remove from in-memory list if loaded */
  if (typeof _wishlist !== 'undefined' && Array.isArray(_wishlist)) {
    const wIdx = _wishlist.indexOf(productId);
    if (wIdx !== -1) _wishlist.splice(wIdx, 1);
  }
  if (typeof _updateWishlistBadge === 'function') try { _updateWishlistBadge(); } catch (e) { }
  /* Builder slots */
  if (typeof renderBuilder === 'function') try { renderBuilder(); } catch (e) { }
  /* Store grid */
  if (typeof renderStore === 'function') try { renderStore(); } catch (e) { }
  /* Flash deals */
  if (typeof renderDeals === 'function') try { renderDeals(); } catch (e) { }
  /* Packages */
  if (typeof renderFeaturedPackages === 'function') try { renderFeaturedPackages(); } catch (e) { }
  if (typeof renderAllPackages === 'function') try { renderAllPackages(); } catch (e) { }
}

function deleteCustomProduct(id) {
  const isCustom = getCustomProducts().some(p => p.id === id);
  const allP = allProducts();
  const name = (allP.find(p => p.id === id) || {}).name || id;

  if (isCustom) {
    if (!confirm('Permanently delete "' + name + '"?\n\nThis will remove it from:\n\u2022 All user carts\n\u2022 All wishlists\n\u2022 All PC builds\n\u2022 Inventory & stock status\n\u2022 Flash Deals (if on sale)\n\nThis cannot be undone.')) return;
    writeLS(CUSTOM_KEY, getCustomProducts().filter(p => p.id !== id));
  } else {
    if (!confirm('Hide "' + name + '" from the store?\n\nThis will also clean it from all carts, builds, and wishlists.\nYou can restore it later.')) return;
    const hidden = readLS('ds_hidden_products') || [];
    if (!hidden.includes(id)) hidden.push(id);
    writeLS('ds_hidden_products', hidden);
  }

  _purgeProductFromSystem(id);

  pushAudit({ type: 'product_deleted', action: 'deleted', productId: id, productName: name });

  /* Sync deletion to Supabase */
  if (typeof SB !== 'undefined') SB.deleteProduct(id);

  renderTable();
  renderRecentList();
  showToast(isCustom ? 'Product deleted & purged from all users' : 'Product hidden & cleaned from all users');
}

/**
 * Robust cleanup for a product ID across all system state.
 * Removes the product from carts, wishlists, and active builds.
 */
function _purgeProductFromSystem(id) {
  // 1. Clean cart
  const cart = readLS('cart') || [];
  const newCart = cart.filter(item => item.productId !== id);
  if (cart.length !== newCart.length) writeLS('cart', newCart);

  // 2. Clean wishlists
  const wish = readLS('wishlist') || [];
  const newWish = wish.filter(pid => pid !== id);
  if (wish.length !== newWish.length) writeLS('wishlist', newWish);

  // 3. Clean active build
  const build = readLS('build') || {};
  let changedBuild = false;
  for (const slot in build) {
    if (build[slot] === id) {
      delete build[slot];
      changedBuild = true;
    }
  }
  if (changedBuild) writeLS('build', build);

  // 4. Clean stock status
  const stock = getStock();
  if (stock[id]) {
    delete stock[id];
    writeLS(STOCK_KEY, stock);
  }

  // 5. Clean custom images/descs
  const imgs = getCustomImages();
  if (imgs[id]) {
    delete imgs[id];
    writeLS(IMG_KEY, imgs);
  }
  const descs = getCustomDescs();
  if (descs[id]) {
    delete descs[id];
    writeLS(DESC_KEY, descs);
  }

  // 6. Force sync/render updates if on main pages
  if (typeof renderNav === 'function') renderNav();
  if (typeof renderCart === 'function') renderCart();
}

/* 
   PANEL 2 — ADD PRODUCT
 */
let newImgBase64 = null;

function setupAddProduct() {
  const zone = document.getElementById('imgUploadZone');
  const input = document.getElementById('imgFileInput');
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--accent)'; });
  zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
  zone.addEventListener('drop', e => { e.preventDefault(); zone.style.borderColor = ''; if (e.dataTransfer.files[0]) processImageFile(e.dataTransfer.files[0]); });
  input.addEventListener('change', () => { if (input.files[0]) processImageFile(input.files[0]); });
  ['apName', 'apPricePHP', 'apSpecs'].forEach(id => document.getElementById(id).addEventListener('input', updatePreview));

  // Category change: show Image URL field for Laptop, hide for others
  document.getElementById('apCat').addEventListener('change', function () {
    const isLaptop = this.value === 'Laptop';
    const urlGroup = document.getElementById('apImageUrlGroup');
    if (urlGroup) urlGroup.style.display = isLaptop ? '' : 'none';
    updatePreview();
  });

  // Image URL live preview
  document.getElementById('apImageUrl').addEventListener('input', function () {
    const preview = document.getElementById('apImageUrlPreview');
    const img = document.getElementById('apImageUrlImg');
    const url = this.value.trim();
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      img.src = url;
      img.onerror = function () { preview.style.display = 'none'; };
      img.onload = function () { preview.style.display = ''; };
    } else {
      preview.style.display = 'none';
    }
    updatePreview();
  });

  renderRecentList();
  updatePreview();
}

function processImageFile(file) {
  if (!file.type.startsWith('image/')) { showToast('Please select an image file'); return; }
  if (file.size > 4 * 1024 * 1024) { showToast('Image must be under 4 MB'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    newImgBase64 = e.target.result;
    const zone = document.getElementById('imgUploadZone');
    zone.classList.add('has-img');
    zone.innerHTML = `<div class="upload-img-wrap"><img src="${newImgBase64}" alt="preview" style="max-width:100%;max-height:140px;object-fit:contain;border-radius:6px;display:block;margin:0 auto"></div><button class="btn-remove-img" onclick="removeNewImage(event)">Remove image</button>`;
    updatePreview();
  };
  reader.readAsDataURL(file);
}

function removeNewImage(e) {
  e.stopPropagation();
  newImgBase64 = null;
  const zone = document.getElementById('imgUploadZone');
  zone.classList.remove('has-img');
  zone.innerHTML = `<div class="upload-icon">&#128444;</div><div class="upload-label">Click or drag image here</div><div class="upload-hint">JPG, PNG, WebP — max 4 MB</div>`;
  updatePreview();
}

function updatePreview() {
  const name = (document.getElementById('apName').value || '').trim();
  const cat = document.getElementById('apCat').value || '';
  const php = parseFloat(document.getElementById('apPricePHP').value) || 0;
  const specs = (document.getElementById('apSpecs').value || '').trim();
  const imgEl = document.getElementById('previewImg');
  const _prevUrl = (document.getElementById('apImageUrl')?.value || '').trim();
  if (newImgBase64) {
    imgEl.innerHTML = `<img src="${newImgBase64}" alt="preview" style="width:100%;height:100%;object-fit:cover;border-radius:6px">`;
  } else if (_prevUrl) {
    imgEl.innerHTML = `<img src="${_prevUrl}" alt="preview" style="width:100%;height:100%;object-fit:cover;border-radius:6px" onerror="this.parentElement.innerHTML=cat||'PRODUCT'">`;
  } else {
    imgEl.innerHTML = cat || 'PRODUCT';
  }
  document.getElementById('previewName').textContent = name || 'Product Name';
  document.getElementById('previewCat').textContent = cat || 'Category';
  document.getElementById('previewSpecs').textContent = specs || 'Specifications will appear here';
  document.getElementById('previewPrice').textContent = php > 0 ? '&#8369;' + Math.round(php).toLocaleString() : '&#8369;0';
}

function submitAddProduct(e) {
  e.preventDefault();
  const name = document.getElementById('apName').value.trim();
  const cat = document.getElementById('apCat').value;
  const php = parseFloat(document.getElementById('apPricePHP').value);
  const specs = document.getElementById('apSpecs').value.trim();
  const desc = document.getElementById('apDesc').value.trim();
  const benchRaw = document.getElementById('apBenchScore')?.value;
  const bench = benchRaw !== '' && benchRaw !== undefined ? Math.min(200, Math.max(0, parseInt(benchRaw) || 0)) : null;

  const socket = document.getElementById('apSocket')?.value || null;
  const memType = document.getElementById('apMemType')?.value || null;

  const wattage = parseInt(document.getElementById('apWattage')?.value) || 0;
  const tdp = parseInt(document.getElementById('apTDP')?.value) || 0;
  const power = parseInt(document.getElementById('apGpuPower')?.value) || 0;

  const gpuLength = parseInt(document.getElementById('apGpuLength')?.value) || 0;
  const maxGpuLen = parseInt(document.getElementById('apMaxGpuLength')?.value) || 0;
  const formFactor = document.getElementById('apFormFactor')?.value || null;
  const suppFf = document.getElementById('apSupportedFf')?.value || null;

  if (!name) { showToast('Enter a product name'); return; }
  if (!cat) { showToast('Select a category'); return; }
  if (!php || php <= 0) { showToast('Enter a valid price'); return; }
  if (!specs) { showToast('Enter specifications'); return; }

  /* Benchmark validation: CPU, GPU, RAM, Storage MUST have a score > 0.
     Other categories (Motherboard, PSU, Cooling, Case, Laptop) can skip. */
  const BENCH_REQUIRED_CATS = ['CPU', 'GPU', 'RAM', 'Storage'];
  if (BENCH_REQUIRED_CATS.includes(cat)) {
    if (bench === null || bench <= 0 || bench > 200) {
      showToast(cat + ' products require a Benchmark Score (1\u2013200)');
      return;
    }
  } else {
    if (bench !== null && (bench < 0 || bench > 200)) {
      showToast('Benchmark Score must be 0\u2013200'); return;
    }
  }

  const id = 'custom_' + Date.now();
  const prod = { id, name, cat, price: +(php / 57).toFixed(4), specs, socket, memType };
  if (bench !== null) prod.benchScore = bench;
  if (wattage > 0) prod.wattage = wattage;
  if (tdp > 0) prod.tdp = tdp;
  if (power > 0) prod.power = power;

  if (gpuLength > 0) prod.length_mm = gpuLength;
  if (maxGpuLen > 0) prod.max_gpu_length = maxGpuLen;
  if (formFactor) prod.form_factor = formFactor;
  if (suppFf) prod.supported_form_factors = suppFf;

  // Local storage to keep existing app functional
  const customs = getCustomProducts(); customs.push(prod); writeLS(CUSTOM_KEY, customs);

  // Decide which image to store: uploaded file takes priority over URL
  const _imgUrlInput = (document.getElementById('apImageUrl')?.value || '').trim();
  let imageUrl = '';
  if (newImgBase64) {
    const imgs = getCustomImages(); imgs[id] = newImgBase64; writeLS(IMG_KEY, imgs);
    imageUrl = newImgBase64;
  } else if (_imgUrlInput && cat === 'Laptop') {
    const imgs = getCustomImages(); imgs[id] = _imgUrlInput; writeLS(IMG_KEY, imgs);
    imageUrl = _imgUrlInput;
  }

  if (desc) { const descs = getCustomDescs(); descs[id] = desc; writeLS(DESC_KEY, descs); }

  /* ── Sync to Supabase ── */
  if (typeof SB !== 'undefined') {
    SB.pushProduct({
      id, name, cat, price: prod.price, specs,
      description: desc, imageUrl: imageUrl,
      benchScore: bench || 0,
      stockStatus: 'normal', stockQty: 50,
      socket, memType,
    });
  }

  pushAudit({ type: 'product_added', action: 'added', productId: id, productName: name, category: cat, pricePHP: Math.round(php) });
  showToast(name + ' added to store!');
  resetAddForm();
  renderRecentList();
  renderStats();
}

function resetAddForm() {
  document.getElementById('addProductForm').reset();
  newImgBase64 = null;
  const zone = document.getElementById('imgUploadZone');
  zone.classList.remove('has-img');
  zone.innerHTML = `<div class="upload-icon">&#128444;</div><div class="upload-label">Click or drag image here</div><div class="upload-hint">JPG, PNG, WebP — max 4 MB</div>`;
  // Reset power + physical fields
  if (document.getElementById('apPowerGroup')) {
    ['apPowerGroup', 'apWattageGroup', 'apTDPGroup', 'apGpuPowerGroup', 'apPhysicalGroup',
      'apGpuLengthGroup', 'apMaxGpuLengthGroup', 'apFormFactorGroup', 'apSupportedFfGroup'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
    ['apWattage', 'apTDP', 'apGpuPower', 'apGpuLength', 'apMaxGpuLength', 'apFormFactor', 'apSupportedFf'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  }

  // Reset benchmark score preview
  updateBenchPreview('');
  updatePreview();
}

/* ── Benchmark score live preview bar ── */
function updateBenchPreview(val) {
  const fill = document.getElementById('benchScoreFill');
  const label = document.getElementById('benchScoreLabel');
  if (!fill || !label) return;
  const score = Math.min(100, Math.max(0, parseInt(val) || 0));
  const pct = val === '' || val === null ? 0 : score;
  fill.style.width = pct + '%';

  let color = '#6b7280';  // grey = not set
  let text = 'Not set';
  if (pct >= 95) { color = '#ef4444'; text = 'Flagship'; }
  else if (pct >= 80) { color = '#f97316'; text = 'High-End'; }
  else if (pct >= 55) { color = '#2563eb'; text = 'Mid-Range'; }
  else if (pct >= 30) { color = '#22c55e'; text = 'Budget'; }
  else if (pct >= 1) { color = '#94a3b8'; text = 'Entry-Level'; }

  if (val === '' || val === undefined) { fill.style.background = '#6b7280'; label.textContent = 'Not set'; label.style.color = 'var(--text3)'; return; }
  fill.style.background = color;
  label.textContent = score + ' — ' + text;
  label.style.color = color;
}

function renderRecentList() {
  const customs = getCustomProducts();
  const imgs = getCustomImages();
  const el = document.getElementById('recentList');
  if (!customs.length) {
    el.innerHTML = '<div style="font-size:0.78rem;color:var(--text3);padding:0.5rem 0">No custom products added yet.</div>';
    return;
  }
  el.innerHTML = [...customs].reverse().slice(0, 8).map(p => {
    const imgSrc = imgs[p.id];
    const thumb = imgSrc
      ? `<div class="recent-thumb"><img src="${imgSrc}" alt="${p.name}"></div>`
      : `<div class="recent-thumb">${p.cat.slice(0, 3)}</div>`;
    return `<div class="recent-item">${thumb}<div class="recent-info"><div class="recent-name">${p.name}</div><div class="recent-price">&#8369;${Math.round(p.price * 57).toLocaleString()}</div></div><button class="btn-recent-del" onclick="deleteCustomProduct('${p.id}')">&#x2715;</button></div>`;
  }).join('');
}

/* 
   PANEL 3 — ORDERS
 */

/* Collect every order object stored across all localStorage keys.
   Returns array sorted newest-first; each item carries a _key
   property so we know which storage key to write back to.        */
function _getAllOrders() {
  const allOrders = [];
  const seen = new Set();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.includes('orders')) continue;
    try {
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(arr)) {
        arr.forEach(o => {
          if (o && o.id && !seen.has(o.id)) {
            seen.add(o.id);
            allOrders.push({ ...o, _key: key });
          }
        });
      }
    } catch { }
  }
  allOrders.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return allOrders;
}

/* Persist a mutation (mutateFn receives the order object) back to the
   correct localStorage key, then optionally refreshes the view.      */
function _mutateOrder(orderId, mutateFn) {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.includes('orders')) continue;
    try {
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(arr)) continue;
      let changed = false;
      arr.forEach(o => { if (o && o.id === orderId) { mutateFn(o); changed = true; } });
      if (changed) localStorage.setItem(key, JSON.stringify(arr));
    } catch { }
  }
}

/* Completely remove an order from every localStorage key that holds it. */
function _deleteOrderFromStorage(orderId) {
  /* Snapshot keys first — iterating while deleting can skip entries */
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.includes('orders')) keys.push(k);
  }
  keys.forEach(key => {
    try {
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(arr)) return;
      const next = arr.filter(o => !(o && o.id === orderId));
      if (next.length !== arr.length) localStorage.setItem(key, JSON.stringify(next));
    } catch { }
  });
}

/* Change the status of an order and re-render the panel. */
function setOrderStatus(orderId, newStatus) {
  _mutateOrder(orderId, o => { o.status = newStatus; });
  pushAudit({ type: 'order_status_change', orderId, newStatus });

  /* Push status notification to the customer who placed the order */
  if (typeof NOTIFY !== 'undefined') {
    // Find the order to get its userId if stored
    const allOrders = _getAllOrders();
    const order = allOrders.find(o => o.id === orderId);
    const userId = order?.userId || null;
    NOTIFY.pushOrderStatus(orderId, newStatus, userId);
  } else if (typeof pushNotification === 'function') {
    pushNotification(orderId, newStatus); // legacy fallback
  }

  renderOrders();
  showToast('Order ' + orderId + ' marked ' + newStatus);
}

/* Delete an order entirely (with confirmation). */
function deleteOrder(orderId) {
  if (!confirm('Permanently delete order ' + orderId + '? This cannot be undone.')) return;
  _deleteOrderFromStorage(orderId);
  pushAudit({ type: 'order_deleted', orderId });
  /* Sync to Supabase */
  if (typeof SB !== 'undefined') SB.deleteOrder(orderId);
  renderOrders();
  showToast('Order ' + orderId + ' deleted');
}

function renderOrders() {
  const allOrders = _getAllOrders();
  const proc = allOrders.filter(o => o.status === 'processing').length;
  const shipped = allOrders.filter(o => o.status === 'shipped').length;
  const delivered = allOrders.filter(o => o.status === 'delivered').length;
  const cancelled = allOrders.filter(o => o.status === 'cancelled').length;

  document.getElementById('orderStatTotal').textContent = allOrders.length;
  document.getElementById('orderStatProc').textContent = proc;
  document.getElementById('orderStatShipped').textContent = shipped;
  document.getElementById('orderStatDelivered').textContent = delivered;

  const tbody = document.getElementById('ordersTableBody');
  if (!allOrders.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No orders placed yet.</td></tr>';
    return;
  }

  const STATUS_LIST = ['processing', 'shipped', 'delivered', 'cancelled'];

  tbody.innerHTML = allOrders.map(o => {
    const st = o.status || 'processing';
    const itemPreview = (o.items || []).slice(0, 2)
      .map(i => i.name + (i.qty > 1 ? ' ×' + i.qty : '')).join(', ')
      + ((o.items || []).length > 2 ? ' +' + (o.items.length - 2) + ' more' : '');

    /* Status change buttons — current status is disabled */
    const statusBtns = STATUS_LIST.map(s => {
      const cls = {
        processing: 'btn-ord-proc', shipped: 'btn-ord-ship',
        delivered: 'btn-ord-delv', cancelled: 'btn-ord-canc'
      }[s];
      return `<button class="btn-action ${cls}" onclick="setOrderStatus('${o.id}','${s}')"
        ${st === s ? 'disabled' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</button>`;
    }).join('');

    return `<tr id="orow-${o.id}">
      <td>
        <div class="order-id-cell">${o.id || '—'}</div>
        <div class="order-date-cell">${o.date || ''}</div>
      </td>
      <td><div class="order-cust-cell">${o.customer || '—'}</div></td>
      <td>
        <div class="order-items-cell">${itemPreview || '—'}</div>
        <div class="order-count-cell">${(o.items || []).length} item(s)</div>
      </td>
      <td><span class="order-total-cell">&#8369;${o.total || '0'}</span></td>
      <td><span class="ot-status ${st}">${st}</span></td>
      <td>
        <div class="order-row-actions">
          ${statusBtns}
          <button class="btn-admin-chat" onclick="openAdminChat('${o.id}','${o.userId || ''}')"> Chat</button>
          <button class="btn-action btn-ord-del" onclick="deleteOrder('${o.id}')">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* 
   PANEL 4 — AUDIT TRAIL
 */
let auditTypeFilter = 'all';

function renderAudit() {
  const log = readLS(AUDIT_KEY) || [];
  const typeFilter = document.getElementById('auditTypeFilter')?.value || 'all';

  const filtered = typeFilter === 'all' ? log : log.filter(e => e.type === typeFilter);

  const el = document.getElementById('auditList');

  if (!filtered.length) {
    el.innerHTML = '<div class="audit-empty">No audit entries yet. Actions like status changes, orders, and product additions will appear here.</div>';
    return;
  }

  el.innerHTML = filtered.map(entry => {
    const ts = entry.ts ? new Date(entry.ts) : null;
    const timeStr = ts ? ts.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + ts.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—';

    let iconClass = entry.type || 'status_change';
    const _isOrderEvt = entry.type === 'order_placed' || entry.type === 'order_status_change' || entry.type === 'order_deleted';
    let iconChar = _isOrderEvt ? '' : entry.type === 'product_added' ? '&#43;' : '&#8644;';
    let actionHtml = '';
    let detailHtml = '';

    if (entry.type === 'status_change') {
      const oldColor = { normal: 'var(--green)', lowstock: 'var(--orange)', outofstock: 'var(--red)', sale: 'var(--yellow)' }[entry.oldStatus] || 'var(--text3)';
      const newColor = { normal: 'var(--green)', lowstock: 'var(--orange)', outofstock: 'var(--red)', sale: 'var(--yellow)' }[entry.newStatus] || 'var(--text3)';
      actionHtml = `Status changed <span class="audit-type-badge badge-status">INVENTORY</span>`;
      detailHtml = `${entry.productName || entry.productId} &nbsp;&#8212;&nbsp; <span style="color:${oldColor}">${entry.oldStatus || 'normal'}</span> <span class="status-arrow">&#8594;</span> <span style="color:${newColor}">${entry.newStatus || '?'}</span>`;
    } else if (entry.type === 'order_placed') {
      actionHtml = `Order placed <span class="audit-type-badge badge-order">ORDER</span>`;
      detailHtml = `${entry.orderId || '—'} &nbsp;&#8212;&nbsp; ${entry.customer || 'Guest'} &nbsp;&#8212;&nbsp; &#8369;${entry.total || '0'} &nbsp;(${entry.itemCount || 0} item${(entry.itemCount || 0) !== 1 ? 's' : ''})`;
    } else if (entry.type === 'order_status_change') {
      const sColor = { processing: 'var(--orange)', shipped: 'var(--accent)', delivered: 'var(--green)', cancelled: 'var(--red)' }[entry.newStatus] || 'var(--text3)';
      actionHtml = `Order status updated <span class="audit-type-badge badge-order">ORDER</span>`;
      detailHtml = `${entry.orderId || '—'} &nbsp;&#8212;&nbsp; <span style="color:${sColor}">${entry.newStatus || '?'}</span>`;
    } else if (entry.type === 'order_deleted') {
      actionHtml = `Order deleted <span class="audit-type-badge badge-del">ORDER</span>`;
      detailHtml = `${entry.orderId || '—'}`;
    } else if (entry.type === 'product_added') {
      const verb = entry.action === 'deleted' ? 'deleted' : 'added';
      actionHtml = `Product ${verb} <span class="audit-type-badge badge-product">PRODUCT</span>`;
      detailHtml = `${entry.productName || entry.productId}` + (entry.pricePHP ? ` &nbsp;&#8212;&nbsp; &#8369;${entry.pricePHP.toLocaleString()}` : '') + (entry.category ? ` &nbsp;&#8212;&nbsp; ${entry.category}` : '');
    } else {
      actionHtml = entry.type || 'Unknown action';
      detailHtml = JSON.stringify(entry).slice(0, 80);
    }

    return `<div class="audit-entry">
      <div class="audit-icon ${iconClass}">${iconChar}</div>
      <div class="audit-meta">
        <div class="audit-action">${actionHtml}</div>
        <div class="audit-detail">${detailHtml}</div>
      </div>
      <div class="audit-ts">${timeStr}</div>
    </div>`;
  }).join('');
}


/* 
   CHANGE PRODUCT IMAGE
 */
function openChangeImage(productId, productName) {
  const modal = document.getElementById('changeImageModal');
  document.getElementById('changeImgProductName').textContent = productName;
  document.getElementById('changeImgProductId').value = productId;
  document.getElementById('changeImgPreview').src = '';
  document.getElementById('changeImgPreview').style.display = 'none';
  document.getElementById('changeImgPlaceholder').style.display = 'flex';
  document.getElementById('changeImgFileInput').value = '';
  document.getElementById('changeImgNewBase64').value = '';
  modal.classList.add('open');
}

function closeChangeImage() {
  document.getElementById('changeImageModal').classList.remove('open');
}

function changeImgFileSelected(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 4 * 1024 * 1024) { showToast('Image too large — max 4 MB', 'error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const b64 = e.target.result;
    document.getElementById('changeImgNewBase64').value = b64;
    document.getElementById('changeImgPreview').src = b64;
    document.getElementById('changeImgPreview').style.display = 'block';
    document.getElementById('changeImgPlaceholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function confirmChangeImage() {
  const id = document.getElementById('changeImgProductId').value;
  const b64 = document.getElementById('changeImgNewBase64').value;
  if (!b64) { showToast('Please select an image first', 'error'); return; }
  const imgs = getCustomImages();
  imgs[id] = b64;
  writeLS(IMG_KEY, imgs);
  pushAudit({ type: 'status_change', productId: id, note: 'Product image updated' });
  closeChangeImage();
  renderTable();
  showToast('Image updated successfully', 'success');
}

function removeProductImage(productId) {
  if (!confirm('Remove the custom image for this product?')) return;
  const imgs = getCustomImages();
  delete imgs[productId];
  writeLS(IMG_KEY, imgs);
  closeChangeImage();
  renderTable();
  showToast('Image removed', 'success');
}

function restoreHiddenProducts() {
  if (!confirm('Restore all hidden built-in products? They will reappear in the store.')) return;
  writeLS('ds_hidden_products', []);
  renderTable();
  renderStats();
  showToast('All hidden products restored');
}

function clearAuditLog() {
  if (!confirm('Clear the entire audit log? This cannot be undone.')) return;
  writeLS(AUDIT_KEY, []);
  renderAudit();
  showToast('Audit log cleared');
}

/*  TOAST  */
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

/* ══════════════════════════════════
   PANEL 5 — PACKAGES MANAGER
══════════════════════════════════ */

const PKG_STORE_KEY = 'ds_custom_packages';
const SLOT_KEYS = ['CPU', 'GPU', 'Motherboard', 'RAM', 'Storage', 'PSU', 'Cooling', 'Case'];
const SLOT_LABELS = {
  CPU: 'Processor', GPU: 'Graphics Card', Motherboard: 'Motherboard',
  RAM: 'Memory', Storage: 'Storage', PSU: 'Power Supply',
  Cooling: 'CPU Cooler', Case: 'Case'
};

function adminGetPackages() {
  try {
    const saved = JSON.parse(localStorage.getItem(PKG_STORE_KEY) || 'null');
    if (saved && Array.isArray(saved)) return saved;
  } catch (e) { }
  return typeof PACKAGES !== 'undefined' ? JSON.parse(JSON.stringify(PACKAGES)) : [];
}

function adminSavePackages(pkgs) {
  writeLS(PKG_STORE_KEY, pkgs);
  try { localStorage.setItem('ds_packages_updated', Date.now()); } catch (e) { }
}

function adminResetPackages() {
  if (!confirm('Reset all packages to defaults? Your custom changes will be lost.')) return;
  localStorage.removeItem(PKG_STORE_KEY);
  adminRenderPackages();
  showToast('Packages reset to defaults');
}

function adminRenderPackages() {
  const el = document.getElementById('pkgAdminGrid');
  if (!el) return;
  const pkgs = adminGetPackages();

  if (!pkgs.length) {
    el.innerHTML = '<div style="color:var(--text3);padding:2rem;text-align:center">No packages yet. Click + New Package to create one.</div>';
    return;
  }

  el.innerHTML = pkgs.map((pkg, idx) => {
    const slots = pkg.slots || {};
    const compRows = SLOT_KEYS.map(k => {
      if (!slots[k]) return '';
      const p = (typeof getProduct === 'function') ? getProduct(slots[k]) : null;
      const name = p ? p.name : slots[k];
      return `<div style="display:flex;justify-content:space-between;gap:.5rem;font-size:.72rem;padding:.18rem 0;border-bottom:1px solid var(--border)">
        <span style="color:var(--text3);min-width:80px;flex-shrink:0">${SLOT_LABELS[k] || k}</span>
        <span style="color:var(--text);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</span>
      </div>`;
    }).join('');

    const phpTotal = SLOT_KEYS.reduce((sum, k) => {
      if (!slots[k]) return sum;
      const p = (typeof getProduct === 'function') ? getProduct(slots[k]) : null;
      return sum + (p ? p.price * 57 : 0);
    }, 0);

    return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1.1rem;margin-bottom:1rem;border-left:3px solid ${pkg.color || 'var(--accent)'}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.6rem;gap:.5rem;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
          <span style="font-family:'Bebas Neue',sans-serif;font-size:1.15rem;letter-spacing:1px;color:var(--text)">${pkg.name}</span>
          <span style="font-size:.68rem;padding:2px 7px;border-radius:4px;background:var(--s2);color:var(--accent);font-family:'JetBrains Mono',monospace">${pkg.category}</span>
          ${pkg.featured ? '<span style="font-size:.65rem;padding:2px 7px;border-radius:4px;background:rgba(245,158,11,0.15);color:var(--yellow)">FEATURED</span>' : ''}
        </div>
        <div style="display:flex;gap:.4rem">
          <button class="btn-action btn-normal" onclick="adminOpenEditPkg(${idx})" style="font-size:.72rem;padding:.25rem .65rem">Edit</button>
          <button class="btn-action btn-del"    onclick="adminDeletePkg(${idx})"   style="font-size:.72rem;padding:.25rem .65rem">Delete</button>
        </div>
      </div>
      <div style="font-size:.76rem;color:var(--text3);margin-bottom:.6rem;font-style:italic">${pkg.tagline || ''}</div>
      <div>${compRows}</div>
      <div style="font-size:.82rem;font-family:'JetBrains Mono',monospace;color:var(--accent);margin-top:.6rem">&#8369;${Math.round(phpTotal).toLocaleString()}</div>
    </div>`;
  }).join('');
}

let _editPkgIdx = null;

function adminOpenNewPkg() {
  _editPkgIdx = null;
  document.getElementById('pkgEditModalTitle').textContent = 'New Package';
  document.getElementById('peditName').value = '';
  document.getElementById('peditTagline').value = '';
  document.getElementById('peditCat').value = 'Gaming';
  document.getElementById('peditFeatured').checked = false;
  _renderPeditSlots({});
  document.getElementById('pkgEditModal').classList.add('open');
}

function adminOpenEditPkg(idx) {
  const pkgs = adminGetPackages();
  const pkg = pkgs[idx];
  if (!pkg) return;
  _editPkgIdx = idx;
  document.getElementById('pkgEditModalTitle').textContent = 'Edit Package';
  document.getElementById('peditName').value = pkg.name;
  document.getElementById('peditTagline').value = pkg.tagline || '';
  document.getElementById('peditCat').value = pkg.category || 'Gaming';
  document.getElementById('peditFeatured').checked = !!pkg.featured;
  _renderPeditSlots(pkg.slots || {});
  document.getElementById('pkgEditModal').classList.add('open');
}

function closePkgEditModal() {
  document.getElementById('pkgEditModal').classList.remove('open');
}

function _renderPeditSlots(currentSlots) {
  const el = document.getElementById('peditSlots');
  if (!el) return;
  function opts(cat, selectedId) {
    const prods = (typeof getProductsByCategory === 'function') ? getProductsByCategory(cat) : [];
    return prods.map(p =>
      `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.name}</option>`
    ).join('');
  }
  el.innerHTML = SLOT_KEYS.map(k => `
    <div style="display:grid;grid-template-columns:110px 1fr;gap:.5rem;align-items:center">
      <label style="font-size:.75rem;color:var(--text3);font-family:'JetBrains Mono',monospace">${SLOT_LABELS[k] || k}</label>
      <select class="form-select" id="pedit_slot_${k}" style="font-size:.75rem;padding:.3rem .5rem">
        <option value="">— None —</option>
        ${opts(k, currentSlots[k] || '')}
      </select>
    </div>`).join('');
}

function savePkgEdit() {
  const name = document.getElementById('peditName').value.trim();
  const tagline = document.getElementById('peditTagline').value.trim();
  const cat = document.getElementById('peditCat').value;
  const featured = document.getElementById('peditFeatured').checked;
  if (!name) { showToast('Enter a package name'); return; }
  if (!tagline) { showToast('Enter a tagline'); return; }
  const slots = {};
  SLOT_KEYS.forEach(k => {
    const val = document.getElementById('pedit_slot_' + k)?.value;
    if (val) slots[k] = val;
  });
  if (!Object.keys(slots).length) { showToast('Select at least one component'); return; }

  const pkgs = adminGetPackages();
  if (_editPkgIdx === null) {
    const id = 'pkg_admin_' + Date.now();
    const colors = ['#22c55e', '#ef4444', '#f59e0b', '#a855f7', '#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899'];
    const color = colors[pkgs.length % colors.length];
    pkgs.push({ id, name, category: cat, icon: '', tagline, color, featured, slots });
    pushAudit({ type: 'product_added', action: 'added', productId: id, productName: name, category: 'Package' });
    showToast(name + ' created!');
  } else {
    const existing = pkgs[_editPkgIdx];
    pkgs[_editPkgIdx] = { ...existing, name, category: cat, tagline, featured, slots };
    pushAudit({ type: 'product_added', action: 'added', productId: existing.id, productName: name, category: 'Package (edited)' });
    showToast(name + ' saved!');
  }
  adminSavePackages(pkgs);
  closePkgEditModal();
  adminRenderPackages();
}

function adminDeletePkg(idx) {
  const pkgs = adminGetPackages();
  const pkg = pkgs[idx];
  if (!pkg) return;
  if (!confirm('Delete "' + pkg.name + '"? This cannot be undone.')) return;
  pkgs.splice(idx, 1);
  adminSavePackages(pkgs);
  pushAudit({ type: 'product_added', action: 'deleted', productId: pkg.id, productName: pkg.name, category: 'Package' });
  /* Sync to Supabase */
  if (typeof SB !== 'undefined') SB.deletePackage(pkg.id);
  adminRenderPackages();
  showToast('Package deleted');
}

/*  INIT  */
renderTable();
setupAddProduct();
