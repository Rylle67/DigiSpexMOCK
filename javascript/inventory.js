/* ============================================================
   Digispex — inventory.js
   ── REAL-TIME STOCK & INVENTORY MANAGEMENT SYSTEM ──

   Architecture:
   ┌─────────────────────────────────────────────────────────┐
   │  localStorage key: 'ds_inv'                             │
   │  Structure: { [productId]: number }                     │
   │  • Positive integer = units available                   │
   │  • 0 = out of stock                                     │
   │  • Key absent = unlimited / status-only tracking        │
   │                                                         │
   │  localStorage key: 'ds_stock'  (unchanged — status)    │
   │  • 'normal' | 'sale' | 'lowstock' | 'outofstock'       │
   │  • Auto-updated when qty hits thresholds                │
   └─────────────────────────────────────────────────────────┘

   Public API (window.INVENTORY):
     getQty(productId)            → number | null
     setQty(productId, qty)       → void
     deduct(productId, qty)       → { ok, remaining, message }
     restore(productId, qty)      → void
     canFulfill(productId, qty)   → { ok, available, message }
     validateCart(cartArr)        → [{ productId, name, requested, available }]
     deductCart(cartArr)          → void  (bulk deduct on order confirm)
     syncStatus(productId)        → void  (updates ds_stock thresholds)
     hasQtyTracking(productId)    → boolean
     getLowStockThreshold()       → number
     getDisplayQty(productId)     → string  ('In Stock' | '3 left' | 'Out of Stock')

   Events dispatched on window:
     'ds:inventory:change'  — { detail: { productId, qty, oldQty } }
     'ds:inventory:oos'     — { detail: { productId } }

   Thresholds (tunable):
     LOW_STOCK_THRESHOLD = 5   → auto-set status to 'lowstock'
     OOS_THRESHOLD       = 0   → auto-set status to 'outofstock'
     DEFAULT_STOCK       = 10  → qty assigned to new products
============================================================ */

const INVENTORY = (() => {

  /* ── Constants ─────────────────────────────────────────── */
  const INV_KEY             = 'ds_inv';
  const STOCK_KEY           = 'ds_stock';
  const LOW_STOCK_THRESHOLD = 5;
  const DEFAULT_STOCK       = 10;

  /* ── Storage helpers ────────────────────────────────────── */
  function _readInv()        { try { return JSON.parse(localStorage.getItem(INV_KEY)  || '{}'); } catch { return {}; } }
  function _writeInv(data)   { try { localStorage.setItem(INV_KEY, JSON.stringify(data)); }      catch {} }
  function _readStatus()     { try { return JSON.parse(localStorage.getItem(STOCK_KEY)|| '{}'); } catch { return {}; } }
  function _writeStatus(data){ try { localStorage.setItem(STOCK_KEY, JSON.stringify(data)); }    catch {} }

  /* ── Dispatch a DOM event so UI can react ────────────────── */
  function _dispatch(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch {}
  }

  /* ── Sync qty → status badge automatically ──────────────── */
  function _syncStatus(productId, qty) {
    const statuses = _readStatus();
    const current  = statuses[productId] || 'normal';
    let next       = current;

    if (qty <= 0) {
      next = 'outofstock';
    } else if (qty <= LOW_STOCK_THRESHOLD) {
      /* Only promote to lowstock — don't override 'sale' downward */
      if (current === 'normal' || current === 'lowstock') next = 'lowstock';
    } else {
      /* Recovering from oos/lowstock back to normal */
      if (current === 'outofstock' || current === 'lowstock') next = 'normal';
    }

    if (next !== current) {
      if (next === 'normal') delete statuses[productId];
      else statuses[productId] = next;
      _writeStatus(statuses);

      /* Log to audit trail if admin.js is loaded */
      if (typeof pushAudit === 'function') {
        const name = typeof getProduct === 'function' ? (getProduct(productId)||{}).name || productId : productId;
        pushAudit({
          type: 'status_change',
          productId,
          productName: name,
          oldStatus: current,
          newStatus: next,
          source: 'inventory_auto_sync'
        });
      }
    }
  }

  /* ── Seed default quantities for all known products ─────── */
  function _seedDefaults() {
    const inv      = _readInv();
    const statuses = _readStatus();
    let   changed  = false;

    /* Pull all products (catalog + custom) */
    const products = [
      ...(typeof PRODUCTS !== 'undefined' ? PRODUCTS : []),
      ...(function(){ try { return JSON.parse(localStorage.getItem('ds_custom_products')||'[]'); } catch { return []; } })()
    ];

    products.forEach(p => {
      if (typeof inv[p.id] === 'number') return; /* already seeded */

      const status = statuses[p.id] || 'normal';
      /* Don't seed a qty for OOS products set by admin — leave them at 0 */
      if (status === 'outofstock') {
        inv[p.id] = 0;
      } else if (status === 'lowstock') {
        inv[p.id] = Math.floor(Math.random() * LOW_STOCK_THRESHOLD) + 1; /* 1–5 */
      } else {
        inv[p.id] = DEFAULT_STOCK;
      }
      changed = true;
    });

    if (changed) _writeInv(inv);
  }

  /* ── Public API ─────────────────────────────────────────── */
  return {

    init() {
      _seedDefaults();
    },

    getLowStockThreshold() {
      return LOW_STOCK_THRESHOLD;
    },

    /** Return the numeric qty for productId, or null if not tracked. */
    getQty(productId) {
      const inv = _readInv();
      return typeof inv[productId] === 'number' ? inv[productId] : null;
    },

    /** Whether this product has numeric quantity tracking. */
    hasQtyTracking(productId) {
      return typeof _readInv()[productId] === 'number';
    },

    /**
     * Manually set quantity (used by admin panel).
     * Automatically syncs status badge.
     */
    setQty(productId, qty) {
      const safeQty = Math.max(0, Math.floor(qty));
      const inv     = _readInv();
      const oldQty  = inv[productId] ?? null;
      inv[productId] = safeQty;
      _writeInv(inv);
      _syncStatus(productId, safeQty);
      _dispatch('ds:inventory:change', { productId, qty: safeQty, oldQty });
      if (safeQty === 0) _dispatch('ds:inventory:oos', { productId });
    },

    /** Sync status badge from current qty (call after external status changes). */
    syncStatus(productId) {
      const qty = this.getQty(productId);
      if (qty !== null) _syncStatus(productId, qty);
    },

    /**
     * Check whether an order of `qty` units can be fulfilled.
     * Returns { ok: bool, available: number, message: string }
     */
    canFulfill(productId, qty) {
      const status = (() => {
        try { return (_readStatus()[productId] || 'normal'); } catch { return 'normal'; }
      })();

      if (status === 'outofstock') {
        return { ok: false, available: 0, message: 'This product is out of stock.' };
      }

      const available = this.getQty(productId);
      if (available === null) {
        /* No qty tracking — only status tracking. Allow if status is not OOS. */
        return { ok: true, available: Infinity, message: '' };
      }
      if (available <= 0) {
        return { ok: false, available: 0, message: 'This product is out of stock.' };
      }
      if (qty > available) {
        return {
          ok: false,
          available,
          message: `Not enough stock. Only ${available} unit${available !== 1 ? 's' : ''} available.`
        };
      }
      return { ok: true, available, message: '' };
    },

    /**
     * Deduct qty units from stock after a confirmed purchase.
     * Safe: qty can never go below 0.
     * Returns { ok, remaining, message }
     */
    deduct(productId, qty) {
      const check = this.canFulfill(productId, qty);
      if (!check.ok) return { ok: false, remaining: check.available, message: check.message };

      const inv     = _readInv();
      const current = inv[productId];
      if (typeof current !== 'number') {
        /* Status-only product — just return ok */
        return { ok: true, remaining: Infinity, message: '' };
      }

      const remaining   = Math.max(0, current - qty);
      inv[productId]    = remaining;
      _writeInv(inv);
      _syncStatus(productId, remaining);

      _dispatch('ds:inventory:change', { productId, qty: remaining, oldQty: current });
      if (remaining === 0) _dispatch('ds:inventory:oos', { productId });

      return { ok: true, remaining, message: '' };
    },

    /**
     * Restore qty units (e.g. cancelled order).
     * Will not auto-trigger OOS.
     */
    restore(productId, qty) {
      const inv     = _readInv();
      const current = inv[productId];
      if (typeof current !== 'number') return;
      const next    = current + Math.max(0, qty);
      inv[productId] = next;
      _writeInv(inv);
      _syncStatus(productId, next);
      _dispatch('ds:inventory:change', { productId, qty: next, oldQty: current });
    },

    /**
     * Validate an entire cart array before checkout.
     * Returns an array of problem items (empty = all ok).
     * Each problem: { productId, name, requested, available }
     */
    validateCart(cartArr) {
      const problems = [];
      cartArr.forEach(item => {
        const check = this.canFulfill(item.productId, item.qty);
        if (!check.ok) {
          const name = typeof getProduct === 'function'
            ? (getProduct(item.productId) || {}).name || item.productId
            : item.productId;
          problems.push({
            productId: item.productId,
            name,
            requested: item.qty,
            available: check.available,
            message: check.message
          });
        }
      });
      return problems;
    },

    /**
     * Bulk-deduct an entire cart (called after order is confirmed).
     * Skips items that can't be deducted (validation should have run first).
     */
    deductCart(cartArr) {
      cartArr.forEach(item => this.deduct(item.productId, item.qty));
    },

    /**
     * Human-readable stock display string for product pages.
     *   qty > LOW_THRESHOLD  → 'In Stock'
     *   0 < qty ≤ threshold  → '3 left'
     *   qty = 0              → 'Out of Stock'
     *   no tracking          → ''  (don't show a number)
     */
    getDisplayQty(productId) {
      const qty = this.getQty(productId);
      if (qty === null) return '';
      if (qty <= 0)     return 'Out of Stock';
      if (qty <= LOW_STOCK_THRESHOLD) return qty + ' unit' + (qty !== 1 ? 's' : '') + ' left';
      return 'In Stock';
    }
  };

})();

/* ── Auto-init once DOM is ready ─────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  INVENTORY.init();
});

/* ── Live UI refresh on inventory change ─────────────────── */
/*
   Listens for the 'ds:inventory:change' event and re-renders
   any visible store/cart/builder pages without a full reload.
   Debounced to 120 ms so rapid bulk-deducts only trigger once.
*/
(function () {
  let _debounceTimer = null;

  function _refreshUI(productId) {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
      /* Re-render whichever page is currently visible */
      const active = document.querySelector('.page.active');
      if (!active) return;
      const pageId = active.id.replace('page-', '');

      if (pageId === 'store'    && typeof renderStore   === 'function') renderStore();
      if (pageId === 'cart'     && typeof renderCart    === 'function') renderCart();
      if (pageId === 'builder'  && typeof renderBuilder === 'function') renderBuilder();
      if (pageId === 'wishlist' && typeof renderWishlistPage === 'function') renderWishlistPage();

      /* Also update product detail modal if it's open */
      const modal = document.getElementById('productDetailModal');
      if (modal && modal.classList.contains('open') && productId) {
        /* Refresh just the stock badge and button inside the modal */
        _refreshProductModalStock(productId);
      }

      /* Update stock pill on any visible product cards for this product */
      _refreshProductCards(productId);
    }, 120);
  }

  /* Patch stock badge + Add-to-Cart button in the open product modal */
  function _refreshProductModalStock(productId) {
    const body = document.getElementById('productDetailBody');
    if (!body) return;
    const qty    = INVENTORY.getQty(productId);
    const status = (() => {
      try { return JSON.parse(localStorage.getItem('ds_stock') || '{}')[productId] || 'normal'; } catch { return 'normal'; }
    })();
    const isOOS  = status === 'outofstock' || qty === 0;
    const isLow  = status === 'lowstock';

    /* Update the stock pill */
    const pill = body.querySelector('[data-stock-badge]');
    if (pill) {
      if (isOOS)     { pill.textContent = 'Out of Stock'; pill.className = 'inv-modal-pill inv-pill-oos'; }
      else if (isLow){ pill.textContent = 'Low Stock';    pill.className = 'inv-modal-pill inv-pill-low'; }
      else           { pill.textContent = 'In Stock';     pill.className = 'inv-modal-pill inv-pill-ok'; }
    }

    /* Update qty counter */
    const qtyEl = body.querySelector('[data-stock-qty]');
    if (qtyEl) qtyEl.textContent = INVENTORY.getDisplayQty(productId);

    /* Disable add-to-cart button if OOS */
    const addBtn = body.querySelector('[data-add-cart-btn]');
    if (addBtn) {
      addBtn.disabled      = isOOS;
      addBtn.style.opacity = isOOS ? '0.4' : '1';
      addBtn.style.cursor  = isOOS ? 'not-allowed' : 'pointer';
      addBtn.textContent   = isOOS ? 'Sold Out' : 'Add to Cart';
    }
  }

  /* Refresh the stock pill on visible product cards */
  function _refreshProductCards(productId) {
    if (!productId) return;
    document.querySelectorAll(`.product-card[data-pid="${productId}"]`).forEach(card => {
      const pillEl = card.querySelector('.inv-card-qty');
      if (pillEl) pillEl.textContent = INVENTORY.getDisplayQty(productId);
    });
  }

  window.addEventListener('ds:inventory:change', e => _refreshUI(e.detail?.productId));
})();
