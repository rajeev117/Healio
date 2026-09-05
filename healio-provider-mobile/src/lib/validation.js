// ─────────────────────────────────────────────────────────────────────────────
// Shared input validation.
//
// These rules were previously scattered and inconsistent: the RMP signup had a
// real name regex, provider and patient signup only checked the field was
// non-empty (so ".", "1" or 500 characters all passed), and the admin panel's
// create-org form checked phone.length === 10 without checking they were digits
// — writing junk into admin_phone, which IS the login credential.
//
// PEOPLE and BUSINESSES get different name rules on purpose. A person is not
// called "Ward 3", but plenty of real Indian providers are called "Apollo 24|7"
// or "Clinic 360", so a single no-digits rule would reject legitimate
// registrations.
//
// Script ranges cover the three languages this app ships:
//   A-Za-z    Latin
//   ऀ-ॿ       Devanagari (Hindi)
//   ঀ-৿       Bengali
// ─────────────────────────────────────────────────────────────────────────────

// A person's name: letters, spaces, and the punctuation that genuinely appears
// in names (O'Brien, Rev. Kumar, Anne-Marie). No digits.
export const NAME_RE = /^[A-Za-zऀ-ॿঀ-৿\s.'-]{2,60}$/;

// A business name: the above plus digits and the separators that show up in
// real trading names — & , ( ) / | + #. Still capped, and still required to
// contain at least one letter so "123" or "---" can't get through.
export const ORG_NAME_RE = /^[A-Za-z0-9ऀ-ॿঀ-৿\s.,'&()/|+#-]{2,80}$/;
const HAS_LETTER_RE = /[A-Za-zऀ-ॿঀ-৿]/;

// Indian mobile numbers: 10 digits starting 6-9, no country code.
export const PHONE_RE = /^[6-9][0-9]{9}$/;

// Deliberately loose. Strict email regexes reject valid addresses far more
// often than they catch typos; the real check is whether mail arrives.
export const EMAIL_RE = /^\S+@\S+\.\S+$/;

// Indian PIN codes never start with 0.
export const PINCODE_RE = /^[1-9][0-9]{5}$/;

const str = (v) => String(v ?? '').trim();

/** A person's name. */
export const isValidName = (v) => NAME_RE.test(str(v));

/** A hospital / lab / pharmacy / clinic name. */
export const isValidOrgName = (v) =>
  ORG_NAME_RE.test(str(v)) && HAS_LETTER_RE.test(str(v));

/**
 * A 10-digit Indian mobile number.
 *
 * Digits are stripped first so a pasted "+91 98765 43210" is judged on the
 * number itself rather than failing on formatting the user can't see is wrong.
 * Exactly ten must remain — taking the last ten would quietly accept a
 * mistyped 12-digit number.
 */
export const isValidPhone = (v) => PHONE_RE.test(str(v).replace(/\D/g, ''));

/** Optional field: empty passes, anything present must look like an address. */
export const isValidEmail = (v) => !str(v) || EMAIL_RE.test(str(v));

/** A 6-digit Indian PIN code. */
export const isValidPincode = (v) => PINCODE_RE.test(str(v));

/**
 * Which rule a name broke, or null when it is fine — so callers can show
 * "required" and "invalid" as different messages.
 *
 * @param {unknown} v
 * @param {{ org?: boolean }} [opts] org: true applies the business-name rule
 * @returns {'required'|'invalid'|null}
 */
export function nameProblem(v, opts = {}) {
  const s = str(v);
  if (!s) return 'required';
  const ok = opts.org ? isValidOrgName(s) : NAME_RE.test(s);
  return ok ? null : 'invalid';
}
