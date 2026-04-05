//  rig rating 

/** 
 * Smart helper that extracts wattage from a PSU product if the numeric field is missing.
 * Scans name and specifications for patterns like "750W", "850 Watts", etc.
 */
function tryParseWattage(p) {
  if (!p) return 0;
  if (p.wattage && !isNaN(p.wattage)) return parseInt(p.wattage);
  
  // Try parsing from name or specs
  const lookIn = (p.name + ' ' + (p.specs || '')).toLowerCase();
  const match = lookIn.match(/(\d{3,4})\s*(w|watt|watts)\b/);
  if (match && match[1]) return parseInt(match[1]);
  
  // Fallback for cases where it's just "1000" or similar in specs
  if (p.cat === 'PSU' && p.specs) {
     const specMatch = p.specs.match(/(\d{3,4})/);
     if (specMatch && specMatch[1]) return parseInt(specMatch[1]);
  }
  
  return 0;
}

function calcRigRating(build) {
  const cpu     = build.CPU         ? getProduct(build.CPU)         : null;
  const gpu     = build.GPU         ? getProduct(build.GPU)         : null;
  const ram     = build.RAM         ? getProduct(build.RAM)         : null;
  const storage = build.Storage     ? getProduct(build.Storage)     : null;
  const psu     = build.PSU         ? getProduct(build.PSU)         : null;
  const cooler  = build.Cooling     ? getProduct(build.Cooling)     : null;
  const mb      = build.Motherboard ? getProduct(build.Motherboard) : null;

  let score = 0;
  // Refined Divisors: CPU 600, GPU 1600, RAM 250, Storage 200, PSU 1200, MB 400
  if (cpu)     score += Math.min(25, ((cpu.price || 0) / 600) * 25);
  if (gpu)     score += Math.min(40, ((gpu.price || 0) / 1600) * 40);
  if (ram)     score += Math.min(8,  ((ram.price || 0) / 250) * 8);
  if (storage) score += Math.min(7,  ((storage.price || 0) / 200) * 7);
  if (psu)     score += Math.min(5,  (tryParseWattage(psu) / 1200) * 5);
  if (mb)      score += Math.min(5,  ((mb.price || 0) / 400) * 5);
  if (cooler)  score += (cooler.specs || '').includes('360') ? 5 : (cooler.specs || '').includes('280') ? 4 : 3;

  // Bonus points for high-tier hardware signatures
  if (cpu && (cpu.name || '').includes('X3D')) score += 5;
  if (gpu && (gpu.name || '').includes('4090')) score += 5;
  if (ram && ram.memType === 'DDR5') score += 3;
  if (ram && (ram.specs || '').includes('64GB')) score += 5;
  if (storage && (storage.specs||'').includes('Gen5')) score += 3;

  const final = Math.min(100, Math.round(score));
  return isNaN(final) ? 0 : final;
}

function getRigLabel(score) {
  if (score >= 95) return { label: 'GODLIKE',   color: '#ff0044' };
  if (score >= 85) return { label: 'ULTRA',      color: '#ff6b35' };
  if (score >= 70) return { label: 'HIGH-END',   color: '#f59e0b' };
  if (score >= 55) return { label: 'SOLID',      color: '#3b82f6' };
  if (score >= 35) return { label: 'MID-RANGE',  color: '#22c55e' };
  if (score >= 15) return { label: 'BUDGET',     color: '#94a3b8' };
  return                 { label: 'EMPTY RIG',   color: '#334155' };
}

let _ratingTimer = null;

function animateRigRating(target) {
  const el    = document.getElementById('rigRatingValue');
  const arc   = document.getElementById('rigRatingArc');
  const badge = document.getElementById('rigRatingBadge');
  if (!el || !arc) return;

  // Prevent infinite loops if target is NaN
  if (isNaN(target)) target = 0;

  const { label, color } = getRigLabel(target);
  let cur = parseInt(el.textContent) || 0;

  clearInterval(_ratingTimer);
  if (cur === target) { _setRating(target, label, color, el, arc, badge); return; }

  const step = target > cur ? 1 : -1;
  const circ = 2 * Math.PI * 42;

  _ratingTimer = setInterval(() => {
    cur += step;
    arc.style.strokeDasharray  = circ;
    arc.style.strokeDashoffset = circ * (1 - cur / 100);
    arc.style.stroke           = color;
    el.textContent = cur;
    el.style.color = color;
    
    // Safer exit to prevent runaway loops
    if ((step === 1 && cur >= target) || (step === -1 && cur <= target)) {
      clearInterval(_ratingTimer);
      _setRating(target, label, color, el, arc, badge);
    }
  }, 12);
}

function _setRating(score, label, color, el, arc, badge) {
  el.textContent        = score;
  el.style.color        = color;
  badge.textContent     = label;
  badge.style.color     = color;
  badge.style.borderColor = color + '44';
  badge.style.background  = color + '11';
}


//  power meter 

function updatePowerMeter(build) {
  const cpu = build.CPU ? getProduct(build.CPU) : null;
  const gpu = build.GPU ? getProduct(build.GPU) : null;
  const psu = build.PSU ? getProduct(build.PSU) : null;

  const draw   = (cpu?.tdp || 0) + (gpu?.power || 0) + 75;
  const cap    = tryParseWattage(psu);
  const pct    = cap > 0 ? Math.min(100, (draw / cap) * 100) : 0;
  const color  = pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#22c55e';

  const fill = document.getElementById('powerFill');
  if (fill) {
    fill.style.width      = pct + '%';
    fill.style.background = color;
  }

  const pDraw = document.getElementById('powerDraw');
  if (pDraw) pDraw.textContent = draw + 'W draw';
  
  const pPSU = document.getElementById('powerPSU');
  if (pPSU) pPSU.textContent  = cap ? cap + 'W PSU' : (psu ? 'Unidentified Capacity' : 'No PSU');
  
  const pPct = document.getElementById('powerPct');
  if (pPct) {
    pPct.textContent  = cap ? Math.round(pct) + '% load' : '—';
    pPct.style.color  = color;
  }
}


//  compare 

let compareList = [];

function toggleCompare(productId, btn) {
  const i = compareList.indexOf(productId);
  if (i === -1) {
    if (compareList.length >= 3) { showToast('Max 3 products', 'error'); return; }
    compareList.push(productId);
    btn.classList.add('comparing');
    btn.textContent = 'Comparing';
  } else {
    compareList.splice(i, 1);
    btn.classList.remove('comparing');
    btn.textContent = 'Compare';
  }
  _updateCompareBar();
}

function _updateCompareBar() {
  const bar = document.getElementById('compareBar');
  if (!bar) return;
  if (!compareList.length) { bar.classList.remove('show'); return; }
  bar.classList.add('show');
  document.getElementById('compareChips').innerHTML = compareList.map(id => {
    const p = getProduct(id);
    return p ? `<span class="compare-chip">${p.name}<button onclick="removeCompare('${id}')"></button></span>` : '';
  }).join('');
  document.getElementById('compareCount').textContent = compareList.length + ' selected';
}

function removeCompare(id) {
  compareList = compareList.filter(x => x !== id);
  document.querySelectorAll('.compare-btn').forEach(btn => {
    if (btn.dataset.pid === id) { btn.classList.remove('comparing'); btn.textContent = 'Compare'; }
  });
  _updateCompareBar();
}

function openCompareModal() {
  if (compareList.length < 2) { showToast('Pick at least 2 to compare', 'error'); return; }
  const products = compareList.map(id => getProduct(id)).filter(Boolean);

  let html = '<div class="compare-table">';
  html += '<div class="compare-row compare-header"><div class="compare-cell compare-label">—</div>';
  products.forEach(p => {
    html += `<div class="compare-cell compare-product-head">
      <div class="compare-pname">${p.name}</div>
      <button class="btn-sm-add" onclick="addToCart('${p.id}');document.getElementById('compareModal').classList.remove('open')">Add to Cart</button>
    </div>`;
  });
  html += '</div>';

  [['Price', p => '₱' + (p.price * 57).toLocaleString()], ['Category', p => p.cat], ['Specs', p => p.specs]].forEach(([label, fn]) => {
    html += `<div class="compare-row"><div class="compare-cell compare-label">${label}</div>`;
    products.forEach(p => { html += `<div class="compare-cell">${fn(p) || '—'}</div>`; });
    html += '</div>';
  });
  html += '</div>';

  document.getElementById('compareModalBody').innerHTML = html;
  document.getElementById('compareModal').classList.add('open');
}


//  wishlist 

function _getWishlistKey() {
  try {
    const u = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    return u ? 'ds_wishlist_u_' + u.id : null;  // null means guest — no wishlist
  } catch { return null; }
}

function _loadWishlist() {
  const key = _getWishlistKey();
  if (!key) return [];  // guest has no wishlist
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function _saveWishlist(list) {
  const key = _getWishlistKey();
  if (!key) return;  // guests cannot persist wishlist
  try { localStorage.setItem(key, JSON.stringify(list)); } catch {}
  /* Sync to Supabase */
  if (typeof SB !== 'undefined') SB.pushWishlist(list);
}

/* Live wishlist array — always reflects the current logged-in user */
let _wishlist = _loadWishlist();

/* Reload wishlist when auth state changes (login/logout) */
function _reloadWishlist() {
  _wishlist.length = 0;
  const fresh = _loadWishlist();
  fresh.forEach(id => _wishlist.push(id));
  if (typeof _updateWishlistBadge === 'function') _updateWishlistBadge();
}

function toggleWishlist(productId, btn) {
  if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
    if (typeof openLoginModal === 'function') openLoginModal();
    showToast('Sign in to save items to your wishlist', 'error');
    return;
  }
  const i = _wishlist.indexOf(productId);
  if (i === -1) {
    _wishlist.push(productId);
    btn.classList.add('wishlisted');
    btn.title = 'Remove from wishlist';
    const svg = btn.querySelector('svg');
    if (svg) svg.setAttribute('fill', 'currentColor');
    showToast('Saved to wishlist', 'success');
  } else {
    _wishlist.splice(i, 1);
    btn.classList.remove('wishlisted');
    btn.title = 'Save to wishlist';
    const svg = btn.querySelector('svg');
    if (svg) svg.setAttribute('fill', 'none');
    showToast('Removed from wishlist', 'info');
  }
  _saveWishlist(_wishlist);
  if (typeof _updateWishlistBadge === 'function') _updateWishlistBadge();
}

function isWishlisted(id) {
  if (typeof getCurrentUser === 'function' && !getCurrentUser()) return false;
  return _wishlist.includes(id);
}


//  flash deals — ADMIN-CONTROLLED
//  Only shows products marked "On Sale" (status === 'sale') in the Admin Panel.
//  If no products are on sale, the entire Flash Deals section is hidden.

function getDailyDeals() {
  // Read stock status from admin-managed localStorage
  const stock = (function() {
    try { return JSON.parse(localStorage.getItem('ds_stock') || '{}'); }
    catch { return {}; }
  })();

  // Collect all products marked as 'sale'
  const allItems = typeof _getAllProducts === 'function' ? _getAllProducts() : [];
  const saleProducts = allItems.filter(p => stock[p.id] === 'sale');

  // Read optional per-product discount configs
  const saleConfig = (function() {
    try { return JSON.parse(localStorage.getItem('ds_sale_config') || '{}'); }
    catch { return {}; }
  })();

  return saleProducts.map(p => {
    const config = saleConfig[p.id] || {};
    const pct    = config.discount || 0.15; // default 15% off
    return {
      product:   p,
      pct:       pct,
      salePrice: Math.round(p.price * (1 - pct)),
    };
  });
}

function renderDeals() {
  const section = document.getElementById('flashDealsSection');
  const el      = document.getElementById('dealCards');
  if (!el) return;

  const deals = getDailyDeals();

  // If no products are on sale, COMPLETELY HIDE the Flash Deals section
  if (!deals.length) {
    if (section) section.style.display = 'none';
    return;
  }

  // Show the section
  if (section) section.style.display = '';

  el.innerHTML = deals.map((d, i) => `
    <div class="deal-card" style="animation-delay:${i * 0.1}s">
      <div class="deal-badge">${Math.round(d.pct * 100)}% OFF</div>
      <div class="deal-img-area">
        ${typeof productImg === 'function' ? productImg(d.product.id, 'card') : ''}
      </div>
      <div class="deal-cat-label">${d.product.cat}</div>
      <div class="deal-name">${d.product.name}</div>
      <div class="deal-specs">${d.product.specs}</div>
      <div class="deal-prices">
        <span class="deal-was">₱${(d.product.price * 57).toLocaleString()}</span>
        <span class="deal-now">₱${(d.salePrice * 57).toLocaleString()}</span>
      </div>
      <button class="btn-deal" onclick="addToCart('${d.product.id}',event)">Grab Deal →</button>
    </div>`).join('');

}

/* Auto-refresh Flash Deals when admin changes stock status in another tab */
window.addEventListener('storage', function(e) {
  if (e.key === 'ds_stock' || e.key === 'ds_sale_config') {
    if (typeof renderDeals === 'function') renderDeals();
  }
});



//  sort 

let currentSort = 'default';

function setSort(val) {
  currentSort = val;
  renderStore();
}

function applySortFilter(items) {
  if (currentSort === 'price-asc')  return [...items].sort((a, b) => a.price - b.price);
  if (currentSort === 'price-desc') return [...items].sort((a, b) => b.price - a.price);
  if (currentSort === 'name')       return [...items].sort((a, b) => a.name.localeCompare(b.name));
  if (currentSort === 'wishlist')   return items.filter(p => _wishlist.includes(p.id));
  return items;
}
