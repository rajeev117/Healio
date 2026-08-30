// Moved to src/components/CalendarPicker.js so the provider-side schedule
// editor can pick leave dates without reaching into the patient module.
// The six COLORS keys it uses are identical in both themes, so this is a
// pure relocation. Kept as a re-export for the three patient screens that
// already import it from here.
export { default } from '../../../components/CalendarPicker';
