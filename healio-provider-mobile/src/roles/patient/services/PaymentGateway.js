// ─────────────────────────────────────────────────────────────────────────────
// PaymentGateway — PLACEHOLDER payment processor for the wallet top-up flow.
//
// It mimics the shape of a hosted checkout (order ids, instrument validation,
// authorisation, terminal status + receipt) so the screens look and behave like
// the real thing during demos, but nothing here talks to a PSP: no network call
// is made and no card / UPI detail entered by the patient ever leaves the
// device. Every transaction it produces is flagged `is_test`.
//
// When a real gateway is integrated, keep the ids/validators and replace
// `authorize()` with the SDK call — the screens consume this module only.
// ─────────────────────────────────────────────────────────────────────────────

export const MERCHANT = {
  legalName: 'Healio Healthcare Pvt Ltd',
  displayName: 'Healio',
  gateway: 'Healio Pay',
};

// Checkout session length, in seconds — mirrors a typical hosted-page timeout.
export const SESSION_SECONDS = 10 * 60;

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function token(len) {
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

function digits(len) {
  let out = '';
  for (let i = 0; i < len; i += 1) out += Math.floor(Math.random() * 10);
  return out;
}

export const makeOrderId   = () => `order_${token(14)}`;
export const makePaymentId = () => `pay_${token(14)}`;
export const makeRrn       = () => digits(12);

// ─── Instruments ─────────────────────────────────────────────────────────────

export const UPI_APPS = [
  { id: 'gpay',    label: 'Google Pay', handle: 'oksbi'   },
  { id: 'phonepe', label: 'PhonePe',    handle: 'ybl'     },
  { id: 'paytm',   label: 'Paytm',      handle: 'paytm'   },
  { id: 'bhim',    label: 'BHIM',       handle: 'upi'     },
];

export const BANKS = [
  { id: 'hdfc',  label: 'HDFC Bank',       short: 'HDFC' },
  { id: 'icici', label: 'ICICI Bank',      short: 'ICICI' },
  { id: 'sbi',   label: 'State Bank of India', short: 'SBI' },
  { id: 'axis',  label: 'Axis Bank',       short: 'AXIS' },
  { id: 'kotak', label: 'Kotak Mahindra',  short: 'KOTAK' },
  { id: 'pnb',   label: 'Punjab National Bank', short: 'PNB' },
];

export const CARD_BRANDS = {
  visa:       { label: 'VISA',        icon: 'card' },
  mastercard: { label: 'Mastercard',  icon: 'card' },
  rupay:      { label: 'RuPay',       icon: 'card' },
  amex:       { label: 'Amex',        icon: 'card' },
  unknown:    { label: 'Card',        icon: 'card-outline' },
};

export function detectCardBrand(number) {
  const n = String(number).replace(/\D/g, '');
  if (/^4/.test(n)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'mastercard';
  if (/^(60|65|81|82|508)/.test(n)) return 'rupay';
  if (/^3[47]/.test(n)) return 'amex';
  return 'unknown';
}

export function formatCardNumber(value) {
  const n = String(value).replace(/\D/g, '').slice(0, 16);
  return n.replace(/(.{4})/g, '$1 ').trim();
}

export function formatExpiry(value) {
  const n = String(value).replace(/\D/g, '').slice(0, 4);
  if (n.length < 3) return n;
  return `${n.slice(0, 2)}/${n.slice(2)}`;
}

export function expiryValid(value) {
  const [mm, yy] = String(value).split('/');
  if (!mm || !yy || mm.length !== 2 || yy.length !== 2) return false;
  const month = Number(mm);
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const expYear = 2000 + Number(yy);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (expYear < currentYear) return false;
  if (expYear === currentYear && month < currentMonth) return false;
  return true;
}

// Luhn check — the same first-line validation a real checkout runs client-side.
export function luhnValid(number) {
  const n = String(number).replace(/\D/g, '');
  if (n.length < 12) return false;
  let sum = 0;
  let double = false;
  for (let i = n.length - 1; i >= 0; i -= 1) {
    let d = Number(n[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export const upiIdValid = (id) => /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(String(id).trim());

export const maskCard = (number) => `•••• ${String(number).replace(/\D/g, '').slice(-4)}`;

// ─── Authorisation ───────────────────────────────────────────────────────────

// Decline codes shaped like the ones a real PSP returns, used by the sandbox
// "simulate failure" control so the failure screen can be demoed too.
export const DECLINE_REASONS = [
  { code: 'BANK_DECLINED',      message: 'The issuing bank declined this transaction.' },
  { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient funds in the selected account.' },
  { code: 'AUTH_TIMEOUT',       message: 'Authorisation was not completed in time.' },
];

export const PROCESSING_STEPS = [
  'Verifying payment details',
  'Contacting issuing bank',
  'Authorising transaction',
  'Crediting Healio Wallet',
];

/**
 * Stand-in for the PSP authorisation call. Resolves with a terminal result
 * after a realistic delay; `outcome` lets the sandbox force either branch.
 */
export function authorize({ outcome = 'success', delay = 900 } = {}) {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (outcome === 'failure') {
        const reason = DECLINE_REASONS[Math.floor(Math.random() * DECLINE_REASONS.length)];
        resolve({ status: 'failed', ...reason });
        return;
      }
      resolve({
        status: 'captured',
        paymentId: makePaymentId(),
        rrn: makeRrn(),
        authorizedAt: new Date().toISOString(),
      });
    }, delay);
  });
}

export function formatInr(amount) {
  return Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
