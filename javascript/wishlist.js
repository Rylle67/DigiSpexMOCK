/* ============================================================
   Digispex — wishlist.js
   ── WISHLIST PAGE RENDERER ──

   Responsibilities:
   • Renders the dedicated Wishlist page (page-wishlist).
   • Works alongside the existing toggleWishlist() /
     isWishlisted() functions already in features.js.
   • Products display in a grid matching the main store style.
   • "Move to Cart" button on each wishlist card.
   • Empty state illustration when no items are saved.

   Dependencies:
   • features.js  — toggleWishlist(), isWishlisted(), _wishlist
   • app.js        — addToCart(), productImg(), getProduct()
   • catalog.js    — PRODUCTS
============================================================ */

/* ── Render the full wishlist page content ──────────────── */
function renderWishlistPage() {
  const grid = document.getElementById('wishlistGrid');
  const empty = document.getElementById('wishlistEmpty');
  if (!grid) return;

  /* Pull the live wishlist array from features.js */
  const ids = typeof _wishlist !== 'undefined' ? _wishlist : [];

  /* Build product list — include admin-added custom products */
  const customProducts = (function () {
    try { return JSON.parse(localStorage.getItem('ds_custom_products') || '[]'); }
    catch { return []; }
  })();
  const allProducts = [...(typeof PRODUCTS !== 'undefined' ? PRODUCTS : []), ...customProducts];

  /* Auto-clean orphaned wishlist IDs (products that no longer exist) */
  const allProductIds = new Set(allProducts.map(p => p.id));
  const orphanedIds = ids.filter(id => !allProductIds.has(id));
  if (orphanedIds.length) {
    orphanedIds.forEach(id => {
      const idx = ids.indexOf(id);
      if (idx !== -1) ids.splice(idx, 1);
    });
    if (typeof _saveWishlist === 'function') _saveWishlist(ids);
  }

  const wishlisted = allProducts.filter(p => ids.includes(p.id));

  /* Toggle empty state */
  if (!wishlisted.length) {
    grid.innerHTML  = '';
    grid.style.display = 'none';
    if (empty) empty.style.display = 'flex';
    return;
  }

  if (empty) empty.style.display = 'none';
  grid.style.display = '';

  grid.innerHTML = wishlisted.map(p => {
    const status   = typeof getStockStatus === 'function' ? getStockStatus(p.id) : 'normal';
    const isOOS    = status === 'outofstock';
    const isSale   = status === 'sale';
    const isLow    = status === 'lowstock';
    const phpPrice = Math.round(p.price * 57);
    const salePHP  = Math.round(phpPrice * 0.85);

    const priceLine = isSale
      ? `<span class="wl-price wl-price-sale">&#8369;${salePHP.toLocaleString()}</span>
         <span class="wl-price-original">&#8369;${phpPrice.toLocaleString()}</span>`
      : `<span class="wl-price">&#8369;${phpPrice.toLocaleString()}</span>`;

    const badge = isOOS ? '<span class="wl-badge wl-badge-oos">Out of Stock</span>'
      : isLow  ? '<span class="wl-badge wl-badge-low">Low Stock</span>'
      : isSale ? '<span class="wl-badge wl-badge-sale">Sale &minus;15%</span>'
      : '';

    const cartBtn = isOOS
      ? `<button class="wl-cart-btn" disabled>Sold Out</button>`
      : `<button class="wl-cart-btn"
           onclick="addToCart('${p.id}');renderWishlistPage()"
         >Add to Cart</button>`;

    const removeBtn = `<button class="wl-remove-btn"
      onclick="removeFromWishlistPage('${p.id}')"
      title="Remove from wishlist"
      aria-label="Remove from wishlist">
      <!-- Heart filled SVG -->
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    </button>`;

    const imgHtml = typeof productImg === 'function'
      ? productImg(p.id, 'card')
      : `<img src="" alt="${p.name}" class="product-photo product-photo--card">`;

    /* Rating badge */
    const ratingBadge = typeof getProductRatingBadge === 'function'
      ? getProductRatingBadge(p.id)
      : '';

    /* Category-aware click handler: laptops → openLaptopDetail */
    const _wlClickFn = p.cat === 'Laptop'
      ? `openLaptopDetail('${p.id}')`
      : `openProductModal('${p.id}')`;

    return `
      <div class="wl-card${isOOS ? ' wl-card-oos' : ''}" data-pid="${p.id}">
        <div class="wl-card-img" onclick="${_wlClickFn}">
          ${imgHtml}
          ${badge}
          ${removeBtn}
        </div>
        <div class="wl-card-body">
          <div class="wl-card-cat">${p.cat}</div>
          <div class="wl-card-name" onclick="${_wlClickFn}">${p.name}</div>
          <div class="wl-card-specs">${p.specs}</div>
          ${ratingBadge ? `<div class="wl-rating">${ratingBadge}</div>` : ''}
          <div class="wl-card-footer">
            <div class="wl-price-wrap">${priceLine}</div>
            ${cartBtn}
          </div>
        </div>
      </div>`;
  }).join('');

  /* Update the wishlist count badge in nav */
  _updateWishlistBadge();
}

/* ── Remove a product and re-render ────────────────────── */
function removeFromWishlistPage(productId) {
  if (typeof _wishlist === 'undefined') return;
  const i = _wishlist.indexOf(productId);
  if (i !== -1) {
    _wishlist.splice(i, 1);
    /* Use per-user storage key from features.js */
    if (typeof _saveWishlist === 'function') {
      _saveWishlist(_wishlist);
    } else {
      try { localStorage.setItem('nexus_wishlist', JSON.stringify(_wishlist)); } catch {}
    }
  }
  /* Also update the heart button on any visible product cards */
  document.querySelectorAll(`.wishlist-btn[data-pid="${productId}"]`).forEach(btn => {
    btn.classList.remove('wishlisted');
  });
  renderWishlistPage();
  if (typeof showToast === 'function') showToast('Removed from wishlist', 'info');
}

/* ── Update the nav wishlist count badge ────────────────── */
function _updateWishlistBadge() {
  const badge = document.getElementById('wishlistNavBadge');
  if (!badge) return;
  /* Only count wishlisted products that still exist in the catalog */
  const ids = typeof _wishlist !== 'undefined' ? _wishlist : [];
  const count = ids.filter(id => typeof getProduct === 'function' ? !!getProduct(id) : true).length;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

/* ── Call on DOMContentLoaded to set initial badge ──────── */
document.addEventListener('DOMContentLoaded', () => {
  _updateWishlistBadge();
});
