// Time-aware greeting, shared across the dashboards.
//
// This logic was copy-pasted into roles/doctor, roles/patient and roles/rmp.
// The keys are already translated into English, Hindi and Bengali, so every
// caller gets the greeting in the user's language for free.
export const getGreeting = (t) => {
  const h = new Date().getHours();
  if (h < 12) return t('doc_good_morning');
  if (h < 17) return t('doc_good_afternoon');
  return t('doc_good_evening');
};

export default getGreeting;
