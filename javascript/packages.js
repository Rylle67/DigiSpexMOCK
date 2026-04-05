/* ============================================================
   Digispex Online Shop — Package Customization Engine
   packages.js  v1.0

   Features:
     • 8 curated packages across 6 categories
     • Per-package component swapping
     • Bundle pricing — components at full market price
     • One-click cart add or load into PC Builder
     • 33-laptop store with filter, search, sort
     • Laptop detail modal with full spec table
   ============================================================ */

//  PHP conversion rate 
const PHP = 57;

/* ============================================================
   PACKAGE DEFINITIONS
   Each package has: id, name, category, icon, tagline,
   color, featured flag, and slot map
============================================================ */

const PACKAGES = [
  {
    id: 'gaming_starter', name: 'Gaming Starter', category: 'Gaming',
    icon: '', tagline: '1080p at 100+ FPS — the perfect first build',
    color: '#22c55e', featured: false,
    slots: {
      CPU: 'cpu_r5_5600', GPU: 'gpu_4060', Motherboard: 'mb8', RAM: 'ram4',
      Storage: 'ssd_mx500_2tb', PSU: 'psu_rm650x', Cooling: 'cool_thermalright', Case: 'case_darkflash'
    }
  },
  {
    id: 'gaming_pro', name: 'Gaming Pro', category: 'Gaming',
    icon: '', tagline: '1440p/4K powerhouse — competitive and AAA',
    color: '#ef4444', featured: true,
    slots: {
      CPU: 'cpu_r7_7800x3d', GPU: 'gpu_4070s', Motherboard: 'mb4', RAM: 'ram6',
      Storage: 'ssd1', PSU: 'psu_rm750x', Cooling: 'cool_arctic_240', Case: 'case3'
    }
  },
  {
    id: 'gaming_ultra', name: 'Gaming Ultra', category: 'Gaming',
    icon: '', tagline: 'RTX 4090 no-compromise 4K / 240Hz',
    color: '#f59e0b', featured: false,
    slots: {
      CPU: 'cpu_r9_7950x3d', GPU: 'gpu1', Motherboard: 'mb11', RAM: 'ram1',
      Storage: 'ssd_t705_2tb', PSU: 'psu1', Cooling: 'cool1', Case: 'case1'
    }
  },
  {
    id: 'creator_station', name: 'Creator Station', category: 'Creator',
    icon: '', tagline: 'Video editing, 3D rendering and live streaming',
    color: '#a855f7', featured: true,
    slots: {
      CPU: 'cpu1', GPU: 'gpu_4080', Motherboard: 'mb3', RAM: 'ram_gz5_64_6400',
      Storage: 'ssd_990pro_4tb', PSU: 'psu_rm1000x', Cooling: 'cool3', Case: 'case_corsair_7000d'
    }
  },
  {
    id: 'office_essential', name: 'Office Essential', category: 'Office',
    icon: '', tagline: 'Fast, quiet, reliable — daily productivity beast',
    color: '#3b82f6', featured: false,
    slots: {
      CPU: 'cpu_i5_14400f', GPU: 'gpu_4060', Motherboard: 'mb8', RAM: 'ram4',
      Storage: 'ssd_mx500_2tb', PSU: 'psu_rm650x', Cooling: 'cool_thermalright', Case: 'case_darkflash'
    }
  },
  {
    id: 'school_budget', name: 'School Budget', category: 'School',
    icon: '', tagline: 'Homework, research and light gaming under ₱40k',
    color: '#06b6d4', featured: false,
    slots: {
      CPU: 'cpu_r5_5600', GPU: 'gpu_4060', Motherboard: 'mb8', RAM: 'ram4',
      Storage: 'ssd_mx500_2tb', PSU: 'psu_rm650x', Cooling: 'cool_thermalright', Case: 'case_darkflash'
    }
  },
  {
    id: 'workstation_pro', name: 'Workstation Pro', category: 'Workstation',
    icon: '', tagline: 'Multitasking beast — developers and engineers',
    color: '#8b5cf6', featured: false,
    slots: {
      CPU: 'cpu_r9_9950x', GPU: 'gpu_5090', Motherboard: 'mb_x870e_hero', RAM: 'ram_gz5_64_6400',
      Storage: 'ssd_t705_2tb', PSU: 'psu_be_1600', Cooling: 'cool_rog_360', Case: 'case_corsair_7000d'
    }
  },
  {
    id: 'streaming_setup', name: 'Streaming Setup', category: 'Streaming',
    icon: '', tagline: 'Dual-PC quality in one rig — stream and play together',
    color: '#ec4899', featured: false,
    slots: {
      CPU: 'cpu1', GPU: 'gpu_4080', Motherboard: 'mb3', RAM: 'ram_gz5_64_6400',
      Storage: 'ssd_990pro_4tb', PSU: 'psu_rm1000x', Cooling: 'cool3', Case: 'case3'
    }
  },
];

/* Dynamically derive package categories from actual package data */
const _BASE_PKG_CAT_ORDER = ['Gaming', 'Creator', 'Office', 'School', 'Workstation', 'Streaming'];
function getPkgCategories() {
  const pkgs = _getPackages();
  const catSet = new Set(pkgs.map(p => p.category).filter(Boolean));
  const ordered = _BASE_PKG_CAT_ORDER.filter(c => catSet.has(c));
  catSet.forEach(c => { if (!ordered.includes(c)) ordered.push(c); });
  return ['All', ...ordered];
}
const PKG_CATEGORIES = new Proxy([], {
  get(target, prop) {
    const cats = getPkgCategories();
    if (prop === 'length') return cats.length;
    if (typeof cats[prop] === 'function') return cats[prop].bind(cats);
    const idx = Number(prop);
    if (!isNaN(idx)) return cats[idx];
    return cats[prop];
  }
});

/* Always read from localStorage first so admin changes take effect immediately.
   Falls back to the hardcoded PACKAGES array if nothing is saved yet. */
function _getPackages() {
  try {
    const saved = JSON.parse(localStorage.getItem('ds_custom_packages') || 'null');
    if (Array.isArray(saved) && saved.length) return saved;
  } catch (e) { }
  return PACKAGES;
}

// Per-session customizations: pkgId → { slotKey: productId }
const _pkgCustom = {};

let currentPkgCategory = 'All';

//  Helpers 

function _getPkgSlots(pkg) {
  return Object.assign({}, pkg.slots, _pkgCustom[pkg.id] || {});
}

function _pkgRawTotal(pkg) {
  const slots = _getPkgSlots(pkg);
  return Object.values(slots).reduce((s, id) => {
    const p = id ? getProduct(id) : null;
    return s + (p ? p.price : 0);
  }, 0);
}


function _pkgIncludes(pkg, max) {
  const slots = _getPkgSlots(pkg);
  const labels = {
    CPU: 'CPU', GPU: 'GPU', Motherboard: 'Mobo', RAM: 'RAM',
    Storage: 'Storage', PSU: 'PSU', Cooling: 'Cooler', Case: 'Case'
  };
  return Object.entries(slots).slice(0, max || 5).map(([slot, id]) => {
    const p = getProduct(id);
    return `${labels[slot] || slot}: ${p ? p.name : '—'}`;
  });
}

//  Render a package card 

function _renderPkgCard(pkg) {
  const raw = _pkgRawTotal(pkg);
  const includes = _pkgIncludes(pkg, 5);
  return `
<div class="package-card ${pkg.featured ? 'featured' : ''}" style="--pc-color:${pkg.color}">
  ${pkg.featured ? '<div class="featured-ribbon">Popular</div>' : ''}
  <div class="package-card-banner"></div>
  <div class="package-card-body">
    <div class="package-name">${pkg.name}</div>
    <div class="package-tagline">${pkg.tagline}</div>
    <div class="package-includes">
      ${includes.map(i => `<div class="pkg-include-row"><div class="dot"></div><span>${i}</span></div>`).join('')}
      <div class="pkg-include-row" style="color:var(--text3);font-style:italic">
        <div class="dot" style="background:var(--text3)"></div>
        <span>+ ${Object.keys(pkg.slots).length - 5} more components</span>
      </div>
    </div>
    <div class="package-price-row">
      <div class="pkg-price-now">&#8369;${(raw * PHP).toLocaleString()}</div>
    </div>
    <div class="pkg-btn-row">
      <button class="btn-pkg-customize" onclick="openPkgCustomizer('${pkg.id}')">&#9881; Customize</button>
      <button class="btn-pkg-grab"      onclick="grabPackage('${pkg.id}')">Add to Cart &rarr;</button>
    </div>
  </div>
</div>`;
}

//  Render featured (home page) 

function renderFeaturedPackages() {
  const el = document.getElementById('featuredPackages');
  if (!el) return;
  el.innerHTML = _getPackages().filter(p => p.featured).map(_renderPkgCard).join('');
}

//  Render all packages (packages page) 

function renderAllPackages() {
  const el = document.getElementById('allPackagesGrid');
  if (!el) return;
  const list = currentPkgCategory === 'All'
    ? _getPackages()
    : _getPackages().filter(p => p.category === currentPkgCategory);
  el.innerHTML = list.map(_renderPkgCard).join('');
}

//  Category strip 

function renderPkgCatStrip() {
  const el = document.getElementById('pkgCatStrip');
  if (!el) return;
  el.innerHTML = PKG_CATEGORIES.map(c =>
    `<button class="pkg-cat-btn ${currentPkgCategory === c ? 'active' : ''}"
             onclick="setPkgCategory('${c}')">${c}</button>`
  ).join('');
}

function setPkgCategory(cat) {
  currentPkgCategory = cat;
  renderPkgCatStrip();
  renderAllPackages();
}

/* ============================================================
   PACKAGE CUSTOMIZER MODAL
============================================================ */

let _custPkgId = null;
let _swapSlot = null;

function openPkgCustomizer(pkgId) {
  const pkg = _getPackages().find(p => p.id === pkgId);
  if (!pkg) return;
  _custPkgId = pkgId;
  document.getElementById('pkgCustTitle').textContent = pkg.name;
  _renderCustBody(pkg);
  document.getElementById('pkgCustomizerModal').classList.add('open');
}

function _renderCustBody(pkg) {
  const slots = _getPkgSlots(pkg);
  const labels = {
    CPU: 'Processor', GPU: 'Graphics Card', Motherboard: 'Motherboard',
    RAM: 'Memory', Storage: 'Storage', PSU: 'Power Supply', Cooling: 'CPU Cooler', Case: 'Case'
  };

  let slotsHtml = '';
  for (const [slot, pid] of Object.entries(slots)) {
    const p = getProduct(pid);
    if (!p) continue;
    slotsHtml += `
    <div class="pkg-cust-slot">
      <div class="pkg-slot-hd">
        <div class="pkg-slot-label">${labels[slot] || slot}</div>
        <button class="btn-pkg-swap" onclick="openPkgSwap('${slot}','${pkg.id}')">&#8644; Swap</button>
      </div>
      <div class="pkg-slot-item">
        <div class="pkg-slot-info">
          <div class="pkg-slot-name">${p.name}</div>
          <div class="pkg-slot-specs">${p.specs}</div>
        </div>
        <div class="pkg-slot-price">&#8369;${(p.price * PHP).toLocaleString()}</div>
      </div>
    </div>`;
  }

  const raw = _pkgRawTotal(pkg);

  const sumLines = Object.entries(slots).map(([slot, pid]) => {
    const p = getProduct(pid);
    return p ? `<div class="pkg-sum-row"><span>${labels[slot] || slot}</span><span>&#8369;${(p.price * PHP).toLocaleString()}</span></div>` : '';
  }).join('');

  const summaryHtml = `
  <div class="pkg-cust-summary">
    <div class="pkg-sum-title">${pkg.name}</div>
    <div class="pkg-sum-rows">${sumLines}</div>
    <div class="pkg-sum-total"><span>Package Total</span><span>&#8369;${(raw * PHP).toLocaleString()}</span></div>
    <button class="btn-pkg-add-all"
            onclick="grabPackage('${pkg.id}');document.getElementById('pkgCustomizerModal').classList.remove('open')">
      Add Package to Cart
    </button>
    <button class="btn-pkg-build-use" onclick="usePackageInBuilder('${pkg.id}')">
      Use in PC Builder
    </button>
  </div>`;

  document.getElementById('pkgCustBody').innerHTML = `<div class="pkg-cust-slots">${slotsHtml}</div>${summaryHtml}`;
}

//  Swap modal 

function openPkgSwap(slot, pkgId) {
  _swapSlot = slot;
  _custPkgId = pkgId;
  const pkg = _getPackages().find(p => p.id === pkgId);
  const current = _getPkgSlots(pkg)[slot];
  const labels = {
    CPU: 'Processor', GPU: 'Graphics Card', Motherboard: 'Motherboard',
    RAM: 'Memory', Storage: 'Storage', PSU: 'Power Supply', Cooling: 'CPU Cooler', Case: 'Case'
  };

  document.getElementById('pkgSwapTitle').textContent = 'Choose ' + (labels[slot] || slot);

  const _swapCustom = (function () { try { return JSON.parse(localStorage.getItem('ds_custom_products') || '[]'); } catch (e) { return []; } })();
  const _swapAll = [...(typeof _getAllProducts === 'function' ? _getAllProducts() : []), ..._swapCustom];
  const candidates = _swapAll.filter(p => p.cat === slot && p.id !== current);

  document.getElementById('pkgSwapList').innerHTML = candidates.length
    ? candidates.map(p => `
      <div class="pkg-swap-item" onclick="applyPkgSwap('${p.id}')">
        <div class="pkg-swap-info">
          <div class="pkg-swap-name">${p.name}</div>
          <div class="pkg-swap-spec">${p.specs}</div>
        </div>
        <div class="pkg-swap-price">&#8369;${(p.price * PHP).toLocaleString()}</div>
      </div>`).join('')
    : '<p style="color:var(--text3);text-align:center;padding:1.5rem">No alternatives available.</p>';

  document.getElementById('pkgSwapModal').classList.add('open');
}

function applyPkgSwap(productId) {
  if (!_custPkgId || !_swapSlot) return;
  if (!_pkgCustom[_custPkgId]) _pkgCustom[_custPkgId] = {};
  _pkgCustom[_custPkgId][_swapSlot] = productId;
  document.getElementById('pkgSwapModal').classList.remove('open');
  const pkg = _getPackages().find(p => p.id === _custPkgId);
  if (pkg) _renderCustBody(pkg);
  showToast('Component swapped!', 'success');
}

//  Grab package → add all to cart 

function grabPackage(pkgId) {
  const pkg = _getPackages().find(p => p.id === pkgId);
  if (!pkg) return;
  Object.values(_getPkgSlots(pkg)).forEach(id => { if (id) DB.cartAdd(id); });
  renderNav();
  showPage('cart');
  showToast(pkg.name + ' added to cart!', 'success');
}

//  Use package in PC Builder 

function usePackageInBuilder(pkgId) {
  const pkg = _getPackages().find(p => p.id === pkgId);
  if (!pkg) return;
  DB.buildSave({ ..._getPkgSlots(pkg) });
  document.getElementById('pkgCustomizerModal').classList.remove('open');
  showPage('builder');
  renderBuilder();
  showToast('Package loaded into PC Builder!', 'success');
}

/* ============================================================
   LAPTOP STORE
============================================================ */

const LAPTOP_CATEGORIES_NAV = ['All', 'Gaming', 'Ultrabook', 'Office', 'Creator', 'Budget'];

const USE_BADGE = {
  Gaming: 'badge-gaming',
  Creator: 'badge-creator',
  Ultrabook: 'badge-ultrabook',
  Office: 'badge-office',
  Budget: 'badge-budget',
};

// Metadata for each laptop product (use, brand, screen, specs summary, full spec table)
const LAPTOP_META = {
  lap_asus_rog_g16: { use: 'Gaming', brand: 'ASUS', screen: '16"', specs2: 'i9 / RTX 4080 / 16GB / 1TB', table: { CPU: 'Intel i9-13980HX', GPU: 'RTX 4080', RAM: '16GB DDR5', Storage: '1TB NVMe', Display: '16" 240Hz QHD', Battery: '90Wh', Weight: '2.3 kg' } },
  lap_asus_rog_z13: { use: 'Gaming', brand: 'ASUS', screen: '14"', specs2: 'Ryzen 9 / RX 7600S / 16GB', table: { CPU: 'Ryzen 9 8945H', GPU: 'RX 7600S', RAM: '16GB LPDDR5', Storage: '512GB NVMe', Display: '14" 165Hz QHD+', Battery: '75Wh', Weight: '1.65 kg' } },
  lap_msi_titan_gt77: { use: 'Gaming', brand: 'MSI', screen: '17"', specs2: 'i9 / RTX 4090 / 64GB', table: { CPU: 'Intel i9-13980HX', GPU: 'RTX 4090', RAM: '64GB DDR5', Storage: '2TB NVMe', Display: '17" 240Hz FHD', Battery: '99.9Wh', Weight: '3.3 kg' } },
  lap_msi_raider_ge78: { use: 'Gaming', brand: 'MSI', screen: '17"', specs2: 'i9 / RTX 4080 / 32GB', table: { CPU: 'Intel i9-14900HX', GPU: 'RTX 4080', RAM: '32GB DDR5', Storage: '1TB NVMe', Display: '17" 240Hz QHD', Battery: '99.9Wh', Weight: '2.9 kg' } },
  lap_asus_tuf_f15: { use: 'Gaming', brand: 'ASUS', screen: '15"', specs2: 'i7 / RTX 4060 / 16GB', table: { CPU: 'Intel i7-13620H', GPU: 'RTX 4060', RAM: '16GB DDR4', Storage: '512GB NVMe', Display: '15.6" 144Hz FHD', Battery: '90Wh', Weight: '2.2 kg' } },
  lap_lenovo_legion_7: { use: 'Gaming', brand: 'Lenovo', screen: '16"', specs2: 'i9 / RTX 4070 / 32GB', table: { CPU: 'Intel i9-14900HX', GPU: 'RTX 4070', RAM: '32GB DDR5', Storage: '1TB NVMe', Display: '16" 165Hz WQXGA', Battery: '99.9Wh', Weight: '2.5 kg' } },
  lap_lenovo_legion_5: { use: 'Gaming', brand: 'Lenovo', screen: '16"', specs2: 'Ryzen 7 / RTX 4060 / 16GB', table: { CPU: 'Ryzen 7 7745HX', GPU: 'RTX 4060', RAM: '16GB DDR5', Storage: '512GB NVMe', Display: '16" 165Hz WQXGA', Battery: '80Wh', Weight: '2.4 kg' } },
  lap_razer_blade_16: { use: 'Gaming', brand: 'Razer', screen: '16"', specs2: 'i9 / RTX 4090 / 32GB', table: { CPU: 'Intel i9-14900HX', GPU: 'RTX 4090', RAM: '32GB DDR5', Storage: '2TB NVMe', Display: '16" 240Hz QHD+', Battery: '95.2Wh', Weight: '2.14 kg' } },
  lap_razer_blade_15: { use: 'Gaming', brand: 'Razer', screen: '15"', specs2: 'i7 / RTX 4070 / 16GB', table: { CPU: 'Intel i7-13800H', GPU: 'RTX 4070', RAM: '16GB DDR5', Storage: '1TB NVMe', Display: '15.6" 240Hz FHD', Battery: '80Wh', Weight: '2.01 kg' } },
  lap_acer_predator_18: { use: 'Gaming', brand: 'Acer', screen: '18"', specs2: 'i9 / RTX 4090 / 32GB', table: { CPU: 'Intel i9-14900HX', GPU: 'RTX 4090', RAM: '32GB DDR5', Storage: '2TB NVMe', Display: '18" 250Hz UHD', Battery: '90Wh', Weight: '3.9 kg' } },
  lap_acer_nitro_v15: { use: 'Gaming', brand: 'Acer', screen: '15"', specs2: 'Ryzen 5 / RTX 4050 / 8GB', table: { CPU: 'Ryzen 5 7535HS', GPU: 'RTX 4050', RAM: '8GB DDR5', Storage: '512GB NVMe', Display: '15.6" 144Hz FHD', Battery: '57.5Wh', Weight: '2.3 kg' } },
  lap_hp_omen_16: { use: 'Gaming', brand: 'HP', screen: '16"', specs2: 'i7 / RTX 4070 / 16GB', table: { CPU: 'Intel i7-13700HX', GPU: 'RTX 4070', RAM: '16GB DDR5', Storage: '1TB NVMe', Display: '16" 165Hz QHD', Battery: '83Wh', Weight: '2.54 kg' } },
  lap_dell_g16: { use: 'Gaming', brand: 'Dell', screen: '16"', specs2: 'i7 / RTX 4060 / 16GB', table: { CPU: 'Intel i7-13650HX', GPU: 'RTX 4060', RAM: '16GB DDR5', Storage: '512GB NVMe', Display: '16" 165Hz QHD', Battery: '86Wh', Weight: '2.84 kg' } },
  lap_gigabyte_aorus_17: { use: 'Gaming', brand: 'Gigabyte', screen: '17"', specs2: 'i9 / RTX 4080 / 32GB', table: { CPU: 'Intel i9-13980HX', GPU: 'RTX 4080', RAM: '32GB DDR5', Storage: '2TB NVMe', Display: '17.3" 360Hz FHD', Battery: '99Wh', Weight: '3 kg' } },
  lap_apple_mbp_m3pro: { use: 'Creator', brand: 'Apple', screen: '14"', specs2: 'M3 Pro / 18GB / 512GB', table: { CPU: 'Apple M3 Pro', GPU: '19-core GPU', RAM: '18GB Unified', Storage: '512GB SSD', Display: '14" Liquid Retina XDR', Battery: '72.4Wh', Weight: '1.6 kg' } },
  lap_apple_mbp_m3max: { use: 'Creator', brand: 'Apple', screen: '16"', specs2: 'M3 Max / 36GB / 1TB', table: { CPU: 'Apple M3 Max', GPU: '40-core GPU', RAM: '36GB Unified', Storage: '1TB SSD', Display: '16" Liquid Retina XDR', Battery: '100Wh', Weight: '2.14 kg' } },
  lap_apple_mba_m3: { use: 'Ultrabook', brand: 'Apple', screen: '15"', specs2: 'M3 / 8GB / 256GB', table: { CPU: 'Apple M3', GPU: '10-core GPU', RAM: '8GB Unified', Storage: '256GB SSD', Display: '15.3" Retina', Battery: '66.5Wh', Weight: '1.51 kg' } },
  lap_dell_xps_15: { use: 'Creator', brand: 'Dell', screen: '15"', specs2: 'i7 / RTX 4060 / 16GB', table: { CPU: 'Intel i7-13700H', GPU: 'RTX 4060', RAM: '16GB DDR5', Storage: '512GB NVMe', Display: '15.6" OLED 3.5K', Battery: '86Wh', Weight: '1.86 kg' } },
  lap_dell_xps_13: { use: 'Ultrabook', brand: 'Dell', screen: '13"', specs2: 'i7 / Intel Iris / 16GB', table: { CPU: 'Intel i7-1360P', GPU: 'Intel Iris Xe', RAM: '16GB DDR5', Storage: '512GB NVMe', Display: '13.4" FHD+', Battery: '54Wh', Weight: '1.27 kg' } },
  lap_lenovo_x1_carbon: { use: 'Office', brand: 'Lenovo', screen: '14"', specs2: 'i7 / Intel Iris / 16GB', table: { CPU: 'Intel i7-1365U', GPU: 'Intel Iris Xe', RAM: '16GB LPDDR5', Storage: '512GB NVMe', Display: '14" 2.8K IPS', Battery: '57Wh', Weight: '1.12 kg' } },
  lap_lenovo_slim5: { use: 'Office', brand: 'Lenovo', screen: '16"', specs2: 'Ryzen 5 / AMD Radeon / 16GB', table: { CPU: 'Ryzen 5 7530U', GPU: 'AMD Radeon', RAM: '16GB DDR4', Storage: '512GB NVMe', Display: '16" FHD IPS', Battery: '60Wh', Weight: '1.73 kg' } },
  lap_hp_spectre_14: { use: 'Ultrabook', brand: 'HP', screen: '14"', specs2: 'i7 / Intel Iris / 16GB', table: { CPU: 'Intel i7-1355U', GPU: 'Intel Iris Xe', RAM: '16GB LPDDR5', Storage: '512GB NVMe', Display: '14" 2.8K OLED', Battery: '68Wh', Weight: '1.34 kg' } },
  lap_hp_elitebook_840: { use: 'Office', brand: 'HP', screen: '14"', specs2: 'i5 / Intel Iris / 8GB', table: { CPU: 'Intel i5-1335U', GPU: 'Intel Iris Xe', RAM: '8GB DDR5', Storage: '256GB NVMe', Display: '14" FHD', Battery: '51Wh', Weight: '1.33 kg' } },
  lap_asus_zenbook_14: { use: 'Ultrabook', brand: 'ASUS', screen: '14"', specs2: 'i7 / RTX 3050 / 16GB', table: { CPU: 'Intel i7-1360P', GPU: 'RTX 3050', RAM: '16GB LPDDR5', Storage: '512GB NVMe', Display: '14" 2.8K OLED', Battery: '75Wh', Weight: '1.4 kg' } },
  lap_asus_vivobook_16: { use: 'Budget', brand: 'ASUS', screen: '16"', specs2: 'Ryzen 5 / AMD Radeon / 8GB', table: { CPU: 'Ryzen 5 7530U', GPU: 'AMD Radeon', RAM: '8GB DDR4', Storage: '512GB NVMe', Display: '16" FHD', Battery: '50Wh', Weight: '1.7 kg' } },
  lap_microsoft_surface: { use: 'Ultrabook', brand: 'Microsoft', screen: '13"', specs2: 'i5 / Intel Iris / 8GB', table: { CPU: 'Intel i5-1235U', GPU: 'Intel Iris Xe', RAM: '8GB LPDDR5', Storage: '256GB SSD', Display: '13.5" PixelSense 2K', Battery: '47.4Wh', Weight: '0.87 kg' } },
  lap_samsung_galaxy_4: { use: 'Ultrabook', brand: 'Samsung', screen: '14"', specs2: 'i7 / Intel Iris / 16GB', table: { CPU: 'Intel i7-1355U', GPU: 'Intel Iris Xe', RAM: '16GB LPDDR5', Storage: '512GB NVMe', Display: '14" AMOLED 2.8K', Battery: '63Wh', Weight: '1.18 kg' } },
  lap_acer_swift_go: { use: 'Office', brand: 'Acer', screen: '16"', specs2: 'Ryzen 5 / Radeon / 16GB', table: { CPU: 'Ryzen 5 7530U', GPU: 'AMD Radeon', RAM: '16GB DDR4', Storage: '512GB NVMe', Display: '16" FHD IPS', Battery: '65Wh', Weight: '1.84 kg' } },
  lap_acer_aspire_3: { use: 'Budget', brand: 'Acer', screen: '15"', specs2: 'Ryzen 3 / Radeon / 8GB', table: { CPU: 'Ryzen 3 7320U', GPU: 'AMD Radeon', RAM: '8GB DDR5', Storage: '256GB NVMe', Display: '15.6" FHD', Battery: '50Wh', Weight: '1.7 kg' } },
  lap_lenovo_ideapad_1: { use: 'Budget', brand: 'Lenovo', screen: '15"', specs2: 'Ryzen 5 / Radeon / 8GB', table: { CPU: 'Ryzen 5 7520U', GPU: 'AMD Radeon', RAM: '8GB LPDDR5', Storage: '256GB NVMe', Display: '15.6" FHD', Battery: '47Wh', Weight: '1.62 kg' } },
  lap_hp_15: { use: 'Budget', brand: 'HP', screen: '15"', specs2: 'i3 / Intel UHD / 8GB', table: { CPU: 'Intel i3-1215U', GPU: 'Intel UHD', RAM: '8GB DDR4', Storage: '256GB NVMe', Display: '15.6" FHD', Battery: '41Wh', Weight: '1.69 kg' } },
  lap_dell_inspiron_15: { use: 'Budget', brand: 'Dell', screen: '15"', specs2: 'i5 / Intel Iris / 8GB', table: { CPU: 'Intel i5-1335U', GPU: 'Intel Iris Xe', RAM: '8GB DDR4', Storage: '256GB NVMe', Display: '15.6" FHD', Battery: '54Wh', Weight: '1.65 kg' } },
  lap_chromebook_plus: { use: 'Budget', brand: 'Google', screen: '14"', specs2: 'Intel N200 / UHD / 8GB', table: { CPU: 'Intel N200', GPU: 'Intel UHD', RAM: '8GB LPDDR5', Storage: '128GB eMMC', Display: '14" FHD IPS', Battery: '51.5Wh', Weight: '1.73 kg' } },
};

/* Auto-generate metadata for custom laptop products that lack a LAPTOP_META entry.
   Parses the product's specs string to extract brand, screen size, and use category. */
function _buildCustomLaptopMeta(p) {
  const specs = p.specs || '';
  const name = p.name || '';

  // Detect screen size from name or specs (e.g. "15.6"", "14"", "17"")
  const screenMatch = (name + ' ' + specs).match(/(\d{2}(?:\.\d)?)["”]/);
  const screen = screenMatch ? screenMatch[1] + '"' : '';

  // Detect brand from name
  const brands = ['ASUS', 'MSI', 'Acer', 'Dell', 'HP', 'Lenovo', 'Razer', 'Apple', 'Samsung',
    'Gigabyte', 'LG', 'Huawei', 'Toshiba', 'Sony', 'Microsoft', 'Google', 'Honor'];
  const brand = brands.find(b => name.toLowerCase().includes(b.toLowerCase())) || '';

  // Detect use category
  let use = 'Office';
  const lower = (name + ' ' + specs).toLowerCase();
  if (lower.includes('gaming') || lower.includes('rtx') || lower.includes('rx ') ||
    lower.includes('gtx') || lower.includes('rog') || lower.includes('tuf') ||
    lower.includes('legion') || lower.includes('razer') || lower.includes('predator') ||
    lower.includes('omen') || lower.includes('nitro') || lower.includes('g15') ||
    lower.includes('g16') || lower.includes('g14')) {
    use = 'Gaming';
  } else if (lower.includes('macbook') || lower.includes('xps') || lower.includes('creator') ||
    lower.includes('studio') || lower.includes('creator')) {
    use = 'Creator';
  } else if (lower.includes('ultrabook') || lower.includes('zenbook') || lower.includes('spectre') ||
    lower.includes('swift') || lower.includes('air') || lower.includes('slim') ||
    lower.includes('ultraslim') || lower.includes('surface')) {
    use = 'Ultrabook';
  } else if (lower.includes('budget') || lower.includes('aspire') || lower.includes('ideapad') ||
    lower.includes('vivobook') || lower.includes('inspiron') || lower.includes('chromebook')) {
    use = 'Budget';
  }

  // Build a compact specs2 from the raw specs string
  const specs2 = specs.split('/').slice(0, 3).map(s => s.trim()).join(' / ');

  // Build a minimal table from the specs string
  const table = {};
  specs.split('/').forEach(seg => {
    const s = seg.trim();
    if (!s) return;
    if (/ryzen|intel|apple m|core i/i.test(s)) table['CPU'] = s;
    else if (/rtx|rx |gtx|radeon|iris|uhd|gpu/i.test(s)) table['GPU'] = s;
    else if (/gb\s*ddr|gb\s*lpddr|gb\s*unified/i.test(s)) table['RAM'] = s;
    else if (/tb|gb\s*nvme|gb\s*ssd|emmc/i.test(s)) table['Storage'] = s;
    else if (/hz|fhd|qhd|4k|oled|retina|ips/i.test(s)) table['Display'] = s;
  });
  if (!Object.keys(table).length) table['Specs'] = specs;

  return { use, brand, screen, specs2, table };
}

function _getLaptopMeta(productId, product) {
  if (LAPTOP_META[productId]) return LAPTOP_META[productId];
  // For custom laptop products, auto-generate metadata
  return _buildCustomLaptopMeta(product);
}

let currentLaptopFilter = 'All';

function renderLaptopTags() {
  const el = document.getElementById('laptopTags');
  if (!el) return;
  el.innerHTML = LAPTOP_CATEGORIES_NAV.map(c =>
    `<button class="laptop-tag ${currentLaptopFilter === c ? 'active' : ''}"
             onclick="setLaptopFilter('${c}')">${c}</button>`
  ).join('');
}

function setLaptopFilter(cat) {
  currentLaptopFilter = cat;
  renderLaptopTags();
  renderLaptops();
}

function renderLaptops() {
  const el = document.getElementById('laptopsGrid');
  if (!el) return;
  const q = (document.getElementById('laptopSearch')?.value || '').toLowerCase();
  const sort = document.getElementById('laptopSort')?.value || 'default';

  const _customProds = (function () { try { return JSON.parse(localStorage.getItem('ds_custom_products') || '[]'); } catch (e) { return []; } })();
  const _allProds = [...(typeof _getAllProducts === 'function' ? _getAllProducts() : [])];
  let items = _allProds.filter(p => p.cat === 'Laptop');
  if (currentLaptopFilter !== 'All') {
    items = items.filter(p => {
      const m = _getLaptopMeta(p.id, p);
      return m && m.use === currentLaptopFilter;
    });
  }
  if (q) items = items.filter(p =>
    p.name.toLowerCase().includes(q) || p.specs.toLowerCase().includes(q)
  );
  if (sort === 'price-asc') items = [...items].sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') items = [...items].sort((a, b) => b.price - a.price);
  if (sort === 'name') items = [...items].sort((a, b) => a.name.localeCompare(b.name));

  /* Dynamic subtitle — reflects actual laptop count */
  const _lapSubEl = document.getElementById('laptopSubtitle');
  if (_lapSubEl) {
    const totalLaptops = _allProds.filter(p => p.cat === 'Laptop').length;
    _lapSubEl.textContent = totalLaptops + ' models \u2014 Gaming, Ultrabook, Office and Creator laptops';
  }

  el.innerHTML = items.length
    ? items.map(p => {
      const m = _getLaptopMeta(p.id, p);
      const badge = USE_BADGE[m.use] || 'badge-office';
      const status = typeof AUTH !== 'undefined' ? AUTH.getStatus(p.id) : 'normal';
      const isOOS = status === 'outofstock';
      const chips = (m.specs2 || p.specs).split('/').slice(0, 3)
        .map(s => `<span class="spec-chip">${s.trim()}</span>`).join('');
      const _customImgs = (function () { try { return JSON.parse(localStorage.getItem('ds_custom_images') || '{}'); } catch (e) { return {}; } })();
      const _imgSrc = _customImgs[p.id] || m.imageUrl || null;

      return `
        <div class="laptop-card" onclick="openLaptopDetail('${p.id}')">
          <div class="laptop-card-img-col">
            ${_imgSrc
          ? `<img class="laptop-card-img" src="${_imgSrc}" alt="${p.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''}
            <div class="laptop-card-img-placeholder" style="${_imgSrc ? 'display:none' : ''}">${(m.brand || p.cat || 'IMG').substring(0, 4).toUpperCase()}</div>
          </div>
          <div class="laptop-card-body">
            <span class="laptop-use-badge ${badge}" style="position:static;display:inline-block;margin-bottom:.4rem">${m.use || 'Laptop'}</span>
            <div class="laptop-brand">${m.brand || ''} ${m.screen ? '· ' + m.screen : ''}</div>
            <div class="laptop-name">${p.name}</div>
            <div class="laptop-spec-chips">${chips}</div>
            <div class="laptop-footer">
              <div class="laptop-price">&#8369;${(p.price * PHP).toLocaleString()}</div>
              ${isOOS
          ? `<button class="btn-laptop-add" disabled style="opacity:.4" onclick="event.stopPropagation()">Sold Out</button>`
          : `<button class="btn-laptop-add" onclick="event.stopPropagation();addToCart('${p.id}')">Add to Cart</button>`}
            </div>
          </div>
        </div>`;
    }).join('')
    : '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text3)">No laptops found</div>';
}

function openLaptopDetail(pid) {
  const p = getProduct(pid);
  const m = _getLaptopMeta(pid, p);
  if (!p) return;
  const badge = USE_BADGE[m.use] || 'badge-office';
  const status = typeof AUTH !== 'undefined' ? AUTH.getStatus(pid) : 'normal';
  const isOOS = status === 'outofstock';
  document.getElementById('laptopDetailTitle').textContent = p.name;
  const tableRows = m.table
    ? Object.entries(m.table).map(([k, v]) =>
      `<tr><td>${k}</td><td style="color:var(--text)">${v}</td></tr>`).join('')
    : `<tr><td>Specs</td><td style="color:var(--text)">${p.specs}</td></tr>`;
  const _dImgs = (function () { try { return JSON.parse(localStorage.getItem('ds_custom_images') || '{}'); } catch (e) { return {}; } })();
  const _dImg = _dImgs[pid] || m.imageUrl || null;
  const _dImgHtml = _dImg
    ? `<img src="${_dImg}" alt="${p.name}" style="width:100%;height:200px;object-fit:cover;border-radius:10px;display:block;margin-bottom:.75rem">`
    : `<div style="width:100%;height:140px;border-radius:10px;background:var(--s3);display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:.75rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--accent);opacity:.5;margin-bottom:.75rem">${(m.brand || p.cat || 'IMG').substring(0, 6).toUpperCase()}</div>`;

  document.getElementById('laptopDetailBody').innerHTML = `
  <div class="laptop-detail-grid">
    <div>
      ${_dImgHtml}
      <div style="text-align:center">
        <span class="laptop-use-badge ${badge}" style="position:static;display:inline-block;margin-bottom:.4rem">${m.use || 'Laptop'}</span>
        <div style="font-size:.76rem;color:var(--text3)">${m.brand || ''} ${m.screen ? '· ' + m.screen : ''}</div>
      </div>
    </div>
    <div class="laptop-detail-info">
      <h2>${p.name}</h2>
      <div class="laptop-detail-price">&#8369;${(p.price * PHP).toLocaleString()}</div>
      <table class="laptop-spec-table">${tableRows}</table>
      <div style="margin-top:.9rem;display:flex;gap:.55rem">
        ${isOOS
      ? `<button class="btn-primary" disabled style="opacity:.4;flex:1">Out of Stock</button>`
      : `<button class="btn-primary" style="flex:1" onclick="addToCart('${pid}');document.getElementById('laptopDetailModal').classList.remove('open')">Add to Cart</button>`}
        <button class="btn-secondary" onclick="document.getElementById('laptopDetailModal').classList.remove('open')">Close</button>
      </div>
    </div>
  </div>`;
  document.getElementById('laptopDetailModal').classList.add('open');
}

/* ============================================================
   PAGE ROUTING — extend showPage for the new pages
============================================================ */

const _origShowPage_pkg = window.showPage;
window.showPage = function (id) {
  _origShowPage_pkg(id);
  if (id === 'packages') { renderPkgCatStrip(); renderAllPackages(); }
  if (id === 'laptops') { renderLaptopTags(); renderLaptops(); }
};

//  Modal overlay close handlers 

['pkgCustomizerModal', 'pkgSwapModal', 'laptopDetailModal'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', e => {
    if (e.target === el) el.classList.remove('open');
  });
});

//  Initial renders 

renderFeaturedPackages();
renderLaptopTags();
renderLaptops();

/* Refresh packages when admin saves changes in another tab */
window.addEventListener('storage', function (e) {
  if (e.key === 'ds_custom_packages') {
    renderFeaturedPackages();
    renderAllPackages();
  }
});

// packages.js loaded
