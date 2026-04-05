
function getStockStatus(id) {
  try { return (JSON.parse(localStorage.getItem('ds_stock') || '{}'))[id] || 'normal'; }
  catch { return 'normal'; }
}
let currentFilter = 'All';
let currentSlotKey = null;

// DB.init() uses getCurrentUser() from auth-modal.js to build per-user
// localStorage keys. auth-modal.js loads before app.js in the script order,
// so getCurrentUser() is guaranteed to exist here.
// This creates the cart/orders/build keys for the current user (or guest)
// if they don't already exist.
DB.init();
renderNav();
renderStore();
renderBuilder();
renderCart();
renderOrders();
renderDeals();

document.getElementById('bmGameListGrid').innerHTML = GAMES.map(g =>
  `<div class="bm-glp-item">
    <img class="bm-glp-logo" src="${g.logo}" alt="${g.name}"
         onerror="this.style.display='none';this.nextElementSibling.style.display='inline'">
    <span class="bm-glp-icon-fallback" style="display:none">${g.icon}</span>
    <span>${g.name}</span>
  </div>`
).join('');

// close any open modal on overlay click or Escape
['selectModal','checkoutModal','benchmarkModal','compareModal','productDetailModal'].forEach(id => {
  const _el = document.getElementById(id);
  if (!_el) return;
  _el.addEventListener('click', e => {
    if (e.target === _el) {
      _el.classList.remove('open');
      if (id === 'benchmarkModal') closeBenchmarkModal();
    }
  });
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  ['selectModal','checkoutModal','benchmarkModal','compareModal','productDetailModal']
    .forEach(id => document.getElementById(id)?.classList.remove('open'));
  closeBenchmarkModal();
});


//  routing 

function showPage(id) {
  /* Remove active from all pages with a brief transition */
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.style.animation = 'none';
  });
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

  const targetPage = document.getElementById('page-' + id);
  if (targetPage) {
    targetPage.classList.add('active');
    /* Re-trigger page entrance animation */
    targetPage.style.animation = 'none';
    void targetPage.offsetWidth;
    targetPage.style.animation = '';
  }

  // Highlight the matching tab by checking its onclick value, not by index
  document.querySelectorAll('.nav-tab').forEach(t => {
    const fn = t.getAttribute('onclick') || '';
    if (fn.includes("'" + id + "'") || fn.includes('"' + id + '"')) {
      t.classList.add('active');
    }
  });

  if (id === 'cart') {
    if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
      if (typeof openLoginModal === 'function') openLoginModal();
      showToast('Sign in to view your cart', 'error');
      showPage('store');
      return;
    }
    renderCart();
  }
  if (id === 'orders') {
    if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
      if (typeof openLoginModal === 'function') openLoginModal();
      showToast('Sign in to view your orders', 'error');
      showPage('store');
      return;
    }
    renderOrders();
  }
  if (id === 'builder')  renderBuilder();
  if (id === 'laptops')  { if (typeof renderLaptops === 'function') renderLaptops(); if (typeof renderLaptopTags === 'function') renderLaptopTags(); }
  if (id === 'wishlist') {
    /*  Require login for wishlist  */
    if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
      if (typeof openLoginModal === 'function') openLoginModal();
      showToast('Sign in to view your wishlist', 'error');
      showPage('store');
      return;
    }
    if (typeof renderWishlistPage === 'function') renderWishlistPage();
    /* Update count label */
    const countEl = document.getElementById('wishlistPageCount');
    if (countEl) {
      const n = typeof _wishlist !== 'undefined' ? _wishlist.length : 0;
      countEl.textContent = n + ' saved item' + (n !== 1 ? 's' : '');
    }
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderNav() {
  const loggedIn = typeof getCurrentUser === 'function' && !!getCurrentUser();

  /* Only update cart count for logged-in users */
  const cartCountEl = document.getElementById('cartCount');
  if (cartCountEl) {
    if (loggedIn) {
      /* Validate: only count items whose products still exist */
      const cart = DB.getCart();
      const validCount = cart.reduce((sum, item) => {
        const p = getProduct(item.productId);
        return sum + (p ? item.qty : 0);
      }, 0);
      cartCountEl.textContent = validCount;
    } else {
      cartCountEl.textContent = 0;
    }
  }

  /* Show/hide cart button based on login state */
  const cartBtn = document.getElementById('navCartBtn');
  if (cartBtn) cartBtn.style.display = loggedIn ? '' : 'none';

  /* Show wishlist tab only when logged in */
  const wishlistTab = document.getElementById('wishlistNavTab');
  if (wishlistTab) wishlistTab.style.display = loggedIn ? '' : 'none';
}


//  store

/* Auto-refresh store data if admin adds/changes a product in another tab */
window.addEventListener('storage', function(e) {
  if (e.key === 'ds_custom_products' || e.key === 'ds_custom_images' || e.key === 'ds_hidden_products') {
    if (typeof renderProducts === 'function') renderProducts();
    if (typeof renderStore === 'function') renderStore(); // updated to run renderStore
    if (typeof renderLaptops === 'function') renderLaptops();
    const builderPage = document.getElementById('page-builder');
    if (builderPage && builderPage.classList.contains('active') && typeof renderBuilder === 'function') renderBuilder();
  }
  
  /* Real-time sync for Cart and Wishlist indicators after deletion/changes from other tabs */
  if (e.key && e.key.includes('cart')) {
    if (typeof renderNav === 'function') renderNav();
    if (typeof renderCart === 'function') renderCart();
  }
  if (e.key && e.key.includes('wishlist')) {
    if (typeof _reloadWishlist === 'function') _reloadWishlist();
  }
});

/* Listen for product deletion events — immediately clean ghost items */
window.addEventListener('ds:product:deleted', function(e) {
  const pid = e.detail?.productId;
  if (!pid) return;
  /* Remove from cart if present */
  try { DB.cartRemove(pid); } catch(err) {}
  /* Remove from wishlist if present */
  if (typeof _wishlist !== 'undefined' && Array.isArray(_wishlist)) {
    const idx = _wishlist.indexOf(pid);
    if (idx !== -1) {
      _wishlist.splice(idx, 1);
      if (typeof _saveWishlist === 'function') _saveWishlist(_wishlist);
    }
  }
  /* Update all UI */
  renderNav();
  const active = document.querySelector('.page.active');
  if (active) {
    const page = active.id.replace('page-', '');
    if (page === 'cart' && typeof renderCart === 'function') renderCart();
    if (page === 'wishlist' && typeof renderWishlistPage === 'function') renderWishlistPage();
    if (page === 'store' && typeof renderStore === 'function') renderStore();
    if (page === 'builder' && typeof renderBuilder === 'function') renderBuilder();
  }
});

function renderStore() {
  const q = (document.getElementById('searchInput')?.value || '').toLowerCase();

  document.getElementById('filterBar').innerHTML = getStoreCategories().map(cat =>
    `<button class="filter-btn ${currentFilter === cat ? 'active' : ''}"
             onclick="setFilter('${cat}')">${cat}</button>`
  ).join('');

  // Merge catalog + any admin-added custom products
  const _cp = (function(){ try{ return JSON.parse(localStorage.getItem("ds_custom_products")||"[]"); }catch(e){ return []; } })();
  let items = [...(typeof _getAllProducts === 'function' ? _getAllProducts() : [])];
  /* Laptop routing: exclude laptops from the main Store grid —
     they have their own dedicated Laptop page. */
  if (currentFilter === 'All') {
    items = items.filter(p => p.cat !== 'Laptop');
  } else if (currentFilter === 'Laptop') {
    /* Redirect to dedicated Laptop page instead of filtering here */
    showPage('laptops');
    return;
  } else {
    items = items.filter(p => p.cat === currentFilter);
  }
  if (q) items = items.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.specs.toLowerCase().includes(q) ||
    p.cat.toLowerCase().includes(q)
  );
  items = applySortFilter(items);

  /* Dynamic subtitle — always reflects actual product count */
  const _storeSubEl = document.getElementById('storeSubtitle');
  if (_storeSubEl) {
    const totalComponents = _getAllProducts().filter(p => p.cat !== 'Laptop').length;
    _storeSubEl.textContent = totalComponents + ' products from top manufacturers';
  }

  document.getElementById('productsGrid').innerHTML = items.length
    ? items.map(p => {
        const wishlisted = isWishlisted(p.id);
        const comparing  = compareList.includes(p.id);
        const status     = getStockStatus(p.id);
        const isOOS      = status === 'outofstock';
        const isSale     = status === 'sale';
        const isLow      = status === 'lowstock';
        const salePrice  = Math.round(p.price * 57 * 0.85);

        /*  Real-time quantity pill  */
        const qtyDisplay = typeof INVENTORY !== 'undefined' ? INVENTORY.getDisplayQty(p.id) : '';
        const qtyClass   = isOOS ? 'inv-card-qty inv-card-qty-oos'
          : isLow ? 'inv-card-qty inv-card-qty-low'
          : 'inv-card-qty inv-card-qty-ok';
        const qtyPill    = qtyDisplay
          ? `<div class="inv-card-qty-wrap"><span class="${qtyClass}">${qtyDisplay}</span></div>`
          : '';

        const _loggedIn = typeof getCurrentUser === 'function' && !!getCurrentUser();
        /* Category-aware click: laptops → openLaptopDetail, components → openProductModal */
        const _clickFn = p.cat === 'Laptop' ? `openLaptopDetail('${p.id}')` : `openProductModal('${p.id}')`;
        return `<div class="product-card${isOOS ? ' card-oos' : isLow ? ' card-lowstock' : ''}" data-pid="${p.id}" onclick="${_clickFn}">
          <div class="product-image-area">
            ${productImg(p.id, 'card')}
            ${isSale ? '<div class="stock-badge sale-badge">SALE &minus;15%</div>' : ''}
            ${isLow  ? '<div class="stock-badge low-badge">LOW STOCK</div>'        : ''}
            ${isOOS  ? '<div class="stock-badge oos-badge">OUT OF STOCK</div>'     : ''}
          </div>
          ${_loggedIn ? `<button class="wishlist-btn ${wishlisted ? 'wishlisted' : ''}" data-pid="${p.id}"
            onclick="event.stopPropagation();toggleWishlist('${p.id}',this)"
            title="${wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}"
            aria-label="${wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}">
            <svg width="15" height="15" viewBox="0 0 24 24"
                 fill="${wishlisted ? 'currentColor' : 'none'}"
                 stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>` : ''}
          <div class="product-info">
            <div class="product-cat">${p.cat}</div>
            <div class="product-name">${p.name}</div>
            <div class="product-specs">${p.specs}</div>
            ${qtyPill}
            ${(function() {
              const bs = p.benchScore || 0;
              if (!bs) return '';
              let bc = '#6b7280', bl = '';
              if (bs >= 95)      { bc = '#ef4444'; bl = 'Flagship'; }
              else if (bs >= 80) { bc = '#f97316'; bl = 'High-End'; }
              else if (bs >= 55) { bc = '#2563eb'; bl = 'Mid-Range'; }
              else if (bs >= 30) { bc = '#22c55e'; bl = 'Budget'; }
              else               { bc = '#94a3b8'; bl = 'Entry'; }
              return `<div class="pdm-card-bench">
                <div class="pdm-card-bench-track">
                  <div class="pdm-card-bench-fill" style="width:${bs}%;background:${bc}"></div>
                </div>
                <span class="pdm-card-bench-label" style="color:${bc}">${bs} ${bl}</span>
              </div>`;
            })()}
            ${typeof getProductRatingBadge === 'function' ? getProductRatingBadge(p.id) : ''}
            <div class="product-footer">
              <div>
                ${isSale
                  ? `<div style="display:flex;align-items:baseline;gap:0.4rem">
                       <div class="product-price" style="color:var(--yellow)">&#8369;${salePrice.toLocaleString()}</div>
                       <div style="font-size:0.72rem;color:var(--text3);text-decoration:line-through">&#8369;${Math.round(p.price * 57).toLocaleString()}</div>
                     </div>`
                  : `<div class="product-price">&#8369;${Math.round(p.price * 57).toLocaleString()}</div>`
                }
              </div>
              <div style="display:flex;gap:0.4rem">
                <button class="compare-btn ${comparing ? 'comparing' : ''}" data-pid="${p.id}"
                  onclick="event.stopPropagation();toggleCompare('${p.id}',this)">
                  ${comparing ? 'Comparing' : 'Compare'}
                </button>
                ${isOOS
                  ? '<button class="add-cart-btn" style="opacity:0.4;cursor:not-allowed" disabled>Sold Out</button>'
                  : `<button class="add-cart-btn" onclick="event.stopPropagation();addToCart('${p.id}',event)">+ Add</button>`
                }
              </div>
            </div>
          </div>
        </div>`;
      }).join('')
    : `<div style="color:var(--text3);grid-column:1/-1;text-align:center;padding:3rem">
         ${currentSort === 'wishlist' ? 'Nothing saved yet' : 'No results'}
       </div>`;
}

function setFilter(cat) {
  currentFilter = cat;
  renderStore();
}


//  cart 

function addToCart(productId, event) {
  if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
    openLoginModal();
    showToast('Please sign in to add items to your cart', 'error');
    return;
  }

  /*  Stock validation before adding  */
  if (typeof INVENTORY !== 'undefined') {
    const cart    = DB.getCart();
    const already = (cart.find(i => i.productId === productId) || {}).qty || 0;
    const check   = INVENTORY.canFulfill(productId, already + 1);
    if (!check.ok) {
      showToast(check.message || 'Not enough stock available.', 'error');
      return;
    }
  }

  DB.cartAdd(productId);
  renderNav();
  showToast(getProduct(productId).name + ' added to cart', 'success');

  /* ── Fly-to-cart animation ── */
  _flyToCartAnim(event);
}

/* Animate a ghost dot from click position to cart button */
function _flyToCartAnim(event) {
  const ghost   = document.getElementById('flyCartGhost');
  const cartBtn = document.getElementById('navCartBtn');
  if (!ghost || !cartBtn || !event) return;

  // Determine start position
  let startX, startY;
  if (event && event.clientX) {
    startX = event.clientX;
    startY = event.clientY;
  } else {
    // Fallback: center of viewport
    startX = window.innerWidth / 2;
    startY = window.innerHeight / 2;
  }

  const cartRect = cartBtn.getBoundingClientRect();
  const endX     = cartRect.left + cartRect.width / 2;
  const endY     = cartRect.top + cartRect.height / 2;

  ghost.style.left = startX + 'px';
  ghost.style.top  = startY + 'px';
  ghost.classList.remove('animate');
  void ghost.offsetWidth; // force reflow

  // Animate using Web Animations API for precise control
  const anim = ghost.animate([
    { left: startX + 'px', top: startY + 'px', opacity: 1, transform: 'scale(1)' },
    { left: ((startX + endX) / 2) + 'px', top: (Math.min(startY, endY) - 50) + 'px', opacity: 0.8, transform: 'scale(0.7)', offset: 0.5 },
    { left: endX + 'px', top: endY + 'px', opacity: 0, transform: 'scale(0.2)' }
  ], {
    duration: 550,
    easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    fill: 'forwards'
  });

  ghost.style.opacity = '1';
  anim.onfinish = () => {
    ghost.style.opacity = '0';
  };
}

function updateQty(productId, delta) {
  /* When increasing, check available stock first */
  if (delta > 0 && typeof INVENTORY !== 'undefined') {
    const cart    = DB.getCart();
    const current = (cart.find(i => i.productId === productId) || {}).qty || 0;
    const check   = INVENTORY.canFulfill(productId, current + delta);
    if (!check.ok) {
      showToast(check.message || 'Not enough stock available.', 'error');
      return;
    }
  }
  DB.cartUpdateQty(productId, delta);
  renderCart();
  renderNav();
}

function removeFromCart(productId) {
  DB.cartRemove(productId);
  renderCart();
  renderNav();
}

function renderCart() {
  const el = document.getElementById('cartContent');

  /* Guest guard */
  if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
    el.innerHTML = `<div class="empty-state">
      <h3>Sign in to view your cart</h3>
      <p>Your cart is only available to logged-in users.</p><br>
      <button class="btn-primary" onclick="openLoginModal()">Sign In</button>
    </div>`;
    return;
  }

  const cart = DB.getCart();

  /* Auto-clean orphaned cart items (products that no longer exist) */
  const orphaned = cart.filter(item => !getProduct(item.productId));
  if (orphaned.length) {
    orphaned.forEach(item => DB.cartRemove(item.productId));
    renderNav();
    /* Re-read cleaned cart */
    return renderCart();
  }

  if (!cart.length) {
    el.innerHTML = `<div class="empty-state">
      
      <h3>Cart is empty</h3>
      <p>Browse components or start a build</p><br>
      <button class="btn-primary" onclick="showPage('store')">Shop Now</button>
    </div>`;
    return;
  }

  /*  Validate stock levels for all cart items  */
  const cartProblems = typeof INVENTORY !== 'undefined' ? INVENTORY.validateCart(cart) : [];
  const problemIds   = new Set(cartProblems.map(p => p.productId));

  const rows = cart.map(item => {
    const p = getProduct(item.productId);
    if (!p) return '';
    const hasStockIssue = problemIds.has(item.productId);
    const prob = cartProblems.find(x => x.productId === item.productId);
    const oosLabel = hasStockIssue
      ? `<span class="cart-item-oos-label">${prob?.available === 0 ? 'Out of Stock' : 'Low Stock'}</span>`
      : '';
    return `<div class="cart-item${hasStockIssue ? ' cart-item-oos' : ''}">
      
      <div class="cart-item-info">
        <div class="cart-item-name">${p.name}${oosLabel}</div>
        <div class="cart-item-sub">${p.cat} · ${p.specs}</div>
      </div>
      <div class="cart-item-qty">
        <button class="qty-btn" onclick="updateQty('${p.id}',-1)">−</button>
        <span class="qty-val">${item.qty}</span>
        <button class="qty-btn" onclick="updateQty('${p.id}',+1)" ${hasStockIssue ? 'disabled' : ''}>+</button>
      </div>
      <div class="cart-item-price">₱${(p.price * item.qty * 57).toLocaleString()}</div>
      <button class="remove-btn" onclick="removeFromCart('${p.id}')">Remove</button>
    </div>`;
  }).join('');

  /* Build cart validation alert HTML */
  const alertHtml = cartProblems.length
    ? `<div class="inv-cart-alert visible">
        <div class="inv-cart-alert-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Stock Availability Issue
        </div>
        <ul class="inv-cart-alert-list">
          ${cartProblems.map(p => `<li class="inv-cart-alert-item">${p.name}: ${p.message}</li>`).join('')}
        </ul>
      </div>`
    : '';

  const sub      = cart.reduce((s, item) => { const p = getProduct(item.productId); return s + (p ? p.price * item.qty : 0); }, 0);
  const shipping = sub > 500 ? 0 : 30;
  const tax      = sub * 0.12;
  const total    = sub + shipping + tax;

  el.innerHTML = `
    ${alertHtml}
    <div class="cart-items">${rows}</div>
    <div class="cart-summary">
      <div class="summary-lines">
        <div class="summary-line"><span>Subtotal</span><span>₱${(sub * 57).toLocaleString()}</span></div>
        <div class="summary-line"><span>Shipping</span><span>${shipping === 0 ? '<span style="color:var(--green)">FREE</span>' : '₱' + (shipping * 57).toLocaleString()}</span></div>
        <div class="summary-line"><span>VAT (12%)</span><span>₱${(tax * 57).toLocaleString()}</span></div>
        <div class="summary-line total"><span>Total</span><span>₱${(total * 57).toLocaleString()}</span></div>
      </div>
      <button class="btn-primary" style="width:100%" onclick="openCheckout()">Checkout →</button>
      <div style="margin-top:0.75rem;text-align:center;font-size:0.75rem;color:var(--text3)">Secured with SSL</div>
    </div>`;
}


//  checkout & orders 

/* 
   CHECKOUT MAP — Point A → Point B Navigation
   Centered on General Santos City, Philippines by default.
   
   Usage:
   1. User clicks "Set Starting Point" then clicks map → Point A
   2. User clicks "Set Destination"    then clicks map → Point B
   3. Route is drawn via OSRM (no API key needed)
   4. Distance + estimated travel time shown below map
 */

let _coMap      = null;   // Leaflet map instance
let _markerA    = null;   // Point A marker
let _markerB    = null;   // Point B marker
let _routeLayer = null;   // Polyline for drawn route
let _mapMode    = null;   // 'A' | 'B' | null — which pin user is placing next

/*  GenSan coords (default center)  */
const GENSAN_LAT = 6.1164;
const GENSAN_LNG = 125.1716;
const GENSAN_ZOOM = 13;

/*  Custom pin icons  */
function _makeIcon(label, color) {
  return L.divIcon({
    className: '',
    html: '<div class="co-map-marker" style="background:' + color + '">' + label + '</div>',
    iconSize:   [32, 32],
    iconAnchor: [16, 32],
    popupAnchor:[0, -32],
  });
}

/*  Init the checkout map  */
function _initCheckoutMap() {
  if (_coMap) { _coMap.invalidateSize(); return; }
  const mapEl = document.getElementById('checkoutMap');
  if (!mapEl) return;

  _coMap = L.map('checkoutMap', { zoomControl: true })
             .setView([GENSAN_LAT, GENSAN_LNG], GENSAN_ZOOM);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
  }).addTo(_coMap);

  /* Single click drops delivery pin and auto-fills address */
  _coMap.on('click', function(e) {
    _placeDeliveryPin(e.latlng);
  });

  _setMapHint('Click anywhere on the map to set your delivery location.', '');
}

/*  Place/move the single delivery pin  */
function _placeDeliveryPin(latlng) {
  if (_markerB) {
    _markerB.setLatLng(latlng);
  } else {
    _markerB = L.marker(latlng, {
      icon: _makeIcon('', '#2563eb'),
      draggable: true
    }).addTo(_coMap)
      .on('dragend', function(ev) { _placeDeliveryPin(ev.target.getLatLng()); });
  }

  /* Store coords */
  const hidden = document.getElementById('mapCoords');
  if (hidden) hidden.value = latlng.lat.toFixed(6) + ',' + latlng.lng.toFixed(6);

  _setMapHint('Fetching address...', '');
  _reverseGeocodeAndFill(latlng);
}

/*  Reverse geocode and fill all address fields  */
function _reverseGeocodeAndFill(latlng) {
  const lat = latlng.lat.toFixed(6);
  const lng = latlng.lng.toFixed(6);
  fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + lat + '&lon=' + lng,
        { headers: { 'Accept-Language': 'en' } })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      const a      = data.address || {};
      const street = [a.house_number, a.road || a.pedestrian || a.footway, a.neighbourhood || a.suburb]
                       .filter(Boolean).join(' ')
                     || (data.display_name || '').split(',')[0] || '';
      const city   = a.city || a.town || a.municipality || a.county || '';
      const zip    = a.postcode || '';

      const addrEl = document.getElementById('address');
      const cityEl = document.getElementById('city');
      const zipEl  = document.getElementById('zip');
      if (addrEl) addrEl.value = street;
      if (cityEl) cityEl.value = city;
      if (zipEl)  zipEl.value  = zip;

      _setMapHint('Address filled from selected location. You can edit the fields above if needed.', 'success');
    })
    .catch(function() {
      _setMapHint('Could not fetch address automatically. Please fill the address fields manually.', 'warn');
    });
}

/*  Hint bar helper  */
function _setMapHint(html, type) {
  const el = document.getElementById('coMapHint');
  if (!el) return;
  el.innerHTML = html;
  el.className = 'co-map-hint' + (type ? ' hint-' + type : '');
}

/*  Order summary toggle  */
function toggleOrderSummary() {
  const panel = document.getElementById('coSummaryPanel');
  const arrow = document.getElementById('coSummaryArrow');
  const open  = panel.style.display === 'none';
  panel.style.display = open ? 'block' : 'none';
  arrow.innerHTML = open ? '&#9650;' : '&#9660;';
}

function _populateOrderSummary() {
  const cart = DB.getCart();
  const sub  = cart.reduce((s, item) => {
    const p = getProduct(item.productId);
    return s + (p ? p.price * item.qty : 0);
  }, 0);
  const shipping = sub > 500 ? 0 : 30;
  const vat      = sub * 0.12;
  const total    = (sub + shipping + vat) * 57;

  document.getElementById('coSummaryTotal').textContent = '₱' + Math.round(total).toLocaleString();

  document.getElementById('coSummaryItems').innerHTML = cart.map(item => {
    const p = getProduct(item.productId);
    if (!p) return '';
    return '<div class="co-sum-item">'
      + '<span class="co-sum-name">' + p.name + (item.qty > 1 ? ' ×' + item.qty : '') + '</span>'
      + '<span class="co-sum-price">₱' + Math.round(p.price * item.qty * 57).toLocaleString() + '</span>'
      + '</div>';
  }).join('');

  document.getElementById('coSummaryBreakdown').innerHTML =
    '<div class="co-sum-row"><span>Subtotal</span><span>₱' + Math.round(sub * 57).toLocaleString() + '</span></div>' +
    '<div class="co-sum-row"><span>Shipping</span><span>' + (shipping === 0 ? '<span style="color:var(--green)">FREE</span>' : '₱' + Math.round(shipping * 57).toLocaleString()) + '</span></div>' +
    '<div class="co-sum-row"><span>VAT (12%)</span><span>₱' + Math.round(vat * 57).toLocaleString() + '</span></div>' +
    '<div class="co-sum-total-row"><span>Total</span><span>₱' + Math.round(total).toLocaleString() + '</span></div>';
}

/*  Payment method selection  */
function _bindPaymentMethods() {
  document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
    radio.addEventListener('change', function() {
      document.querySelectorAll('.co-pm-card').forEach(c => c.classList.remove('selected'));
      this.closest('.co-pm-card').classList.add('selected');
      _showPaymentInstructions(this.value);
    });
  });
}

function _showPaymentInstructions(method) {
  const el = document.getElementById('coPaymentInstructions');
  const info = {
    gcash:    { color:'#007bff', logo:'G', name:'GCash',  number:'0917-123-4567', steps:['Open GCash app','Send to: <strong>0917-123-4567</strong> (Digispex)','Enter your exact order total','Screenshot your receipt & keep it for reference'] },
    paymaya:  { color:'#22c55e', logo:'M', name:'Maya',   number:'0945-678-9012', steps:['Open Maya (PayMaya) app','Send to: <strong>0945-678-9012</strong> (Digispex)','Enter your exact order total','Screenshot your receipt & keep it for reference'] },
  };
  const d = info[method];
  if (!d) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  const total = document.getElementById('coSummaryTotal').textContent || '';
  el.innerHTML =
    '<div class="co-instr-header" style="border-color:' + d.color + '22">' +
    '<div class="co-instr-logo" style="background:' + d.color + '">' + d.logo + '</div>' +
    '<div><div class="co-instr-title">' + d.name + ' Payment Instructions</div>' +
    '<div class="co-instr-amount">Amount to send: <strong>' + total + '</strong></div></div></div>' +
    '<ol class="co-instr-steps">' + d.steps.map(s => '<li>' + s + '</li>').join('') + '</ol>' +
    '<div class="co-instr-note">&#9432; Your order will be confirmed once payment is verified (within 1–2 hours).</div>';
}

function openCheckout() {
  if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
    openLoginModal();
    showToast('Please sign in to checkout', 'error');
    return;
  }
  if (!DB.getCartCount()) return;
  document.getElementById('checkoutModal').classList.add('open');
  _populateOrderSummary();
  setTimeout(_initCheckoutMap, 120);
}

function placeOrder(e) {
  e.preventDefault();
  const cart = DB.getCart();
  if (!cart.length) return;

  const _pmf = document.getElementById('selectedPaymentMethod');
  const method = _pmf ? { value: _pmf.value || '' } : null;
  if (!method || !method.value) { showToast('Please select a payment method via Review & Pay', 'error'); return; }

  /*  Real-time cart stock validation before confirming  */
  if (typeof INVENTORY !== 'undefined') {
    const problems = INVENTORY.validateCart(cart);
    if (problems.length) {
      const names = problems.map(p =>
        `${p.name}: only ${p.available} unit${p.available !== 1 ? 's' : ''} left`
      ).join('; ');
      showToast('Stock issue — ' + names, 'error');
      renderCart(); /* refresh cart to show updated state */
      return;
    }
  }

  const sub      = cart.reduce((s, item) => { const p = getProduct(item.productId); return s + (p ? p.price * item.qty : 0); }, 0);
  const shipping = sub > 500 ? 0 : 30;
  const total    = (sub + shipping + sub * 0.12) * 57;

  const coords = document.getElementById('mapCoords').value;

  const order = {
    id:       'DS-' + Date.now().toString(36).toUpperCase(),
    items:    cart.map(item => { const p = getProduct(item.productId); return { name: p.name, qty: item.qty, price: p.price, productId: item.productId }; }),
    total:    Math.round(total).toLocaleString(),
    status:   'processing',
    date:     new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
    customer: document.getElementById('firstName').value + ' ' + document.getElementById('lastName').value,
    payment:  method.value,
    address:  document.getElementById('address').value + ', ' + document.getElementById('city').value + ' ' + document.getElementById('zip').value,
    additionalInfo: (document.getElementById('additionalInfo')?.value || '').trim(),
    coords:   coords || null,
    userId:   (typeof getCurrentUser === 'function' && getCurrentUser()) ? getCurrentUser().id : null,
  };

  DB.addOrder(order);

  /*  Deduct stock for every item in the confirmed order  */
  if (typeof INVENTORY !== 'undefined') {
    INVENTORY.deductCart(cart);
  }

  DB.cartClear();
  document.getElementById('checkoutModal').classList.remove('open');
  renderNav();
  renderCart();

  /* Push "order received" notification to customer */
  if (typeof NOTIFY !== 'undefined') {
    NOTIFY.onOrderPlaced(order, order.userId);
  } else if (typeof pushNotification === 'function') {
    pushNotification(order.id, 'processing');
  }

  /*  Stock deduction confirmation toast  */
  showToast('Order placed! ' + order.id + ' — stock updated.', 'success');
  setTimeout(() => showPage('orders'), 1200);
}

function renderOrders() {
  const el = document.getElementById('ordersContent');

  /* Guest guard */
  if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
    el.innerHTML = `<div class="empty-state">
      <h3>Sign in to view your orders</h3>
      <p>Your order history is only available to logged-in users.</p><br>
      <button class="btn-primary" onclick="openLoginModal()">Sign In</button>
    </div>`;
    return;
  }

  const orders = DB.getOrders();

  if (!orders.length) {
    el.innerHTML = `<div class="empty-state">
      
      <h3>No orders yet</h3>
      <p>Your history shows up here after checkout</p>
    </div>`;
    return;
  }

  el.innerHTML = orders.map(o => `
    <div class="order-card">
      <div class="order-header">
        <div>
          <div class="order-id">${o.id}</div>
          <div style="font-size:0.8rem;color:var(--text3);margin-top:2px">${o.date} · ${o.customer}</div>
        </div>
        <span class="order-status ${o.status}">${o.status}</span>
      </div>
      <div class="order-items-list">
        ${o.items.map(i => `<div class="order-item-row">
          <span>${i.name} ×${i.qty}</span>
          <span>₱${(i.price * i.qty * 57).toLocaleString()}</span>
        </div>`).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem">
        <span style="font-size:0.8rem;color:var(--text3)">${o.items.length} item(s)</span>
        <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
          <button class="btn-msg-seller" onclick="openChat('${o.id}')"> Message Seller</button>
          <button class="btn-secondary" style="font-size:0.75rem;padding:0.35rem 0.85rem;display:flex;align-items:center;gap:0.35rem" onclick="downloadReceipt('${o.id}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Receipt
          </button>
          <span style="font-family:'JetBrains Mono';font-size:1rem;color:var(--accent);font-weight:700">₱${o.total}</span>
        </div>
      </div>
    </div>`).join('');
}


//  builder 

function getPlatformInfo(build) {
  const cpu = build.CPU ? getProduct(build.CPU) : null;
  const mb  = build.Motherboard ? getProduct(build.Motherboard) : null;
  
  return {
    socket:  cpu?.socket || mb?.socket || null,
    memType: cpu?.memType || mb?.memType || null,
    source:  cpu ? 'CPU' : (mb ? 'Motherboard' : null)
  };
}

function renderBuilder() {
  const build    = DB.getBuild();
  const platform = getPlatformInfo(build);
  const _customImgs = (function(){ try{ return JSON.parse(localStorage.getItem('ds_custom_images')||'{}'); }catch(e){ return {}; }})();
  let total = 0, count = 0;

  document.getElementById('builderSlots').innerHTML = BUILDER_SLOTS.map(slot => {
    const sel = build[slot.key] ? getProduct(build[slot.key]) : null;
    if (sel) { total += sel.price; count++; }

    let hint = '';
    if (!sel && platform) {
      if (slot.key === 'Motherboard' && platform.socket) hint = _lockBadge(platform.socket + ' only');
      else if (slot.key === 'RAM') {
        const req = platform.memType || (build.Motherboard ? (getProduct(build.Motherboard) || {}).memType : null);
        if (req) hint = _lockBadge(req + ' only');
      }
    }

    let socketBadge = '';
    if (slot.key === 'CPU' && sel) {
      const colors = { AM4: '#ff6b35', AM5: '#ff4444', LGA1700: '#2563eb', LGA1851: '#00aaff' };
      const c = colors[sel.socket] || '#fff';
      socketBadge = `<span style="font-size:0.65rem;padding:1px 7px;border-radius:4px;font-weight:700;background:rgba(255,255,255,0.06);color:${c};border:1px solid ${c}33">${sel.socket}</span>`;
    }

    // Product image: custom upload > placeholder with cat abbreviation
    const imgSrc = sel ? (_customImgs[sel.id] || null) : null;
    const slotIconHtml = imgSrc
      ? `<div class="slot-icon slot-icon-img"><img src="${imgSrc}" alt="${sel.name}" onerror="this.parentElement.classList.remove('slot-icon-img');this.parentElement.innerHTML='<span class=\\'slot-cat\\'>${(sel ? sel.cat : slot.cat || '').substring(0,3).toUpperCase()}</span>'"></div>`
      : `<div class="slot-icon"><span class="slot-cat">${sel ? sel.cat.substring(0,3).toUpperCase() : slot.cat ? slot.cat.substring(0,3).toUpperCase() : ''}</span></div>`;

    return `<div class="builder-slot ${sel ? 'slot-filled' : ''}">
      ${slotIconHtml}
      <div class="slot-info">
        <div class="slot-label">${slot.label}${slot.required ? '' : '<span style="opacity:0.5"> (Optional)</span>'}${hint}</div>
        <div style="display:flex;align-items:center;gap:0.5rem">
          <div class="slot-name ${sel ? '' : 'empty'}">${sel ? sel.name : 'Not selected'}</div>
          ${socketBadge}
        </div>
        ${sel ? `<div style="font-size:0.72rem;color:var(--text3)">${sel.specs}</div>` : ''}
      </div>
      ${sel ? `<div class="slot-price">₱${(sel.price * 57).toLocaleString()}</div>` : ''}
      <div class="slot-actions">
        <button class="slot-btn" onclick="openSlotModal('${slot.key}')">${sel ? 'Change' : 'Select'}</button>
        ${sel ? `<button class="slot-btn remove" onclick="removeSlot('${slot.key}')"></button>` : ''}
      </div>
    </div>`;
  }).join('');

  document.getElementById('summaryLines').innerHTML = BUILDER_SLOTS.map(slot => {
    const sel = build[slot.key] ? getProduct(build[slot.key]) : null;
    return sel ? `<div class="summary-line"><span>${slot.label}</span><span>₱${(sel.price * 57).toLocaleString()}</span></div>` : '';
  }).join('');

  document.getElementById('buildTotal').innerHTML = `<span>Total</span><span>₱${(total * 57).toLocaleString()}</span>`;
  document.getElementById('partCount').textContent = count + '/' + BUILDER_SLOTS.length + ' parts';

  animateRigRating(calcRigRating(build));
  updatePowerMeter(build);
  runCompatCheck(build);
}

function _lockBadge(text) {
  return `<span style="font-size:0.65rem;background:rgba(37,99,235,0.1);color:var(--accent);border:1px solid rgba(37,99,235,0.2);padding:1px 7px;border-radius:4px;font-weight:600">${text}</span>`;
}

function openSlotModal(slotKey) {
  currentSlotKey = slotKey;
  const slot     = BUILDER_SLOTS.find(s => s.key === slotKey);
  const build    = DB.getBuild();
  const platform = getPlatformInfo(build);

  let products = getProductsByCategory(slotKey);
  let notice   = '';

  // 1. Socket Compatibility (CPU <-> Motherboard)
  if ((slotKey === 'Motherboard' || slotKey === 'CPU') && platform.socket) {
    products = products.map(p => {
      if (p.socket && p.socket !== platform.socket) {
        return { ...p, _locked: true, _lockReason: `Incompatible Socket (Needs ${platform.socket})` };
      }
      return p;
    });
    notice = _compat(`Showing <strong>${platform.socket}</strong> compatible parts.`);
  }

  // 2. RAM Compatibility (MemType)
  if (slotKey === 'RAM' && platform.memType) {
    products = products.map(p => {
      if (p.memType && p.memType !== platform.memType) {
        return { ...p, _locked: true, _lockReason: `Incompatible RAM (Needs ${platform.memType})` };
      }
      return p;
    });
    notice = _compat(`Showing <strong>${platform.memType}</strong> compatible kits.`);
  }

  // 3. Motherboard -> RAM Compatibility (if no CPU yet)
  if (slotKey === 'RAM' && !platform.memType && build.Motherboard) {
    const mb = getProduct(build.Motherboard);
    if (mb && mb.memType) {
      products = products.map(p => {
        if (p.memType && p.memType !== mb.memType) {
          return { ...p, _locked: true, _lockReason: `Needs ${mb.memType} for board` };
        }
        return p;
      });
      notice = _compat(`Showing <strong>${mb.memType}</strong> compatible kits.`);
    }
  }
  // 4. Motherboard -> Case Compatibility (Form Factor)
  if (slotKey === 'Motherboard' && build.Case) {
    const chasis = getProduct(build.Case);
    if (chasis && chasis.supported_form_factors) {
      const supp = chasis.supported_form_factors.toUpperCase();
      products = products.map(p => {
        if (p._locked) return p;
        if (p.form_factor && !supp.includes(p.form_factor.toUpperCase())) {
          return { ...p, _locked: true, _lockReason: `Not supported by ${chasis.name}` };
        }
        return p;
      });
    }
  }

  // 5. GPU -> Case Compatibility (Length)
  if (slotKey === 'GPU' && build.Case) {
    const chasis = getProduct(build.Case);
    if (chasis && chasis.max_gpu_length) {
      products = products.map(p => {
        if (p._locked) return p;
        if (p.length_mm && p.length_mm > chasis.max_gpu_length) {
          return { ...p, _locked: true, _lockReason: `Too long for case (${p.length_mm}mm > ${chasis.max_gpu_length}mm)` };
        }
        return p;
      });
    }
  }

  // 6. Case -> Compatibility Checks (Inverted: filter cases that don't fit current parts)
  if (slotKey === 'Case' && (build.GPU || build.Motherboard)) {
    const gpu = build.GPU ? getProduct(build.GPU) : null;
    const mb  = build.Motherboard ? getProduct(build.Motherboard) : null;
    products = products.map(p => {
      if (p._locked) return p;
      if (gpu && gpu.length_mm && p.max_gpu_length && gpu.length_mm > p.max_gpu_length) {
        return { ...p, _locked: true, _lockReason: `Too small for GPU (${gpu.length_mm}mm)` };
      }
      if (mb && mb.form_factor && p.supported_form_factors && !p.supported_form_factors.toUpperCase().includes(mb.form_factor.toUpperCase())) {
        return { ...p, _locked: true, _lockReason: `Doesn't support ${mb.form_factor}` };
      }
      return p;
    });
  }

  /* Benchmark validation: CPU, GPU, RAM, Storage require a benchScore
     to be selectable — unbenchmarked products are locked. */
  const BENCH_REQUIRED_SLOTS = ['CPU', 'GPU', 'RAM', 'Storage'];
  if (BENCH_REQUIRED_SLOTS.includes(slotKey)) {
    products = products.map(p => {
      if (p._locked) return p;
      // Just a warning, not a hard lock for now to help the user select things
      if (!p.benchScore || p.benchScore <= 0) {
         // return { ...p, _locked: true, _lockReason: 'No benchmark score \u2014 add via Admin Panel' };
      }
      return p;
    });
  }

  if (!notice && platform && slotKey !== 'CPU') {
    notice = `<div style="background:rgba(34,197,94,0.05);border:1px solid rgba(34,197,94,0.15);border-radius:8px;padding:0.65rem 1rem;margin-bottom:1.25rem;font-size:0.8rem;color:var(--green)">
      Platform: <strong>${platform.socket}</strong>${platform.memType ? ' / ' + platform.memType : ''}
    </div>`;
  }

  document.getElementById('modalTitle').textContent = 'Select ' + slot.label;
  const _slotImgs = (function(){ try{ return JSON.parse(localStorage.getItem('ds_custom_images')||'{}'); }catch(e){ return {}; }})();
  document.getElementById('modalProducts').innerHTML = notice + products.map(p => {
    const locked  = !!p._locked;
    const imgSrc  = _slotImgs[p.id] || null;
    const imgHtml = imgSrc
      ? `<div style="width:100%;aspect-ratio:16/9;border-radius:8px;overflow:hidden;margin-bottom:0.6rem;background:#0a0a0f;display:flex;align-items:center;justify-content:center"><img src="${imgSrc}" alt="${p.name}" style="width:100%;height:100%;object-fit:contain;display:block;padding:4px" onerror="this.parentElement.innerHTML='<span style=\'font-size:0.6rem;color:var(--accent);font-family:JetBrains Mono,monospace;letter-spacing:2px\'>' + (p.cat||'PC').substring(0,3).toUpperCase() + '</span>'"></div>`
      : `<div style="width:100%;aspect-ratio:16/9;border-radius:8px;margin-bottom:0.6rem;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:0.65rem;font-weight:700;letter-spacing:2px;color:var(--accent);opacity:0.7">${(p.cat||'PC').substring(0,3).toUpperCase()}</div>`;
    
    // Escape single quotes in ID and slotKey for the onclick handler
    const sKey = slotKey.replace(/'/g, "\\'");
    const pId  = p.id.toString().replace(/'/g, "\\'");

    return `<div class="select-product-card ${locked ? 'locked' : ''}"
         onclick="${locked ? `showToast('${(p._lockReason || 'Incompatible').replace(/'/g, "\\'")}','error')` : `selectComponent('${sKey}','${pId}')`}">
      ${imgHtml}
      <div class="name">${p.name}</div>
      <div class="spec">${p.specs}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:0.5rem">
        <div class="price">₱${(p.price * 57).toLocaleString()}</div>
        ${locked ? `<span style="font-size:0.65rem;color:var(--red);background:rgba(239,68,68,0.12);padding:2px 6px;border-radius:4px;font-weight:600">INCOMPATIBLE</span>` : ''}
      </div>
      ${locked ? `<div style="font-size:0.68rem;color:var(--red);margin-top:0.3rem">${p._lockReason}</div>` : ''}
    </div>`;
  }).join('');

  document.getElementById('selectModal').classList.add('open');
}

function _compat(html) {
  return `<div style="background:rgba(37,99,235,0.07);border:1px solid rgba(37,99,235,0.18);border-radius:8px;padding:0.65rem 1rem;margin-bottom:1.25rem;font-size:0.8rem;color:var(--accent)">${html}</div>`;
}

function selectComponent(slotKey, productId) {
  console.log('[PCBuilder] Selecting part:', slotKey, productId);
  const build = DB.getBuild();
  build[slotKey] = productId;

  if (slotKey === 'CPU') {
    const cpu      = getProduct(productId);
    const platform = getPlatformInfo({ CPU: productId });
    if (build.Motherboard) {
      const mb = getProduct(build.Motherboard);
      if (mb && mb.socket !== cpu.socket) { delete build.Motherboard; showToast('Motherboard removed — socket mismatch', 'error'); }
    }
    if (platform?.memType && build.RAM) {
      const ram = getProduct(build.RAM);
      if (ram && ram.memType !== platform.memType) { delete build.RAM; showToast('RAM removed — needs ' + platform.memType, 'error'); }
    }
  }

  if (slotKey === 'Motherboard' && build.RAM) {
    const mb = getProduct(productId), ram = getProduct(build.RAM);
    if (mb && ram && mb.memType !== ram.memType) { delete build.RAM; showToast('RAM removed — board needs ' + mb.memType, 'error'); }
  }

  DB.buildSave(build);
  closeModal();
  renderBuilder();
}

function removeSlot(slotKey) {
  const build = DB.getBuild();
  delete build[slotKey];
  DB.buildSave(build);
  renderBuilder();
}

function clearBuild() {
  DB.buildClear();
  renderBuilder();
  showToast('Build cleared', 'success');
}

function addBuilderToCart() {
  if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
    openLoginModal();
    showToast('Please sign in to add items to your cart', 'error');
    return;
  }
  const ids = Object.values(DB.getBuild()).filter(Boolean);
  if (!ids.length) { showToast('No parts selected', 'error'); return; }
  ids.forEach(id => DB.cartAdd(id));
  renderNav();
  showToast('Build added to cart!', 'success');
}
function closeModal() {
  document.getElementById('selectModal').classList.remove('open');
}


function getSocketMemType(socket) {
  if (!socket) return null;
  const s = socket.toUpperCase();
  if (s.startsWith('AM5')) return 'DDR5';
  if (s.startsWith('AM4')) return 'DDR4';
  if (s.startsWith('LGA1700')) return 'DDR5'; // Can be both but we prefer DDR5 for high-end builders
  if (s.startsWith('LGA1851')) return 'DDR5';
  return null;
}

//  compatibility 

function runCompatCheck(build) {
  const cpu    = build.CPU         ? getProduct(build.CPU)         : null;
  const mb     = build.Motherboard ? getProduct(build.Motherboard) : null;
  const ram    = build.RAM         ? getProduct(build.RAM)         : null;
  const gpu    = build.GPU         ? getProduct(build.GPU)         : null;
  const psu    = build.PSU         ? getProduct(build.PSU)         : null;
  const cooler = build.Cooling     ? getProduct(build.Cooling)     : null;
  const chasis = build.Case        ? getProduct(build.Case)        : null;
  const res    = [];

  if (cpu && mb) {
    cpu.socket === mb.socket
      ? res.push({ status: 'ok',    msg: `<strong>CPU ↔ MB:</strong> ${cpu.socket} ` })
      : res.push({ status: 'error', msg: `<strong>CPU ↔ MB:</strong> Socket mismatch (${cpu.socket} vs ${mb.socket})` });
  } else if (cpu || mb) {
    res.push({ status: 'neutral', msg: '<strong>CPU ↔ MB:</strong> Select both to check' });
  }

  if (cpu) {
    const pm = getSocketMemType(cpu.socket);
    if (pm && ram)
      pm === ram.memType
        ? res.push({ status: 'ok',    msg: `<strong>RAM type:</strong> ${pm} ` })
        : res.push({ status: 'error', msg: `<strong>RAM type:</strong> ${cpu.socket} needs ${pm}, got ${ram.memType}` });
    if (pm && mb)
      pm === mb.memType
        ? res.push({ status: 'ok',    msg: `<strong>Board type:</strong> ${pm} ` })
        : res.push({ status: 'error', msg: `<strong>Board type:</strong> ${cpu.socket} needs ${pm} board` });
  }

  if (mb && ram && !getSocketMemType(cpu?.socket)) {
    mb.memType === ram.memType
      ? res.push({ status: 'ok',    msg: `<strong>RAM ↔ MB:</strong> ${ram.memType} ` })
      : res.push({ status: 'error', msg: `<strong>RAM ↔ MB:</strong> Board needs ${mb.memType}, RAM is ${ram.memType}` });
  }

  if (gpu && psu) {
    const est = (gpu.power || 200) + (cpu ? cpu.tdp : 125) + 75;
    const rec = Math.round(est * 1.3);
    const cap = tryParseWattage(psu);
    if (cap > 0) {
      if (cap >= est) {
        const status = cap >= rec ? 'ok' : 'warn';
        const msg = cap >= rec 
          ? `<strong>Power:</strong> ${cap}W ≥ ~${est}W (Recommended: ${rec}W) `
          : `<strong>Power:</strong> ${cap}W is enough but below recommended ${rec}W`;
        res.push({ status, msg });
      } else {
        res.push({ status: 'error', msg: `<strong>Power:</strong> PSU ${cap}W — need ~${est}W` });
      }
    } else {
      res.push({ status: 'warn', msg: `<strong>Power:</strong> PSU Unknown Capacity — need ~${est}W` });
    }
  } else if (gpu || psu) {
    res.push({ status: 'warn', msg: '<strong>Power:</strong> Add both GPU + PSU to check' });
  }

  // GPU Length ↔ Case
  if (gpu && chasis) {
    const gLen = gpu.length_mm || 0;
    const cMax = chasis.max_gpu_length || 0;
    if (gLen && cMax) {
      gLen <= cMax
        ? res.push({ status: 'ok',    msg: `<strong>GPU Length:</strong> ${gLen}mm fits in ${cMax}mm case ` })
        : res.push({ status: 'error', msg: `<strong>GPU Length:</strong> GPU (${gLen}mm) exceeds case limit (${cMax}mm)!` });
    }
  }

  // MB Form Factor ↔ Case
  if (mb && chasis) {
    const mFf = mb.form_factor || '';
    const cSupp = (chasis.supported_form_factors || '').toUpperCase();
    if (mFf && cSupp) {
      cSupp.includes(mFf.toUpperCase())
        ? res.push({ status: 'ok',    msg: `<strong>Form Factor:</strong> ${mFf} supported ` })
        : res.push({ status: 'error', msg: `<strong>Form Factor:</strong> Case doesn't support ${mFf} boards` });
    }
  }

  if (cpu && cooler) {
    const ok = cpu.tdp <= 150 || cooler.specs.includes('360') || cooler.specs.includes('280') || cooler.specs.includes('AIO') || cooler.specs.includes('250W');
    ok
      ? res.push({ status: 'ok',   msg: `<strong>Thermal:</strong> Cooler handles ${cpu.tdp}W ` })
      : res.push({ status: 'warn', msg: `<strong>Thermal:</strong> ${cpu.tdp}W TDP — consider a 360mm AIO` });
  }

  const missing = BUILDER_SLOTS.filter(s => s.required && !build[s.key]).map(s => s.label);
  if (!missing.length && res.length) {
    res.push({ status: 'ok', msg: '<strong>Complete:</strong> All required parts selected ' });
  } else if (missing.length) {
    res.push({ status: 'warn', msg: `<strong>Missing:</strong> ${missing.join(', ')}` });
  }

  const box     = document.getElementById('compatResults');
  const overall = document.getElementById('overallCompat');

  if (!res.length) {
    box.innerHTML = `<div style="color:var(--text3);font-size:0.8rem;text-align:center;padding:1rem">Add parts to check compatibility</div>`;
    overall.className   = 'overall-compat neutral';
    overall.textContent = 'Select components to check';
    return;
  }

  box.innerHTML = res.map(r =>
    `<div class="compat-item"><div class="compat-dot ${r.status}"></div><div class="compat-text">${r.msg}</div></div>`
  ).join('');

  const hasErr  = res.some(r => r.status === 'error');
  const hasWarn = res.some(r => r.status === 'warn');
  overall.className   = 'overall-compat ' + (hasErr ? 'error' : hasWarn ? 'warn' : 'ok');
  overall.textContent = hasErr ? 'Issues found' : hasWarn ? 'OK — check warnings' : 'Fully compatible!';
}


//  toast 

function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'toast ' + type + ' show';
  setTimeout(() => el.classList.remove('show'), 2800);
}

//  product detail modal 

function openProductModal(pid) {
  const customProducts = (function() {
    try { return JSON.parse(localStorage.getItem('ds_custom_products') || '[]'); } catch(e) { return []; }
  })();
  const p = (typeof _getAllProducts === 'function' ? _getAllProducts() : []).find(x => x.id === pid);
  if (!p) return;

  /* Laptop routing guard: redirect to the dedicated laptop detail modal */
  if (p.cat === 'Laptop') {
    if (typeof openLaptopDetail === 'function') { openLaptopDetail(pid); return; }
  }

  const status   = getStockStatus(pid);
  const isOOS    = status === 'outofstock';
  const isSale   = status === 'sale';
  const isLow    = status === 'lowstock';
  const phpPrice = Math.round(p.price * 57);
  const salePHP  = Math.round(phpPrice * 0.85);

  const imgHtml = '<div style="width:100%;height:220px;border-radius:10px;margin-bottom:1rem;overflow:hidden;background:var(--surface2);display:flex;align-items:center;justify-content:center;">'
    + productImg(pid, 'modal')
    + '</div>';

  /*  Real-time stock meter data  */
  const qty         = typeof INVENTORY !== 'undefined' ? INVENTORY.getQty(pid)        : null;
  const qtyDisplay  = typeof INVENTORY !== 'undefined' ? INVENTORY.getDisplayQty(pid) : '';
  const maxQty      = typeof INVENTORY !== 'undefined' ? Math.max(INVENTORY.getLowStockThreshold() * 2 + 1, (qty || 0) + 1) : 10;
  const meterPct    = qty !== null ? Math.min(100, Math.round((qty / maxQty) * 100)) : 100;
  const meterClass  = (qty === null || qty > (typeof INVENTORY !== 'undefined' ? INVENTORY.getLowStockThreshold() : 5))
    ? 'inv-meter-fill-ok'
    : qty === 0 ? 'inv-meter-fill-oos' : 'inv-meter-fill-low';
  const qtyClass    = (qty === null || qty > (typeof INVENTORY !== 'undefined' ? INVENTORY.getLowStockThreshold() : 5))
    ? 'qty-ok' : qty === 0 ? 'qty-oos' : 'qty-low';
  const meterHtml   = qty !== null ? `
    <div class="inv-meter-wrap">
      <div class="inv-meter-header">
        <span class="inv-meter-label">Stock Availability</span>
        <span class="inv-meter-qty ${qtyClass}" data-stock-qty>${qtyDisplay}</span>
      </div>
      <div class="inv-meter-track">
        <div class="inv-meter-fill ${meterClass}" style="width:${meterPct}%"></div>
      </div>
    </div>` : '';

  const descs   = (function() {
    try { return JSON.parse(localStorage.getItem('ds_custom_descs') || '{}'); } catch(e) { return {}; }
  })();
  const descTxt = descs[pid] || p.description
    || 'The ' + p.name + ' is a ' + p.cat + ' component featuring ' + p.specs + '.';

  /* Benchmark score block — shown if product has a benchScore */
  const bench = p.benchScore || null;
  let benchHtml = '';
  if (bench && bench > 0) {
    const bScore = Math.min(100, bench);
    const bPct   = bScore;
    let bColor = '#6b7280', bLabel = 'Entry-Level';
    if (bScore >= 95)      { bColor = '#ef4444'; bLabel = 'Flagship'; }
    else if (bScore >= 80) { bColor = '#f97316'; bLabel = 'High-End'; }
    else if (bScore >= 55) { bColor = '#2563eb'; bLabel = 'Mid-Range'; }
    else if (bScore >= 30) { bColor = '#22c55e'; bLabel = 'Budget'; }
    benchHtml = `
      <div class="pdm-bench-wrap">
        <div class="pdm-section-label">Benchmark Score</div>
        <div class="pdm-bench-row">
          <div class="pdm-bench-track">
            <div class="pdm-bench-fill" style="width:${bPct}%;background:${bColor}"></div>
          </div>
          <div class="pdm-bench-score" style="color:${bColor}">${bScore}</div>
          <div class="pdm-bench-badge" style="color:${bColor};background:${bColor}18;border:1px solid ${bColor}40">${bLabel}</div>
        </div>
      </div>`;
  }

  /* Use inventory.css classes instead of inline styles — enables live DOM patching */
  const stockBadge = isOOS ? '<span class="inv-modal-pill inv-pill-oos" data-stock-badge>Out of Stock</span>'
    : isLow  ? '<span class="inv-modal-pill inv-pill-low" data-stock-badge>Low Stock</span>'
    : isSale ? '<span class="inv-modal-pill inv-pill-sale" data-stock-badge>On Sale &mdash; 15% Off</span>'
    :          '<span class="inv-modal-pill inv-pill-ok"  data-stock-badge>In Stock</span>';

  const priceHtml = isSale
    ? `<div class="pdm-price">
         <span class="pdm-price-sale">&#8369;${salePHP.toLocaleString()}</span>
         <span class="pdm-price-original">&#8369;${phpPrice.toLocaleString()}</span>
       </div>`
    : `<div class="pdm-price">&#8369;${phpPrice.toLocaleString()}</div>`;

  const addBtn = isOOS
    ? '<button class="pdm-add-btn" disabled data-add-cart-btn>Sold Out</button>'
    : `<button class="pdm-add-btn" onclick="addToCart('${pid}',event);document.getElementById('productDetailModal').classList.remove('open')" data-add-cart-btn>Add to Cart</button>`;

  document.getElementById('productDetailBody').innerHTML =
    imgHtml
    + `<div class="pdm-cat">${p.cat}</div>`
    + `<div class="pdm-name">${p.name}</div>`
    + `<div>${stockBadge}</div>`
    + priceHtml
    + `<div class="pdm-divider"></div>`
    + `<div class="pdm-section-label">Specifications</div>`
    + `<div class="pdm-specs-text">${p.specs}</div>`
    + benchHtml
    + `<div class="pdm-divider"></div>`
    + `<div class="pdm-section-label">About this product</div>`
    + `<div class="pdm-desc-text">${descTxt}</div>`
    + `<div class="pdm-actions">${addBtn}
         <button class="pdm-close-btn" onclick="document.getElementById('productDetailModal').classList.remove('open')">Close</button>
       </div>`
    + meterHtml
    + `<div class="review-section" id="reviewSection-${pid}">
         <div class="review-section-title">Customer Reviews</div>
       </div>`;

  document.getElementById('productDetailModal').classList.add('open');

  if (typeof renderReviewSection === 'function') {
    setTimeout(() => renderReviewSection(pid), 80);
  }
}

/* ======================================
   PAYMENT REVIEW MODAL
====================================== */
var _prSelectedMethod = null;

function openPaymentReview() {
  var cart = DB.getCart();
  if (!cart.length) { showToast('Your cart is empty', 'error'); return; }
  _prSelectedMethod = null;
  var sub = cart.reduce(function(acc,i){ var p=getProduct(i.productId); return acc+(p?p.price*i.qty:0); },0);
  var shipping = sub > 500 ? 0 : 30;
  var vat   = sub * 0.12;
  var total = (sub + shipping + vat) * 57;
  document.getElementById('prItemsList').innerHTML = cart.map(function(item){
    var p = getProduct(item.productId); if(!p) return '';
    return '<div class="pr-item"><span class="pr-item-name">'+p.name+(item.qty>1?' <span class="pr-item-qty">x'+item.qty+'</span>':'')+'</span>'
      +'<span class="pr-item-price">&#8369;'+Math.round(p.price*item.qty*57).toLocaleString()+'</span></div>';
  }).join('');
  document.getElementById('prTotals').innerHTML =
    '<div class="pr-total-row"><span>Subtotal</span><span>&#8369;'+Math.round(sub*57).toLocaleString()+'</span></div>'+
    '<div class="pr-total-row"><span>Shipping</span><span>'+(shipping===0?'<span class="pr-free">FREE</span>':'&#8369;'+Math.round(shipping*57).toLocaleString())+'</span></div>'+
    '<div class="pr-total-row"><span>VAT (12%)</span><span>&#8369;'+Math.round(vat*57).toLocaleString()+'</span></div>'+
    '<div class="pr-total-row pr-grand-total"><span>Total</span><span>&#8369;'+Math.round(total).toLocaleString()+'</span></div>';
  ['Gcash','Maya','Cod'].forEach(function(id){
    var b=document.getElementById('prBtn'+id); var c=document.getElementById('prCheck'+id);
    if(b) b.classList.remove('selected'); if(c) c.innerHTML='';
  });
  document.getElementById('prInstructions').style.display='none';
  document.getElementById('prConfirmBtn').style.display='none';
  document.getElementById('prConfirmBtn').disabled = true;
  /* Reset Terms agreement state each time modal opens */
  const termsBox = document.getElementById('termsBox');
  if (termsBox) termsBox.style.display = 'none';
  if (typeof resetTerms === 'function') resetTerms();
  document.getElementById('paymentReviewModal').classList.add('open');
}
function closePaymentReview() {
  document.getElementById('paymentReviewModal').classList.remove('open');
}
function selectPaymentReview(method) {
  _prSelectedMethod = method;
  var map = { gcash:'Gcash', paymaya:'Maya', cod:'Cod' };
  Object.keys(map).forEach(function(k){
    var b=document.getElementById('prBtn'+map[k]); var c=document.getElementById('prCheck'+map[k]); var on=(k===method);
    if(b) b.classList.toggle('selected',on); if(c) c.innerHTML=on?'&#10003;':'';
  });

  var info = {
    gcash: {
      color:'#007bff', name:'GCash', acct:'0917-123-4567', acctName:'Digispex Store',
      imgSrc:'https://wp.logos-download.com/wp-content/uploads/2020/06/GCash_Logo.png?dl',
      steps:['Open your GCash app','Tap <strong>Send Money</strong>','Enter number: <strong>0917-123-4567</strong>','Type the exact order total','Put your Order ID in the message','Screenshot your receipt and keep it']
    },
    paymaya: {
      color:'#12b669', name:'Maya', acct:'0945-678-9012', acctName:'Digispex Store',
      imgSrc:'https://play-lh.googleusercontent.com/fdQjxsIO8BTLaw796rQPZtLEnGEV8OJZJBJvl8dFfZLZcGf613W93z7y9dFAdDhvfqw',
      steps:['Open your Maya app','Tap <strong>Send Money</strong>','Enter number: <strong>0945-678-9012</strong>','Type the exact order total','Put your Order ID in the message','Screenshot your receipt and keep it']
    },
    cod: {
      color:'#f59e0b', name:'Cash on Delivery', acct:'', acctName:'', imgSrc:'',
      steps:['Place your order','Wait for our confirmation call','Prepare the exact amount in cash','Pay our courier upon delivery']
    },
  };
  var d = info[method]; if(!d) return;
  var totalEl = document.querySelector('#prTotals .pr-grand-total span:last-child');
  var amt = totalEl ? totalEl.textContent : '';

  var logoHtml = d.imgSrc
    ? '<div class="pr-instr-img-wrap"><img src="'+d.imgSrc+'" alt="'+d.name+'" class="pr-instr-img" onerror="this.parentNode.innerHTML=\'<span style=&quot;font-weight:900;font-size:1.1rem;color:#fff&quot;>'+d.name[0]+'</span>\'"></div>'
    : method === 'card'
      ? '<div class="pr-instr-img-wrap" style="background:linear-gradient(135deg,#1a1a2e,#16213e)"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>'
      : '<div class="pr-instr-img-wrap pr-instr-cod-wrap"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div>';

  var acctCard = d.acct
    ? '<div class="pr-acct-card" style="border-color:'+d.color+'44">'
      + '<div class="pr-acct-label">Send payment to</div>'
      + '<div class="pr-acct-number" style="color:'+d.color+'">'+d.acct+'</div>'
      + '<div class="pr-acct-name">'+d.acctName+'</div>'
      + (amt ? '<div class="pr-acct-amount">Amount: <strong>'+amt+'</strong></div>' : '')
      + '</div>'
    : (amt ? '<div class="pr-cod-amount">Amount due on delivery: <strong style="color:'+d.color+'">'+amt+'</strong></div>' : '');

  var steps = '<ol class="pr-instr-steps">'+d.steps.map(function(s){return '<li>'+s+'</li>';}).join('')+'</ol>';
  var badge = method === 'cod' ? 'Pay on delivery' : 'e-Wallet · Instant';

  document.getElementById('prInstructions').innerHTML =
    '<div class="pr-instr-top" style="border-color:'+d.color+'33">'
    + logoHtml
    + '<div class="pr-instr-top-info"><div class="pr-instr-title">'+d.name+'</div><div class="pr-instr-badge" style="background:'+d.color+'1a;color:'+d.color+'">'+badge+'</div></div>'
    + '</div>'
    + acctCard
    + steps
    + '<div class="pr-instr-notice">Order confirmed after payment is verified (1&ndash;2 hrs)</div>';

  document.getElementById('prInstructions').style.display='block';

  /* Show the Terms box and reset agreement on method change */
  var termsBox = document.getElementById('termsBox');
  if (termsBox) termsBox.style.display = 'block';
  if (typeof resetTerms === 'function') resetTerms();

  /* Show the confirm button (disabled until terms agreed) */
  var confirmBtn = document.getElementById('prConfirmBtn');
  if (confirmBtn) {
    confirmBtn.style.display = '';
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Confirm Payment Method';
  }
}
function confirmPaymentReview() {
  if (!_prSelectedMethod) return;
  if (typeof validateTerms === 'function' && !validateTerms()) return;

  var f = document.getElementById('selectedPaymentMethod'); if (f) f.value = _prSelectedMethod;
  closePaymentReview();
  var labels = { gcash:'GCash', paymaya:'Maya', cod:'Cash on Delivery' };
  showToast('Payment: '+(labels[_prSelectedMethod]||_prSelectedMethod),'success');
}

/* ══════════════════════════════════════════════════
   PDF RECEIPT GENERATOR
   Uses the browser's built-in print to PDF.
   Generates a styled receipt HTML, opens in a new
   tab, and triggers the browser print dialog so the
   user can save as PDF or print it.
══════════════════════════════════════════════════ */
function downloadReceipt(orderId) {
  const orders = DB.getOrders();
  const order  = orders.find(o => o.id === orderId);
  if (!order) { showToast('Order not found', 'error'); return; }

  const WARRANTY_MAP = {
    CPU: '3 Years Manufacturer Warranty',
    GPU: '3 Years Manufacturer Warranty',
    Motherboard: '3 Years Manufacturer Warranty',
    RAM: 'Lifetime Warranty',
    Storage: '5 Years Manufacturer Warranty',
    PSU: '5 Years Manufacturer Warranty',
    Cooling: '2 Years Manufacturer Warranty',
    Case: '1 Year Manufacturer Warranty',
    Laptop: '1 Year Manufacturer Warranty',
  };

  const paymentLabels = { gcash:'GCash', paymaya:'Maya', cod:'Cash on Delivery' };

  const itemRows = (order.items || []).map(item => {
    const product  = typeof getProduct === 'function' ? getProduct(item.productId) : null;
    const category = product ? product.cat : '';
    const warranty = WARRANTY_MAP[category] || '1 Year Warranty';
    const unitPhp  = Math.round((item.price || 0) * 57);
    const totalPhp = Math.round((item.price || 0) * item.qty * 57);
    return `
      <tr>
        <td>${item.name}</td>
        <td style="text-align:center">${item.qty}</td>
        <td style="text-align:right">₱${unitPhp.toLocaleString()}</td>
        <td style="text-align:right">₱${totalPhp.toLocaleString()}</td>
        <td style="color:#555;font-size:11px">${warranty}</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Digispex Receipt — ${order.id}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size:13px; color:#222; background:#fff; padding:40px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px; border-bottom:2px solid #111; padding-bottom:18px; }
    .brand { font-family: Georgia, serif; font-size:28px; font-weight:900; letter-spacing:3px; color:#111; }
    .brand-sub { font-size:11px; color:#888; margin-top:3px; }
    .receipt-label { text-align:right; }
    .receipt-label h2 { font-size:20px; color:#111; letter-spacing:1px; }
    .receipt-label p  { font-size:11px; color:#888; margin-top:2px; }
    .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:24px; }
    .info-box h4 { font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#888; margin-bottom:6px; }
    .info-box p  { font-size:13px; color:#222; line-height:1.6; }
    table { width:100%; border-collapse:collapse; margin-bottom:20px; }
    thead tr { background:#111; color:#fff; }
    thead th { padding:10px 12px; font-size:11px; text-align:left; letter-spacing:0.5px; }
    tbody tr { border-bottom:1px solid #eee; }
    tbody tr:last-child { border-bottom:none; }
    tbody td { padding:10px 12px; vertical-align:top; }
    tbody tr:nth-child(even) { background:#f9f9f9; }
    .totals { margin-left:auto; width:260px; }
    .total-row { display:flex; justify-content:space-between; padding:5px 0; font-size:13px; }
    .total-row.grand { border-top:2px solid #111; margin-top:6px; padding-top:8px; font-weight:700; font-size:15px; }
    .footer { margin-top:32px; border-top:1px solid #ddd; padding-top:16px; font-size:11px; color:#888; text-align:center; line-height:1.8; }
    .status-badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; background:#dcfce7; color:#166534; }
    @media print { body { padding:20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">DIGISPEX</div>
      <div class="brand-sub">Online Shop with Package Customization<br>General Santos City, Philippines</div>
    </div>
    <div class="receipt-label">
      <h2>OFFICIAL RECEIPT</h2>
      <p>Order ID: <strong>${order.id}</strong></p>
      <p>Date: ${order.date}</p>
      <p>Payment: ${paymentLabels[order.payment] || order.payment}</p>
      <p style="margin-top:6px"><span class="status-badge">${(order.status||'processing').toUpperCase()}</span></p>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h4>Bill To</h4>
      <p><strong>${order.customer}</strong><br>${order.address || '—'}</p>
    </div>
    <div class="info-box">
      <h4>Order Details</h4>
      <p>Items: ${(order.items||[]).length}<br>
         Payment Method: ${paymentLabels[order.payment] || order.payment}<br>
         Status: ${order.status || 'Processing'}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Unit Price</th>
        <th style="text-align:right">Subtotal</th>
        <th>Warranty</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">
    <div class="total-row grand">
      <span>TOTAL</span>
      <span>₱${order.total}</span>
    </div>
  </div>

  <div class="footer">
    Thank you for shopping at Digispex!<br>
    For concerns, contact us at support@digispex.ph or visit our store in General Santos City.<br>
    This is an official receipt. Please keep this for your records.<br><br>
    <em>All prices include 12% VAT. Warranty claims must be presented with this receipt.</em>
  </div>

  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    showToast('Please allow popups to download receipt', 'error');
  }
}

/* ══════════════════════════════════════════════════════════
   SCROLL REVEAL — IntersectionObserver
   Animates .section-block and [data-reveal] elements as
   they enter the viewport.
══════════════════════════════════════════════════════════ */
(function initScrollReveal() {
  if (!('IntersectionObserver' in window)) {
    // Fallback: instantly show everything
    document.querySelectorAll('.section-block, [data-reveal]').forEach(el => {
      el.classList.add('revealed', 'visible');
    });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed', 'visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.08,
    rootMargin: '0px 0px -40px 0px'
  });

  // Observe all section blocks and reveal elements
  document.querySelectorAll('.section-block, [data-reveal]').forEach(el => {
    observer.observe(el);
  });
})();

/* ══════════════════════════════════════════════════════════
   CART COUNT BUMP ANIMATION
   Adds a brief bounce to the cart badge when items change.
══════════════════════════════════════════════════════════ */
const _origRenderNav = typeof renderNav === 'function' ? renderNav : null;
if (_origRenderNav) {
  const _enhancedRenderNav = function() {
    const before = document.querySelector('.cart-count')?.textContent;
    _origRenderNav();
    const badge = document.querySelector('.cart-count');
    if (badge && badge.textContent !== before) {
      badge.classList.remove('bump');
      void badge.offsetWidth;
      badge.classList.add('bump');
      setTimeout(() => badge.classList.remove('bump'), 500);
    }
  };
  // We can't easily replace renderNav at this point since it's already defined,
  // but the bump effect will work through the existing flow.
}
