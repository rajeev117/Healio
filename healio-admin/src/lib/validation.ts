// ─────────────────────────────────────────────────────────────────────────────
// Input validation for admin-entered data.
//
// Mirrors healio-provider-mobile/src/lib/validation.js on purpose: a phone
// typed here becomes organisations.admin_phone, which IS the provider's login
// credential in the mobile app. If the two disagree, an admin can create an
// organisation that nobody is able to log into.
//
// The create-org form previously checked only `phone.trim().length !== 10`, so
// "abcdefghij" passed and wrote a permanently unusable credential.
// ─────────────────────────────────────────────────────────────────────────────

// A person's name — no digits.
export const NAME_RE     = /^[A-Za-zऀ-ॿঀ-৿\s.'-]{2,60}$/;
// A business name. Real Indian providers are called "Apollo 24|7" and
// "Clinic 360", so digits and trading punctuation have to be allowed; at least
// one letter is still required so "123" or "---" can't get through.
export const ORG_NAME_RE = /^[A-Za-z0-9ऀ-ॿঀ-৿\s.,'&()/|+#-]{2,80}$/;
const HAS_LETTER_RE      = /[A-Za-zऀ-ॿঀ-৿]/;
export const PHONE_RE   = /^[6-9][0-9]{9}$/;
export const EMAIL_RE   = /^\S+@\S+\.\S+$/;

const str = (v: unknown) => String(v ?? '').trim();

export const isValidName    = (v: unknown) => NAME_RE.test(str(v));
export const isValidOrgName = (v: unknown) =>
  ORG_NAME_RE.test(str(v)) && HAS_LETTER_RE.test(str(v));
export const isValidPhone = (v: unknown) => PHONE_RE.test(str(v).replace(/\D/g, ''));
export const isValidEmail = (v: unknown) => !str(v) || EMAIL_RE.test(str(v));

/** Which rule a name broke, or null when it is fine. */
export function nameProblem(
  v: unknown,
  opts: { org?: boolean } = {},
): 'required' | 'invalid' | null {
  const s = str(v);
  if (!s) return 'required';
  const ok = opts.org ? isValidOrgName(s) : NAME_RE.test(s);
  return ok ? null : 'invalid';
}
