export const hospital = {
  name: "Healio Hospital",
  id: "HOSP-2451",
  city: "Kolkata",
  earnings: {
    today: "₹56,750",
    month: "₹3,15,200",
    year: "₹6,78,550",
    trend: [42, 55, 38, 67, 49, 72, 58],
  },
};

export const departments = [
  "Cardiology",
  "Pediatrics",
  "Orthopaedics",
  "Dermatology",
  "Neurology",
  "Gynaecology",
  "ENT",
  "General Medicine",
  "Oncology",
];

export const initialDoctors = [
  { id: "D-01", name: "Dr. Arjun Mehra", speciality: "Cardiology", department: "Cardiology", today: 12, rating: 4.9, fee: "₹800", phone: "+91 98300 11111", email: "arjun@apollo.in", active: true },
  { id: "D-02", name: "Dr. Priya Banerjee", speciality: "Pediatrics", department: "Pediatrics", today: 8, rating: 4.8, fee: "₹600", phone: "+91 98300 22222", email: "priya@apollo.in", active: true },
  { id: "D-03", name: "Dr. Sanjay Iyer", speciality: "Orthopaedics", department: "Orthopaedics", today: 6, rating: 4.7, fee: "₹900", phone: "+91 98300 33333", email: "sanjay@apollo.in", active: true },
  { id: "D-04", name: "Dr. Nandini Roy", speciality: "Dermatology", department: "Dermatology", today: 10, rating: 4.9, fee: "₹700", phone: "+91 98300 44444", email: "nandini@apollo.in", active: true },
  { id: "D-05", name: "Dr. Vikram Das", speciality: "Neurology", department: "Neurology", today: 5, rating: 4.6, fee: "₹1,200", phone: "+91 98300 55555", email: "vikram@apollo.in", active: false },
];

export const initialPatients = [
  {
    id: "P-9001", name: "Rubina Sharma", age: 34, gender: "F", lastVisit: "Today", status: "OPD",
    phone: "+91 98300 12345", email: "rubina@mail.com", bloodGroup: "B+", address: "12 Park St, Kolkata",
    allergies: ["Penicillin"], conditions: ["Hypertension"],
    history: [
      { date: "12 May 2026", doctor: "Dr. Mehra", note: "BP 138/88, advised lifestyle change" },
      { date: "02 Mar 2026", doctor: "Dr. Mehra", note: "Annual check-up, all normal" },
    ],
    appointments: [
      { id: "A-1021", date: "Today · 09:30 AM", doctor: "Dr. Mehra", type: "OPD", status: "confirmed" },
      { id: "A-0998", date: "12 May 2026", doctor: "Dr. Mehra", type: "Follow-up", status: "completed" },
    ],
  },
  {
    id: "P-9002", name: "Mohan Kumar", age: 52, gender: "M", lastVisit: "Today", status: "Follow-up",
    phone: "+91 98300 23456", bloodGroup: "O+", address: "44 Salt Lake, Kolkata",
    allergies: [], conditions: ["Diabetes Type 2"],
    history: [{ date: "18 May 2026", doctor: "Dr. Banerjee", note: "HbA1c 7.2, continue metformin" }],
    appointments: [{ id: "A-1022", date: "Today · 10:15 AM", doctor: "Dr. Banerjee", type: "Follow-up", status: "waiting" }],
  },
  {
    id: "P-9003", name: "Anna Doe", age: 28, gender: "F", lastVisit: "Yesterday", status: "Discharged",
    phone: "+91 98300 34567", bloodGroup: "A+", address: "8 New Town, Kolkata",
    allergies: ["Sulfa drugs"], conditions: [],
    history: [{ date: "Yesterday", doctor: "Dr. Roy", note: "Skin allergy, prescribed antihistamine" }],
    appointments: [{ id: "A-1023", date: "Today · 11:00 AM", doctor: "Dr. Mehra", type: "OPD", status: "confirmed" }],
  },
  {
    id: "P-9004", name: "John Doe", age: 61, gender: "M", lastVisit: "Today", status: "Admitted",
    phone: "+91 98300 45678", bloodGroup: "AB+", address: "21 Ballygunge, Kolkata",
    allergies: [], conditions: ["Cardiac arrhythmia", "Hypertension"],
    history: [
      { date: "Today", doctor: "Dr. Iyer", note: "ER admit, chest pain, ECG abnormal" },
      { date: "10 Apr 2026", doctor: "Dr. Mehra", note: "Stress test, mild ischemia" },
    ],
    appointments: [{ id: "A-1024", date: "Today · 12:45 PM", doctor: "Dr. Iyer", type: "Emergency", status: "admitted" }],
  },
  {
    id: "P-9005", name: "Sneha Roy", age: 24, gender: "F", lastVisit: "2 days ago", status: "Lab pending",
    phone: "+91 98300 56789", bloodGroup: "B-", address: "55 Howrah, Kolkata",
    allergies: [], conditions: [],
    history: [{ date: "2 days ago", doctor: "Dr. Banerjee", note: "Fatigue + headache; ordered CBC/Lipid" }],
    appointments: [],
  },
];

export const appointments = [
  { id: "A-1021", patient: "Rubina Sharma", patientId: "P-9001", doctor: "Dr. Mehra", time: "09:30 AM", type: "OPD", status: "confirmed" },
  { id: "A-1022", patient: "Mohan Kumar", patientId: "P-9002", doctor: "Dr. Banerjee", time: "10:15 AM", type: "Follow-up", status: "waiting" },
  { id: "A-1023", patient: "Anna Doe", patientId: "P-9003", doctor: "Dr. Mehra", time: "11:00 AM", type: "OPD", status: "confirmed" },
  { id: "A-1024", patient: "John Doe", patientId: "P-9004", doctor: "Dr. Iyer", time: "12:45 PM", type: "Emergency", status: "admitted" },
];

export const initialPharmacyOrders = [
  { id: "RX-3401", patient: "Rubina Sharma", items: 4, total: "₹1,240", status: "Pending" },
  { id: "RX-3402", patient: "Mohan Kumar", items: 2, total: "₹560", status: "Dispatched" },
  { id: "RX-3403", patient: "John Doe", items: 6, total: "₹2,180", status: "Delivered" },
];
export const PHARMACY_STATUSES = ["Pending", "Dispatched", "Delivered"];

export const initialLabTests = [
  { id: "LAB-501", patient: "Sneha Roy", test: "CBC + Lipid Profile", status: "Sample pending" },
  { id: "LAB-502", patient: "Anna Doe", test: "Thyroid Panel", status: "Processing" },
  { id: "LAB-503", patient: "John Doe", test: "ECG + Troponin", status: "Report ready" },
];
export const LAB_STATUSES = ["Sample pending", "Processing", "Report ready", "Delivered"];

export const initialHomeCare = [
  { id: "HC-201", patient: "Mohan Kumar", package: "Post-Surgery Care", days: 7, status: "Active" },
  { id: "HC-202", patient: "Mrs. Devi", package: "Elderly Care", days: 30, status: "Active" },
  { id: "HC-203", patient: "Rakesh Singh", package: "Nurse Visit", days: 1, status: "Scheduled" },
];
export const HOMECARE_STATUSES = ["Scheduled", "Active", "Completed", "Cancelled"];

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const initialSchedules = [
  { id: "S-1", doctorId: "D-01", department: "Cardiology", days: ["Mon", "Wed", "Fri"], start: "09:00", end: "13:00", slotMins: 15 },
  { id: "S-2", doctorId: "D-02", department: "Pediatrics", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], start: "10:00", end: "14:00", slotMins: 20 },
  { id: "S-3", doctorId: "D-04", department: "Dermatology", days: ["Tue", "Thu", "Sat"], start: "16:00", end: "20:00", slotMins: 15 },
];
