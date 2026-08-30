import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const CELL = 38;
// Day grid runs to 6 rows; hold the same height in year/month mode so the
// dialog doesn't jump as you drill in.
const BODY_HEIGHT = 6 * CELL;
const YEAR_ROW = 44;

function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function firstDay(y, m) { return new Date(y, m, 1).getDay(); }
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

export default function CalendarPicker({ visible, value, onChange, onClose, maxDate, minDate }) {
  const today = new Date();
  const max = maxDate || today;
  const min = minDate || new Date(1900, 0, 1);

  const initYear = value ? value.getFullYear() : max.getFullYear() - 25;
  const initMonth = value ? value.getMonth() : max.getMonth();

  const [vYear, setVYear] = useState(initYear);
  const [vMonth, setVMonth] = useState(initMonth);
  const [sel, setSel] = useState(value || null);
  // 'day' → 'year' → 'month' → 'day'. A date of birth is decades away from
  // today, and month arrows alone would take ~200 taps to get there.
  const [mode, setMode] = useState('day');
  const yearScroll = useRef(null);

  useEffect(() => {
    if (visible) {
      setSel(value || null);
      setVYear(value ? value.getFullYear() : max.getFullYear() - 25);
      setVMonth(value ? value.getMonth() : max.getMonth());
      setMode('day');
    }
  }, [visible]);

  const years = [];
  for (let y = min.getFullYear(); y <= max.getFullYear(); y++) years.push(y);

  // Open the year list already scrolled to the year in view, so it needs a
  // nudge rather than a hunt.
  useEffect(() => {
    if (mode !== 'year') return;
    const index = Math.max(years.indexOf(vYear), 0);
    const offset = Math.max(Math.floor(index / 4) * YEAR_ROW - BODY_HEIGHT / 2 + YEAR_ROW, 0);
    const t = setTimeout(() => yearScroll.current?.scrollTo({ y: offset, animated: false }), 0);
    return () => clearTimeout(t);
  }, [mode, vYear]);

  const pickYear = (y) => {
    setVYear(y);
    // Landing on the boundary year can leave the month out of range.
    const lo = y === min.getFullYear() ? min.getMonth() : 0;
    const hi = y === max.getFullYear() ? max.getMonth() : 11;
    setVMonth((m) => clamp(m, lo, hi));
    setMode('month');
  };

  const pickMonth = (m) => {
    setVMonth(m);
    setMode('day');
  };

  const monthDisabled = (m) =>
    (vYear === max.getFullYear() && m > max.getMonth()) ||
    (vYear === min.getFullYear() && m < min.getMonth());

  const prevMonth = () => {
    const nm = vMonth === 0 ? 11 : vMonth - 1;
    const ny = vMonth === 0 ? vYear - 1 : vYear;
    if (ny < min.getFullYear() || (ny === min.getFullYear() && nm < min.getMonth())) return;
    setVMonth(nm);
    setVYear(ny);
  };

  const nextMonth = () => {
    const nm = vMonth === 11 ? 0 : vMonth + 1;
    const ny = vMonth === 11 ? vYear + 1 : vYear;
    if (ny > max.getFullYear() || (ny === max.getFullYear() && nm > max.getMonth())) return;
    setVMonth(nm);
    setVYear(ny);
  };

  const dim = daysInMonth(vYear, vMonth);
  const fd = firstDay(vYear, vMonth);
  const cells = [];
  for (let i = 0; i < fd; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isSelected = (d) => {
    if (!d || !sel) return false;
    return sel.getDate() === d && sel.getMonth() === vMonth && sel.getFullYear() === vYear;
  };

  const isDisabled = (d) => {
    if (!d) return true;
    const dt = new Date(vYear, vMonth, d);
    return dt > max || dt < min;
  };

  const pickDay = (d) => {
    if (!d || isDisabled(d)) return;
    setSel(new Date(vYear, vMonth, d));
  };

  const confirm = () => {
    if (sel) onChange(sel);
    onClose();
  };

  const canPrevMonth = !(vYear === min.getFullYear() && vMonth === min.getMonth());
  const canNextMonth = !(vYear === max.getFullYear() && vMonth === max.getMonth());

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          {/* Header — the label itself switches between day / month / year */}
          <View style={styles.navRow}>
            <TouchableOpacity
              onPress={prevMonth}
              style={[styles.navBtn, (!canPrevMonth || mode !== 'day') && { opacity: 0 }]}
              disabled={!canPrevMonth || mode !== 'day'}
            >
              <Ionicons name="chevron-back" size={20} color={COLORS.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.labelBtn}
              onPress={() => setMode(mode === 'day' ? 'year' : 'day')}
              activeOpacity={0.7}
            >
              <Text style={styles.monthLabel}>
                {mode === 'day' ? `${MONTHS[vMonth]} ${vYear}` : mode === 'month' ? vYear : 'Select year'}
              </Text>
              <Ionicons
                name={mode === 'day' ? 'chevron-down' : 'chevron-up'}
                size={16}
                color={COLORS.primary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={nextMonth}
              style={[styles.navBtn, (!canNextMonth || mode !== 'day') && { opacity: 0 }]}
              disabled={!canNextMonth || mode !== 'day'}
            >
              <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {mode === 'day' && (
            <>
              {/* Day-of-week headers */}
              <View style={styles.weekRow}>
                {DOW.map((d, i) => (
                  <View key={i} style={styles.cell}>
                    <Text style={styles.dowText}>{d}</Text>
                  </View>
                ))}
              </View>

              {/* Calendar grid */}
              <View style={[styles.grid, { minHeight: BODY_HEIGHT }]}>
                {cells.map((day, i) => {
                  const active = isSelected(day);
                  const disabled = isDisabled(day);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.cell, active && styles.cellActive]}
                      onPress={() => pickDay(day)}
                      disabled={!day || disabled}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.dayText,
                        active && styles.dayTextActive,
                        disabled && styles.dayTextDisabled,
                      ]}>
                        {day || ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {mode === 'year' && (
            <ScrollView
              ref={yearScroll}
              style={{ height: BODY_HEIGHT }}
              contentContainerStyle={styles.grid}
              showsVerticalScrollIndicator={false}
            >
              {years.map((y) => {
                const active = y === vYear;
                return (
                  <TouchableOpacity
                    key={y}
                    style={[styles.yearCell, active && styles.pillActive]}
                    onPress={() => pickYear(y)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.yearText, active && styles.dayTextActive]}>{y}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {mode === 'month' && (
            <View style={[styles.grid, { height: BODY_HEIGHT }]}>
              {MONTHS_SHORT.map((label, m) => {
                const active = m === vMonth;
                const disabled = monthDisabled(m);
                return (
                  <TouchableOpacity
                    key={label}
                    style={[styles.monthCell, active && styles.pillActive]}
                    onPress={() => pickMonth(m)}
                    disabled={disabled}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.yearText,
                      active && styles.dayTextActive,
                      disabled && styles.dayTextDisabled,
                    ]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirm}
              style={[styles.okBtn, !sel && { opacity: 0.4 }]}
              disabled={!sel}
            >
              <Text style={styles.okText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    width: 7 * CELL + 32,
    ...Platform.select({
      web: { boxShadow: '0px 8px 32px rgba(0,0,0,0.25)' },
      default: {
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 14,
      },
    }),
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  navBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  labelBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4 },
  monthLabel: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  yearCell: {
    width: '25%', height: YEAR_ROW,
    justifyContent: 'center', alignItems: 'center',
  },
  monthCell: {
    width: '33.333%', height: BODY_HEIGHT / 4,
    justifyContent: 'center', alignItems: 'center',
  },
  pillActive: { backgroundColor: COLORS.primary, borderRadius: 16 },
  yearText: { fontSize: 14.5, fontWeight: '700', color: COLORS.text },
  cell: {
    width: CELL,
    height: CELL,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: CELL / 2,
  },
  cellActive: { backgroundColor: COLORS.primary },
  dowText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  dayText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  dayTextActive: { color: COLORS.white, fontWeight: '800' },
  dayTextDisabled: { color: COLORS.border },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cancelBtn: {
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelText: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
  okBtn: {
    paddingHorizontal: 20, paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  okText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});
