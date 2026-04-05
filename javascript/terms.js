/* ============================================================
   Digispex — terms.js
   ── TERMS AND AGREEMENT SYSTEM ──

   Responsibilities:
   • Renders the Terms & Conditions text block inside the
     payment review modal.
   • Controls the "I agree" checkbox state.
   • Keeps the Confirm Payment button disabled until agreed.
   • Resets agreement state when the modal re-opens.

   Integration points:
   • Called by openPaymentReview() in app.js (reset)
   • Called by selectPaymentReview() in app.js (show terms)
   • confirmPaymentReview() in app.js checks termsAgreed()
============================================================ */

/* ── Internal state ─────────────────────────────────────── */
let _termsAgreed = false;

/* ── Public: was the checkbox checked? ─────────────────── */
function termsAgreed() {
  return _termsAgreed;
}

/* ── Public: reset when modal opens ────────────────────── */
function resetTerms() {
  _termsAgreed = false;
  const cb  = document.getElementById('termsCheckbox');
  const err = document.getElementById('termsError');
  const btn = document.getElementById('prConfirmBtn');
  if (cb)  cb.checked = false;
  if (err) { err.textContent = ''; err.style.display = 'none'; }
  if (btn) btn.disabled = true;
}

/* ── Called by checkbox onchange ────────────────────────── */
function handleTermsChange(checkbox) {
  _termsAgreed = checkbox.checked;
  const btn = document.getElementById('prConfirmBtn');
  const err = document.getElementById('termsError');
  if (btn) btn.disabled = !_termsAgreed;
  if (err && _termsAgreed) { err.style.display = 'none'; }
}

/* ── Called by confirmPaymentReview before proceeding ───── */
function validateTerms() {
  if (_termsAgreed) return true;
  const err = document.getElementById('termsError');
  if (err) {
    err.textContent = 'You must agree to the Terms and Conditions before confirming payment.';
    err.style.display = 'block';
    err.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  return false;
}
