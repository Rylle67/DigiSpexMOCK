/* ============================================================
   Digispex Online Shop & Package Customization
   database.js — localStorage database layer + Supabase sync

   All persistent data lives here. Every read/write goes
   through the DB object. Data is cached in localStorage for
   fast synchronous reads, and all mutations are synced to
   Supabase in the background.

   Keys stored in localStorage:
     ds_cart    — Array of { productId, qty }
     ds_orders  — Array of order objects
     ds_build   — Object mapping slotKey → productId
============================================================ */

const DB = (() => {

  const PREFIX = 'ds_';
  const USER_SCOPED = ['cart', 'orders', 'build'];

  /* ---------- low-level helpers ---------- */

  function _userPrefix() {
    try {
      const u = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
      return u && u.id ? `u_${u.id}_` : 'guest_';
    } catch { return 'guest_'; }
  }

  function _key(key) {
    return PREFIX + (USER_SCOPED.includes(key) ? _userPrefix() : '') + key;
  }

  function _read(key) {
    try {
      const raw = localStorage.getItem(_key(key));
      return raw !== null ? JSON.parse(raw) : null;
    } catch (e) {
      console.error(`[DB] Failed to read "${key}":`, e);
      return null;
    }
  }

  function _write(key, value) {
    try {
      localStorage.setItem(_key(key), JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`[DB] Failed to write "${key}":`, e);
      return false;
    }
  }

  function _delete(key) {
    try {
      localStorage.removeItem(_key(key));
      return true;
    } catch (e) {
      console.error(`[DB] Failed to delete "${key}":`, e);
      return false;
    }
  }

  /* ---------- Supabase sync helper ---------- */
  function _syncCart() {
    const cart = _read('cart') || [];
    if (typeof SB !== 'undefined') SB.pushCart(cart);
  }

  function _syncBuild() {
    const build = _read('build') || {};
    if (typeof SB !== 'undefined') SB.pushBuild(build);
  }

  /* ---------- public API ---------- */

  return {

    init() {
      if (!_read('cart'))   _write('cart',   []);
      if (!_read('orders')) _write('orders', []);
      if (!_read('build'))  _write('build',  {});
    },

    /* ---- generic get / set ---- */
    get(key)        { return _read(key); },
    set(key, value) { return _write(key, value); },
    remove(key)     { return _delete(key); },

    /* ============================
       CART
    ============================ */

    getCart() {
      return _read('cart') || [];
    },

    getCartCount() {
      return this.getCart().reduce((sum, item) => sum + item.qty, 0);
    },

    cartAdd(productId) {
      const cart = this.getCart();
      const existing = cart.find(i => i.productId === productId);
      if (existing) {
        existing.qty += 1;
      } else {
        cart.push({ productId, qty: 1 });
      }
      _write('cart', cart);
      _syncCart();
    },

    cartUpdateQty(productId, delta) {
      let cart = this.getCart();
      const item = cart.find(i => i.productId === productId);
      if (!item) return;
      item.qty += delta;
      if (item.qty <= 0) cart = cart.filter(i => i.productId !== productId);
      _write('cart', cart);
      _syncCart();
    },

    cartRemove(productId) {
      const cart = this.getCart().filter(i => i.productId !== productId);
      _write('cart', cart);
      _syncCart();
    },

    cartClear() {
      _write('cart', []);
      _syncCart();
    },

    /* ============================
       ORDERS
    ============================ */

    getOrders() {
      return _read('orders') || [];
    },

    addOrder(order) {
      const orders = this.getOrders();
      orders.unshift(order);
      _write('orders', orders);
      /* Sync to Supabase */
      if (typeof SB !== 'undefined') SB.pushOrder(order);
    },

    updateOrderStatus(orderId, status) {
      const orders = this.getOrders();
      const order = orders.find(o => o.id === orderId);
      if (order) {
        order.status = status;
        _write('orders', orders);
        /* Sync to Supabase */
        if (typeof SB !== 'undefined') SB.updateOrderStatus(orderId, status);
      }
    },

    /* ============================
       PC BUILD
    ============================ */

    getBuild() {
      return _read('build') || {};
    },

    buildSetSlot(slotKey, productId) {
      const build = this.getBuild();
      build[slotKey] = productId;
      _write('build', build);
      _syncBuild();
    },

    buildClearSlot(slotKey) {
      const build = this.getBuild();
      delete build[slotKey];
      _write('build', build);
      _syncBuild();
    },

    buildClear() {
      _write('build', {});
      _syncBuild();
    },

    buildSave(buildObj) {
      _write('build', buildObj);
      _syncBuild();
    },

    /* ============================
       DEBUG / DEV HELPERS
    ============================ */

    dump() {
      console.group('[DB] Current state');
      console.log('cart:',   this.getCart());
      console.log('orders:', this.getOrders());
      console.log('build:',  this.getBuild());
      console.groupEnd();
    },

    reset() {
      ['cart', 'orders', 'build'].forEach(k => _delete(k));
      this.init();
      console.log('[DB] Database reset to defaults.');
    }
  };

})();