import { supabase } from '../../../lib/supabase';
import { reportLabResult, getActiveAppointmentId } from '../../../lib/careFlow';

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

export async function fetchLabPatients(hospitalId) {
  const { data, error } = await supabase
    .from('lab_orders')
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

export async function fetchLabEarnings(hospitalId) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const weekStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('lab_orders')
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

  // Build 7-day trend (last 7 days including today)
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

// Records a walk-in lab checkout. The bill (receipt) and the report (test
// result) are two separate uploads: the bill is stored on the order, the
// report is stored on the order AND mirrored into the patient's health_records.
export async function completeLabOrder(patientId, hospitalId, amount, billUrl, reportUrl = null) {
  const order_id = `LAB-${Date.now()}`;
  // Link to the patient's current visit so the bill/report reaches the RMP who
  // booked it (null for a pure walk-in with no booking).
  const appointmentId = await getActiveAppointmentId(patientId, hospitalId);
  const base = {
    order_id,
    patient_id: patientId,
    organisation_id: hospitalId,
    appointment_id: appointmentId,
    tests: [],
    total: parseFloat(amount) || 0,
    status: 'completed',
    report_url: reportUrl || null,
    scheduled_date: new Date().toISOString().slice(0, 10),
    scheduled_time: 'Walk-in',
  };

  let { data, error } = await supabase
    .from('lab_orders')
    .insert({ ...base, bill_url: billUrl || null })
    .select('id')
    .single();

  // Fallback for DBs where migration-047 (bill_url) hasn't been applied yet:
  // keep checkout working by storing the bill in report_url only when there's
  // no separate report to preserve there.
  if (error && /bill_url/.test(error.message || '')) {
    ({ data, error } = await supabase
      .from('lab_orders')
      .insert({ ...base, report_url: reportUrl || billUrl || null })
      .select('id')
      .single());
  }
  if (error) throw error;

  // Mirror the report into the patient's records so they can see the result.
  if (reportUrl && data?.id) {
    await reportLabResult({ orderId: data.id, reportUrl });
  }
  return data?.id;
}
