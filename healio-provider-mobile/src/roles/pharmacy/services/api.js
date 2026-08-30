import { supabase } from '../../../lib/supabase';
import { getActiveAppointmentId } from '../../../lib/careFlow';

const calcAge = (dob) =>
  dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

export async function fetchOrgInfo(hospitalId) {
  const { data, error } = await supabase
    .from('organisations')
    .select('id, name, city, address, admin_phone')
    .eq('id', hospitalId)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchPharmacyPatients(hospitalId) {
  const { data, error } = await supabase
    .from('pharmacy_orders')
    .select('id, total, status, created_at, patient_id, patient:profiles!patient_id(id, name, phone, gender, date_of_birth)')
    .eq('organisation_id', hospitalId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const map = {};
  (data || []).forEach(order => {
    const pid = order.patient_id;
    if (!map[pid]) {
      map[pid] = {
        ...order.patient,
        age: calcAge(order.patient?.date_of_birth),
        orders: [],
      };
    }
    map[pid].orders.push({ id: order.id, total: order.total, status: order.status, created_at: order.created_at });
  });
  return Object.values(map);
}

export async function fetchPatientPrescriptions(patientId) {
  const { data, error } = await supabase
    .from('prescriptions')
    .select('id, file_url, created_at, medicines, appointment:appointments!appointment_id(scheduled_at, doctor:staff!doctor_staff_id(name))')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchPharmacyEarnings(hospitalId) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const weekStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('pharmacy_orders')
    .select('total, status, created_at')
    .eq('organisation_id', hospitalId)
    .neq('status', 'cancelled')
    .gte('created_at', monthStart);
  if (error) throw error;

  const orders = data || [];
  const todayTotal = orders
    .filter(o => o.created_at.slice(0, 10) === todayStr)
    .reduce((s, o) => s + Number(o.total), 0);
  const weekTotal = orders
    .filter(o => o.created_at >= weekStart)
    .reduce((s, o) => s + Number(o.total), 0);
  const monthTotal = orders.reduce((s, o) => s + Number(o.total), 0);
  const pending = orders
    .filter(o => o.status === 'pending')
    .reduce((s, o) => s + Number(o.total), 0);

  const weekTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return orders.filter(o => o.created_at.slice(0, 10) === d).reduce((s, o) => s + Number(o.total), 0);
  });
  const weekLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
    return d.toLocaleDateString('en-IN', { weekday: 'short' });
  });

  return { today: todayTotal, week: weekTotal, month: monthTotal, pendingPayout: pending, weekTrend, weekLabels };
}

export async function completePharmacyOrder(patientId, hospitalId, amount, billUrl = null) {
  const order_id = `PHARM-${Date.now()}`;
  // Link to the patient's current visit so the bill reaches the RMP who booked
  // it (null for a pure walk-in with no booking).
  const appointmentId = await getActiveAppointmentId(patientId, hospitalId);
  const { error } = await supabase.from('pharmacy_orders').insert({
    order_id,
    patient_id: patientId,
    organisation_id: hospitalId,
    appointment_id: appointmentId,
    items: [],
    total: parseFloat(amount) || 0,
    status: 'completed',
  });
  if (error) throw error;

  // pharmacy_orders has no bill column, so mirror the uploaded bill into the
  // patient's health_records (same idea as reportLabResult for lab reports).
  // Best-effort: a failure here (e.g. RLS when the patient isn't in this org)
  // must not undo a completed checkout.
  if (billUrl) {
    try {
      await supabase.from('health_records').insert({
        patient_id:      patientId,
        organisation_id: hospitalId,
        appointment_id:  appointmentId,
        type:            'pharmacy_bill',
        title:           'Pharmacy Bill',
        file_url:        billUrl,
        uploaded_by:     'pharmacy',
        recorded_at:     new Date().toISOString().slice(0, 10),
      });
    } catch (e) {
      console.warn('Pharmacy bill record mirror failed:', e.message);
    }
  }
}
