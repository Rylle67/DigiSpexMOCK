/* ============================================================
   Digispex — supabase-sync.js
   Bridge layer: syncs Supabase ↔ localStorage so existing
   rendering code works unchanged. All reads come from localStorage
   (fast, synchronous), all writes go to BOTH localStorage AND Supabase.
============================================================ */
'use strict';

const SB = (() => {

  /* ── Pull: Supabase → localStorage ──────────────────────── */
  async function pull() {
    console.log('[SB] Pulling data from Supabase…');

    /* 1 ─ Products → ds_custom_products, ds_stock, ds_inv, ds_custom_images, ds_custom_descs */
    const { data: products, error: pErr } = await window.SBClient
      .from('products').select('*');
    if (pErr) console.error('[SB] products fetch error:', pErr);
    const prods = products || [];

    const mapped = prods.map(p => ({
      id: p.id,
      name: p.name,
      cat: p.category,
      price: p.price_php / 57,
      specs: p.specs || '',
      benchScore: p.bench_score || 0,
      socket: p.socket || '',
      memType: p.mem_type || '',
      tdp: p.tdp || 0,
      power: p.power || 0,
      wattage: p.wattage || 0,
      length_mm: p.length_mm || 0,
      max_gpu_length: p.max_gpu_length || 0,
      form_factor: p.form_factor || '',
      supported_form_factors: p.supported_form_factors || '',
    }));
    localStorage.setItem('ds_custom_products', JSON.stringify(mapped));

    const stock = {};
    prods.forEach(p => { if (p.stock_status && p.stock_status !== 'normal') stock[p.id] = p.stock_status; });
    localStorage.setItem('ds_stock', JSON.stringify(stock));

    const inv = {};
    prods.forEach(p => { if (p.stock_qty !== undefined) inv[p.id] = p.stock_qty; });
    localStorage.setItem('ds_inv', JSON.stringify(inv));

    const imgs = {};
    prods.forEach(p => { if (p.image_url) imgs[p.id] = p.image_url; });
    localStorage.setItem('ds_custom_images', JSON.stringify(imgs));

    const descs = {};
    prods.forEach(p => { if (p.description) descs[p.id] = p.description; });
    localStorage.setItem('ds_custom_descs', JSON.stringify(descs));

    const hidden = prods.filter(p => p.hidden).map(p => p.id);
    localStorage.setItem('ds_hidden_products', JSON.stringify(hidden));

    /* 2 ─ Packages → ds_custom_packages */
    const { data: pkgs } = await window.SBClient.from('packages').select('*');
    localStorage.setItem('ds_custom_packages', JSON.stringify(
      (pkgs || []).map(p => ({
        id: p.id, name: p.name, cat: p.category,
        tagline: p.tagline || '', featured: !!p.featured,
        slots: p.slots || {}
      }))
    ));

    /* 3 ─ Audit log → ds_audit_log */
    const { data: auditData } = await window.SBClient
      .from('audit_log').select('*')
      .order('created_at', { ascending: false }).limit(200);
    localStorage.setItem('ds_audit_log', JSON.stringify(
      (auditData || []).map(a => ({ ...a.data, _ts: a.created_at, _sbId: a.id }))
    ));

    /* 4 ─ User-scoped data (only if logged in) */
    const { data: { user } } = await window.SBClient.auth.getUser();
    if (user) {
      const sess = JSON.parse(localStorage.getItem('ds_auth_session') || 'null');
      const uid = sess ? sess.id : user.id;
      const prefix = `u_${uid}_`;

      /* Cart */
      const { data: cartRows } = await window.SBClient.from('cart_items').select('*');
      const cart = (cartRows || []).map(r => ({ productId: r.product_id, qty: r.qty }));
      localStorage.setItem(`ds_${prefix}cart`, JSON.stringify(cart));

      /* Build */
      const { data: buildRow } = await window.SBClient
        .from('builds').select('slots').eq('user_id', user.id).maybeSingle();
      localStorage.setItem(`ds_${prefix}build`, JSON.stringify(buildRow?.slots || {}));

      /* Orders */
      const { data: ordersRows } = await window.SBClient
        .from('orders').select('*').order('created_at', { ascending: false });
      localStorage.setItem(`ds_${prefix}orders`, JSON.stringify(ordersRows || []));

      /* Wishlist */
      const { data: wlRows } = await window.SBClient.from('wishlist').select('product_id');
      const wlIds = (wlRows || []).map(w => w.product_id);
      localStorage.setItem(`ds_wishlist_${uid}`, JSON.stringify(wlIds));

      /* Notifications */
      const { data: notifRows } = await window.SBClient
        .from('notifications').select('*')
        .order('created_at', { ascending: false });
      localStorage.setItem(`ds_notifications_${uid}`, JSON.stringify(notifRows || []));
    }

    console.log('[SB] Pull complete ✓');
  }

  /* ── Push helpers: localStorage → Supabase ─────────────── */

  async function pushProduct(product) {
    const { error } = await window.SBClient.from('products').upsert({
      id: product.id,
      name: product.name,
      category: product.cat,
      price_php: Math.round(product.price * 57),
      specs: product.specs || '',
      description: product.description || '',
      image_url: product.imageUrl || '',
      bench_score: product.benchScore || 0,
      stock_status: product.stockStatus || 'normal',
      stock_qty: product.stockQty !== undefined ? product.stockQty : 50,
      socket: product.socket || null,
      mem_type: product.memType || null,
      tdp: product.tdp || 0,
      power: product.power || 0,
      wattage: product.wattage || 0,
      length_mm: product.length_mm || 0,
      max_gpu_length: product.max_gpu_length || 0,
      form_factor: product.form_factor || null,
      supported_form_factors: product.supported_form_factors || null,
      hidden: !!product.hidden,
    });
    if (error) console.error('[SB] pushProduct error:', error);
  }

  async function deleteProduct(id) {
    const { error } = await window.SBClient.from('products').delete().eq('id', id);
    if (error) {
      console.error('[SB] deleteProduct error:', error);
      return;
    }

    /* ── Cleanup Cascade: Remove deleted product from all local scopes ── */
    const sess = JSON.parse(localStorage.getItem('ds_auth_session') || 'null');
    const prefix = sess ? `u_${sess.id}_` : 'guest_';
    
    // 1. Cleanup Cart
    const cartKey = `ds_${prefix}cart`;
    let cart = JSON.parse(localStorage.getItem(cartKey) || '[]');
    const newCart = cart.filter(item => item.productId !== id);
    if (newCart.length !== cart.length) localStorage.setItem(cartKey, JSON.stringify(newCart));

    // 2. Cleanup Build
    const buildKey = `ds_${prefix}build`;
    let build = JSON.parse(localStorage.getItem(buildKey) || '{}');
    let changed = false;
    for (const slot in build) {
      if (build[slot] === id) { delete build[slot]; changed = true; }
    }
    if (changed) {
      localStorage.setItem(buildKey, JSON.stringify(build));
      if (typeof renderBuilder === 'function') renderBuilder();
    }
    
    // 3. Clear from catalog immediately
    let customs = JSON.parse(localStorage.getItem('ds_custom_products') || '[]');
    localStorage.setItem('ds_custom_products', JSON.stringify(customs.filter(p => p.id !== id)));
  }

  async function updateProduct(id, updates) {
    const { error } = await window.SBClient.from('products').update(updates).eq('id', id);
    if (error) console.error('[SB] updateProduct error:', error);
  }

  async function pushCart(cartArray) {
    const { data: { user } } = await window.SBClient.auth.getUser();
    if (!user) return;
    await window.SBClient.from('cart_items').delete().eq('user_id', user.id);
    if (cartArray.length) {
      await window.SBClient.from('cart_items').insert(
        cartArray.map(i => ({ user_id: user.id, product_id: i.productId, qty: i.qty }))
      );
    }
  }

  async function pushBuild(buildObj) {
    const { data: { user } } = await window.SBClient.auth.getUser();
    if (!user) return;
    await window.SBClient.from('builds').upsert(
      { user_id: user.id, slots: buildObj },
      { onConflict: 'user_id' }
    );
  }

  async function pushOrder(order) {
    const { data: { user } } = await window.SBClient.auth.getUser();
    await window.SBClient.from('orders').insert({
      id: order.id,
      user_id: user ? user.id : null,
      items: order.items,
      total: order.total,
      status: order.status || 'processing',
      customer_name: order.customer?.name || '',
      customer_email: order.customer?.email || '',
    });
  }

  async function updateOrderStatus(orderId, status) {
    await window.SBClient.from('orders').update({ status }).eq('id', orderId);
  }

  async function deleteOrder(orderId) {
    await window.SBClient.from('orders').delete().eq('id', orderId);
  }

  async function pushWishlist(wishlistIds) {
    const { data: { user } } = await window.SBClient.auth.getUser();
    if (!user) return;
    await window.SBClient.from('wishlist').delete().eq('user_id', user.id);
    if (wishlistIds.length) {
      await window.SBClient.from('wishlist').insert(
        wishlistIds.map(pid => ({ user_id: user.id, product_id: pid }))
      );
    }
  }

  async function pushAuditEntry(entry) {
    await window.SBClient.from('audit_log').insert({ type: entry.type || 'unknown', data: entry });
  }

  async function pushPackage(pkg) {
    await window.SBClient.from('packages').upsert({
      id: pkg.id,
      name: pkg.name,
      category: pkg.cat || 'Gaming',
      tagline: pkg.tagline || '',
      featured: !!pkg.featured,
      slots: pkg.slots || {},
    });
  }

  async function deletePackage(id) {
    await window.SBClient.from('packages').delete().eq('id', id);
  }

  async function pushNotification(userId, notif) {
    await window.SBClient.from('notifications').insert({
      user_id: userId,
      title: notif.title || '',
      body: notif.body || '',
      type: notif.type || 'info',
      ref_id: notif.refId || null,
    });
  }

  async function pushMessage(orderId, sender, body) {
    await window.SBClient.from('messages').insert({ order_id: orderId, sender, body });
  }

  async function getMessages(orderId) {
    const { data } = await window.SBClient.from('messages').select('*')
      .eq('order_id', orderId).order('created_at', { ascending: true });
    return data || [];
  }

  /* ── Public API ─────────────────────────────────────────── */
  return {
    pull,
    pushProduct,
    deleteProduct,
    updateProduct,
    pushCart,
    pushBuild,
    pushOrder,
    updateOrderStatus,
    deleteOrder,
    pushWishlist,
    pushAuditEntry,
    pushPackage,
    deletePackage,
    pushNotification,
    pushMessage,
    getMessages,
  };
})();
