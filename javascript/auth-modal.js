/* ============================================================
   Digispex — auth-modal.js  (Supabase Auth Edition)
   Handles auth state, nav UI, and modal fallbacks.
   Uses Supabase Auth for registration, login, logout.
   Session is cached in-memory + localStorage for backward
   compatibility with existing code.
============================================================ */

const AUTH_SESSION_KEY = 'ds_auth_session';

/*  Cached session (set during init, updated on auth changes)  */
let _cachedSession = null;

/*  Read/write session to localStorage (backward compat)  */
function _getSession() {
  if (_cachedSession) return _cachedSession;
  try { return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY)); } catch { return null; }
}
function _setSession(user) {
  _cachedSession = user;
  try { localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user)); } catch { }
}
function _clearSession() {
  _cachedSession = null;
  try { localStorage.removeItem(AUTH_SESSION_KEY); } catch { }
}

/*  Public API used across modules  */
function getCurrentUser() { return _getSession(); }
function isLoggedIn() { return !!_getSession(); }

/*  Email validator  */
function _validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()); }

/*  Inline error helper  */
function _setError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}
function _clearErrors(prefix) {
  ['name', 'email', 'password', 'confirm', 'general']
    .forEach(f => _setError(prefix + '-err-' + f, ''));
}

const ICON_EYE = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>`;
const ICON_EYE_OFF = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`;

function togglePasswordVis(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.innerHTML = show ? ICON_EYE : ICON_EYE_OFF;
}
window.togglePasswordVis = togglePasswordVis;

/* 
   OPEN / CLOSE MODALS
 */
function openLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) {
    _clearErrors('login');
    modal.classList.add('open');
  } else {
    window.location.href = 'login.html';
  }
}
function closeLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) modal.classList.remove('open');
}

function openRegisterModal() {
  const modal = document.getElementById('registerModal');
  if (modal) {
    _clearErrors('reg');
    modal.classList.add('open');
  } else {
    window.location.href = 'register.html';
  }
}
function closeRegisterModal() {
  const modal = document.getElementById('registerModal');
  if (modal) modal.classList.remove('open');
}

function switchToRegister() { closeLoginModal(); openRegisterModal(); }
function switchToLogin() { closeRegisterModal(); openLoginModal(); }

let currentOtp = null;
let currentRegData = null;

async function handleRegister(e) {
  e.preventDefault();
  _clearErrors('reg');

  const name = (document.getElementById('regName')?.value || '').trim();
  const email = (document.getElementById('regEmail')?.value || '').trim().toLowerCase();
  const password = (document.getElementById('regPassword')?.value || '').trim();
  const confirm = (document.getElementById('regConfirm')?.value || '').trim();

  let valid = true;
  if (!name) { _setError('reg-err-name', 'Name is required.'); valid = false; }
  if (!email) { _setError('reg-err-email', 'Email is required.'); valid = false; }
  else if (!_validEmail(email)) { _setError('reg-err-email', 'Enter a valid email address.'); valid = false; }
  if (!password) { _setError('reg-err-password', 'Password is required.'); valid = false; }
  else if (password.length < 6) { _setError('reg-err-password', 'Password must be at least 6 characters.'); valid = false; }
  if (!confirm) { _setError('reg-err-confirm', 'Please confirm your password.'); valid = false; }
  else if (password !== confirm) { _setError('reg-err-confirm', 'Passwords do not match.'); valid = false; }
  if (!valid) return;

  currentOtp = Math.floor(100000 + Math.random() * 900000).toString();
  currentRegData = { name, email, password };

  const submitBtn = document.getElementById('registerSubmitBtn');
  if (submitBtn) { submitBtn.textContent = "Sending Code..."; submitBtn.disabled = true; }

  try {
    if (typeof emailjs === 'undefined') throw new Error("EmailJS CDN is not loaded.");

    // IMPORTANT: Make sure to replace YOUR_PUBLIC_KEY with your actual EmailJS Public Key
    emailjs.init("5d6-cF4kjBNRzBRme");

    await emailjs.send("service_4jatqgj", "template_86bd2y9", {
      to_email: email,
      to_name: name,
      otp_code: currentOtp
    });

    // Switch UI
    const regUI = document.getElementById('registerScreen');
    const otpUI = document.getElementById('otpScreen');
    if (regUI && otpUI) {
      regUI.style.display = 'none';
      otpUI.style.display = 'block';
      const dEmail = document.getElementById('displayOtpEmail');
      if (dEmail) dEmail.textContent = email;
    } else {
      // Fallback if registering through the nav modal
      const code = prompt("A 6-digit code was sent to " + email + ". Enter it here:");
      if (code) {
        window._mockOtp = code;
        verifyOTP();
      } else {
        if (submitBtn) { submitBtn.textContent = "Create Account"; submitBtn.disabled = false; }
      }
    }
  } catch (err) {
    if (submitBtn) { submitBtn.textContent = "Create Account"; submitBtn.disabled = false; }
    alert("Failed to send OTP via EmailJS. Please ensure your Public Key is correct inside auth-modal.js. Error: " + (err.message || JSON.stringify(err)));
    console.error(err);
  }
}

async function verifyOTP(e) {
  if (e) e.preventDefault();
  _setError('reg-err-otp', '');

  const inputEl = document.getElementById('otpInput');
  const code = inputEl ? inputEl.value.trim() : (window._mockOtp || "");

  if (code !== currentOtp) {
    _setError('reg-err-otp', 'Invalid or incorrect code.');
    return;
  }

  const vBtn = document.getElementById('verifyOtpBtn');
  if (vBtn) { vBtn.textContent = "Verifying..."; vBtn.disabled = true; }

  try {
    /* Finalize Supabase Registration */
    const { data, error } = await window.SBClient.auth.signUp({
      email: currentRegData.email,
      password: currentRegData.password,
      options: { data: { name: currentRegData.name, role: 'customer' } }
    });

    if (error) {
      if (vBtn) { vBtn.textContent = "Verify & Create Account"; vBtn.disabled = false; }
      alert("Registration Error: " + error.message);
      return;
    }

    const user = data?.user;
    if (!user) {
      alert("Registration successful! But Supabase 'Confirm Email' is ON. Please check your email for the confirmation link to login.");
      return;
    }

    const sessionUser = {
      id: user.id,
      name: currentRegData.name,
      email: currentRegData.email,
      role: 'customer'
    };
    _setSession(sessionUser);
    closeRegisterModal();

    if (typeof SB !== 'undefined') await SB.pull();
    _onAuthChange(sessionUser, 'registered');

    if (window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html')) {
      setTimeout(() => { window.location.href = 'index.html'; }, 800);
    }
  } catch (err) {
    if (vBtn) { vBtn.textContent = "Verify & Create Account"; vBtn.disabled = false; }
    alert("An unexpected error occurred during Supabase registration: " + err.message);
    console.error(err);
  }
}

function cancelOTP(e) {
  if (e) e.preventDefault();
  const regUI = document.getElementById('registerScreen');
  const otpUI = document.getElementById('otpScreen');
  if (regUI && otpUI) {
    regUI.style.display = 'block';
    otpUI.style.display = 'none';
    const sBtn = document.getElementById('registerSubmitBtn');
    if (sBtn) { sBtn.textContent = "Create Account"; sBtn.disabled = false; }
  }
}

/* 
   LOGIN — Supabase Auth
 */
async function handleLogin(e) {
  e.preventDefault();
  _clearErrors('login');

  const email = (document.getElementById('loginEmail')?.value || '').trim().toLowerCase();
  const password = (document.getElementById('loginPassword')?.value || '').trim();

  let valid = true;
  if (!email) { _setError('login-err-email', 'Email is required.'); valid = false; }
  else if (!_validEmail(email)) { _setError('login-err-email', 'Enter a valid email address.'); valid = false; }
  if (!password) { _setError('login-err-password', 'Password is required.'); valid = false; }
  if (!valid) return;

  try {
    /* Sign in with Supabase Auth */
    const { data, error } = await window.SBClient.auth.signInWithPassword({ email, password });

    if (error) {
      if (document.getElementById('login-err-general')) {
        _setError('login-err-general', error.message || 'Incorrect email or password.');
      } else {
        alert("Login Error: " + (error.message || 'Incorrect credentials.'));
      }
      return;
    }

    const user = data?.user;
    if (!user) {
      alert("Login failed: Unable to retrieve user info. Check your email verification.");
      return;
    }

    let role = 'customer';
    let name = user.user_metadata?.name || '';
    if (typeof getSupabaseProfile === 'function') {
      const profile = await getSupabaseProfile();
      if (profile) {
        role = profile.role || role;
        name = profile.name || name;
      }
    }

    const sessionUser = {
      id: user.id,
      name: name,
      email: user.email,
      role: role
    };
    _setSession(sessionUser);
    closeLoginModal();

    /* Pull user data from Supabase */
    if (typeof SB !== 'undefined') await SB.pull();

    /*  Role-based redirect  */
    if (role === 'admin') {
      window.location.href = 'admin.html';
      return;
    }
    if (role === 'owner') {
      window.location.href = 'owner.html';
      return;
    }

    _onAuthChange(sessionUser, 'loggedin');

    /* Redirect if on dedicated auth pages */
    if (window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html')) {
      setTimeout(() => { window.location.href = 'index.html'; }, 800);
    }
  } catch (err) {
    alert("An unexpected error occurred during login: " + err.message);
    console.error(err);
  }
}

/* 
   LOGOUT — Supabase Auth
 */
async function handleLogout() {
  await window.SBClient.auth.signOut();
  _clearSession();
  _onAuthChange(null, 'loggedout');
}

/* 
   AUTH STATE CHANGE
 */
function _onAuthChange(user, action) {
  _updateAuthNav(user);
  if (typeof renderNav === 'function') renderNav();
  if (typeof renderStore === 'function') renderStore();
  if (action === 'registered') showToast('Welcome, ' + user.name + '! Account created.', 'success');
  if (action === 'loggedin') showToast('Welcome back, ' + user.name + '!', 'success');
  if (action === 'loggedout') showToast('You have been logged out.', 'success');
}

/* 
   NAV UPDATE
 */
function _updateAuthNav(user) {
  const guestArea = document.getElementById('navAuthGuest');
  const userArea = document.getElementById('navAuthUser');
  const userLabel = document.getElementById('navUserLabel');
  const bellWrap = document.getElementById('notifBellWrap');
  const msgBtn = document.getElementById('navMsgBtn');
  const ordersTab = document.getElementById('navOrdersTab');
  const wishlistTab = document.getElementById('navWishlistTab');

  if (!guestArea || !userArea) return;

  if (user) {
    guestArea.style.display = 'none';
    userArea.style.display = 'flex';
    if (userLabel) userLabel.textContent = user.name;

    const existingPanelBtn = document.getElementById('navPanelBtn');
    if (existingPanelBtn) existingPanelBtn.remove();
    if (user.role === 'admin' || user.role === 'owner') {
      const panelBtn = document.createElement('a');
      panelBtn.id = 'navPanelBtn';
      panelBtn.className = 'nav-auth-btn nav-login-btn';
      panelBtn.style.cssText = 'background:rgba(124,58,237,0.18);color:#a78bfa;border-color:rgba(124,58,237,0.4);';
      panelBtn.href = user.role === 'admin' ? 'admin.html' : 'owner.html';
      panelBtn.textContent = user.role === 'admin' ? 'Admin Panel' : 'Owner Panel';
      userArea.insertBefore(panelBtn, userArea.firstChild);
    }
    if (bellWrap) bellWrap.style.display = '';
    if (msgBtn) msgBtn.style.display = 'flex';
    if (ordersTab) ordersTab.style.display = '';
    if (wishlistTab) wishlistTab.style.display = '';
    const cartBtnIn = document.getElementById('navCartBtn');
    if (cartBtnIn) cartBtnIn.style.display = '';
    if (typeof DB !== 'undefined') DB.init();
    if (typeof _renderMsgBadge === 'function') _renderMsgBadge();
    if (typeof _refreshBell === 'function') _refreshBell();
    if (typeof _reloadWishlist === 'function') _reloadWishlist();
    if (typeof _updateWishlistBadge === 'function') _updateWishlistBadge();
    if (typeof renderNav === 'function') renderNav();
    if (typeof renderCart === 'function') renderCart();
    if (typeof renderOrders === 'function') renderOrders();
    const wlOpt = document.getElementById('sortWishlistOption');
    if (wlOpt) wlOpt.style.display = '';
  } else {
    guestArea.style.display = 'flex';
    userArea.style.display = 'none';
    if (bellWrap) bellWrap.style.display = 'none';
    if (msgBtn) msgBtn.style.display = 'none';
    if (ordersTab) ordersTab.style.display = 'none';
    if (wishlistTab) wishlistTab.style.display = 'none';
    const cartBtn = document.getElementById('navCartBtn');
    if (cartBtn) cartBtn.style.display = 'none';
    const wlOpt = document.getElementById('sortWishlistOption');
    if (wlOpt) wlOpt.style.display = 'none';
    if (typeof _reloadWishlist === 'function') _reloadWishlist();
    const cartCountEl = document.getElementById('cartCount');
    if (cartCountEl) cartCountEl.textContent = '0';
    if (typeof renderCart === 'function') renderCart();
    if (typeof renderOrders === 'function') renderOrders();
    const activePage = document.querySelector('.page.active');
    if (activePage && (activePage.id === 'page-orders' || activePage.id === 'page-wishlist' || activePage.id === 'page-cart') && typeof showPage === 'function') {
      showPage('store');
    }
  }
}


/* 
   INIT — runs on DOMContentLoaded
   Restores Supabase session and syncs data.
 */
async function initAuth() {
  try {
    /* Check Supabase session */
    if (!window.SBClient) throw new Error("Supabase is not initialized.");
    const { data: { session }, error } = await window.SBClient.auth.getSession();
    if (error) throw error;

    if (session && session.user) {
      const user = session.user;

      let role = 'customer';
      let name = user.user_metadata?.name || '';
      if (typeof getSupabaseProfile === 'function') {
        const profile = await getSupabaseProfile();
        if (profile) {
          role = profile.role || role;
          name = profile.name || name;
        }
      }

      const sessionUser = {
        id: user.id,
        name: name,
        email: user.email,
        role: role
      };
      _setSession(sessionUser);

      /* Pull all data from Supabase into localStorage */
      if (typeof SB !== 'undefined') await SB.pull();

      _updateAuthNav(sessionUser);
    } else {
      _clearSession();
      /* Still pull public data (products, packages) */
      if (typeof SB !== 'undefined') await SB.pull();
      _updateAuthNav(null);
    }
  } catch (err) {
    console.error("Auth Session Check Failed:", err);
    _clearSession();
    if (typeof window !== "undefined" && window.location.href.indexOf('file://') === 0 && !window.location.href.includes('index.html')) {
      console.warn("Local file test detected. Ignored auth fetch failure.");
    }
  }

  if (typeof renderNav === 'function') renderNav();

  /* Re-render the current page after data is loaded */
  if (typeof renderStore === 'function') renderStore();
  if (typeof renderBuilder === 'function') {
    const builderPage = document.getElementById('page-builder');
    if (builderPage && builderPage.classList.contains('active')) renderBuilder();
  }

  /* Close modals on overlay click */
  ['loginModal', 'registerModal'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', ev => {
      if (ev.target === el) el.classList.remove('open');
    });
  });

  /* Close modals on Escape */
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape') return;
    closeLoginModal();
    closeRegisterModal();
  });
}

document.addEventListener('DOMContentLoaded', initAuth);
