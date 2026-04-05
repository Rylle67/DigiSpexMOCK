/* ============================================================
   Digispex — PC Builder & E-Commerce Platform
   catalog.js — Product database & builder slot definitions

   All products are added via the Admin Panel → Add Product tab.
   Categories are dynamically derived from product data.
   ============================================================ */

const PRODUCTS = [];
/* All products are added via the Admin Panel → Add Product tab */

/* ============================================================
   CATEGORIES — Dynamically derived from product data
   
   getCategories()       → ['All', 'CPU', 'GPU', …, 'Laptop']
   getStoreCategories()  → ['All', 'CPU', 'GPU', …] (no Laptop — has its own page)
============================================================ */

/* Base category order — ensures consistent sort even if products are sparse */
const _BASE_CAT_ORDER = ['CPU', 'GPU', 'Motherboard', 'RAM', 'Storage', 'PSU', 'Cooling', 'Case', 'Laptop'];

/**
 * Build a dynamic category list from all existing products.
 * Always starts with 'All', then sorts by the predefined order,
 * appending any new categories found in custom products at the end.
 */
function getCategories() {
  const products = _getAllProducts();
  const catSet = new Set(products.map(p => p.cat).filter(Boolean));
  const ordered = _BASE_CAT_ORDER.filter(c => catSet.has(c));
  /* Append any categories not in the base list (future-proofing) */
  catSet.forEach(c => { if (!ordered.includes(c)) ordered.push(c); });
  return ['All', ...ordered];
}

/**
 * Store-only categories — always shows all component categories (excludes Laptop).
 * Components always appear even if no products exist yet.
 */
function getStoreCategories() {
  const baseCats = _BASE_CAT_ORDER.filter(c => c !== 'Laptop');
  /* Also include any custom categories from products that aren't in the base list */
  const products = _getAllProducts().filter(p => p.cat !== 'Laptop');
  const extraCats = [...new Set(products.map(p => p.cat).filter(c => c && !baseCats.includes(c)))];
  return ['All', ...baseCats, ...extraCats];
}

/* Legacy reference — kept as a getter for backward compatibility with admin.js */
const CATEGORIES = new Proxy([], {
  get(target, prop) {
    const cats = getCategories();
    if (prop === 'length') return cats.length;
    if (prop === 'map' || prop === 'forEach' || prop === 'filter' ||
        prop === 'includes' || prop === 'indexOf' || prop === 'join' ||
        prop === 'slice' || prop === 'some' || prop === 'every' ||
        prop === Symbol.iterator) return cats[prop].bind(cats);
    const idx = Number(prop);
    if (!isNaN(idx)) return cats[idx];
    return cats[prop];
  }
});

/* ============================================================
   BUILDER SLOTS
============================================================ */
const BUILDER_SLOTS = [
  { key: 'CPU',         label: 'Processor',     cat: 'CPU',         required: true  },
  { key: 'GPU',         label: 'Graphics Card', cat: 'GPU',         required: true  },
  { key: 'Motherboard', label: 'Motherboard',   cat: 'Motherboard', required: true  },
  { key: 'RAM',         label: 'Memory',        cat: 'RAM',         required: true  },
  { key: 'Storage',     label: 'Storage',       cat: 'Storage',     required: true  },
  { key: 'PSU',         label: 'Power Supply',  cat: 'PSU',         required: true  },
  { key: 'Cooling',     label: 'CPU Cooler',    cat: 'Cooling',     required: false },
  { key: 'Case',        label: 'Case',          cat: 'Case',        required: false },
];

/* ============================================================
   CATALOG HELPERS
============================================================ */

function _getCustomProducts() {
  try { return JSON.parse(localStorage.getItem('ds_custom_products') || '[]'); } catch(e) { return []; }
}

function _getAllProducts() {
  const hidden = (function(){ try{ return JSON.parse(localStorage.getItem('ds_hidden_products')||'[]'); }catch(e){ return []; }})();
  const base = hidden.length ? PRODUCTS.filter(p => !hidden.includes(p.id)) : PRODUCTS;
  return [...base, ..._getCustomProducts()];
}

function getProduct(id) {
  return _getAllProducts().find(p => p.id === id);
}

function getProductsByCategory(cat) {
  return _getAllProducts().filter(p => p.cat === cat);
}

/**
 * Check whether a product is currently on sale via admin stock status.
 */
function isProductOnSale(productId) {
  try {
    const stock = JSON.parse(localStorage.getItem('ds_stock') || '{}');
    return stock[productId] === 'sale';
  } catch { return false; }
}

/**
 * Derive the memory type constraint from a socket.
 * AM5 / LGA1851 → DDR5 only, AM4 → DDR4 only, LGA1700 → null (board decides).
 */
function getSocketMemType(socket) {
  if (socket === 'AM5')     return 'DDR5';
  if (socket === 'LGA1851') return 'DDR5';
  if (socket === 'AM4')     return 'DDR4';
  return null; // LGA1700: board-level choice (DDR4 or DDR5 depending on the motherboard)
}