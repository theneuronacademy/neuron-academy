// Phase 2 — Admin demo data layer.
// DEMO values only. No backend yet.
// Real APIs will replace services/adminApi.ts without touching UI.
// Public website content stays in /data/* — this file is admin-only.

export interface AdminStudent {
  id: string;
  studentId: string;
  name: string;
  email: string;
  phone: string;
  batch: string;
  course: string;
  joiningDate: string;
  attendancePct: number;
  avgScore: number;
  status: "active" | "inactive";
}

export interface AdminFaculty {
  id: string;
  name: string;
  photo: string;
  email: string;
  phone: string;
  subject: string;
  qualification: string;
  experience: string;
  batches: string[];
  status: "active" | "inactive";
}

export interface AdminBatch {
  id: string;
  name: string;
  course: string;
  faculty: string;
  studentCount: number;
  startDate: string;
  endDate: string;
  status: "active" | "upcoming" | "completed";
}

export type AdminTestType = "Live Test" | "Offline Test" | "Practice Test";
export type AdminTestStatus = "Draft" | "Scheduled" | "Published" | "Live" | "Completed";

export interface AdminTest {
  id: string;
  name: string;
  batch: string;
  type: AdminTestType;
  date: string;
  time: string;
  durationMin: number;
  questions: number;
  status: AdminTestStatus;
}

export interface AdminBanner {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  videoUrl: string;
  buttonText: string;
  buttonUrl: string;
  startDate: string;
  endDate: string;
  active: boolean;
  order: number;
}

export interface AdminPopup {
  id: string;
  title: string;
  message: string;
  image: string;
  videoUrl: string;
  buttonText: string;
  buttonUrl: string;
  frequency: "once-per-session" | "once-per-day" | "every-visit";
  startDate: string;
  endDate: string;
  active: boolean;
}

export type EnquiryStatus = "New" | "Contacted" | "Converted" | "Closed";

export interface AdminEnquiry {
  id: string;
  name: string;
  phone: string;
  email: string;
  course: string;
  message: string;
  date: string;
  status: EnquiryStatus;
}

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  audience: string;
  date: string;
  status: "Sent" | "Scheduled" | "Draft";
}

export interface AdminActivity {
  id: string;
  text: string;
  time: string;
}

export interface DashboardStats {
  totalStudents: number;
  totalFaculty: number;
  activeBatches: number;
  publishedTests: number;
  pendingEnquiries: number;
  todayAttendancePct: number;
}

// ---- Dashboard demo ----

export const DEMO_STATS: DashboardStats = {
  totalStudents: 248,
  totalFaculty: 16,
  activeBatches: 12,
  publishedTests: 34,
  pendingEnquiries: 18,
  todayAttendancePct: 87,
};

export const DEMO_ACTIVITY: AdminActivity[] = [
  { id: "a1", text: "New student added — Ayan Khan (JEE 2027)", time: "10 min ago" },
  { id: "a2", text: "Test published — NEET Mock 12 (Biology)", time: "1 hr ago" },
  { id: "a3", text: "Faculty profile updated — Dr. S. Rao", time: "3 hrs ago" },
  { id: "a4", text: "Result uploaded — AMU Entrance Mock 5", time: "Yesterday" },
  { id: "a5", text: "Banner published — Admissions Open 2026–27", time: "Yesterday" },
  { id: "a6", text: "Attendance synced — 11 batches", time: "2 days ago" },
];

export const DEMO_UPCOMING_TESTS: AdminTest[] = [
  { id: "t1", name: "JEE Main Mock 14", batch: "JEE 2027-A", type: "Live Test", date: "2026-10-05", time: "10:00 AM", durationMin: 180, questions: 90, status: "Scheduled" },
  { id: "t2", name: "NEET Mock 12", batch: "NEET 2027-A", type: "Live Test", date: "2026-10-06", time: "2:00 PM", durationMin: 200, questions: 200, status: "Scheduled" },
  { id: "t3", name: "AMU Entrance Mock 5", batch: "AMU-XI", type: "Offline Test", date: "2026-10-07", time: "11:00 AM", durationMin: 120, questions: 100, status: "Published" },
  { id: "t4", name: "Jamia IX Practice 8", batch: "JMI-IX", type: "Practice Test", date: "2026-10-08", time: "4:00 PM", durationMin: 90, questions: 80, status: "Draft" },
];

export const DEMO_ATTENDANCE_OVERVIEW = [
  { batch: "JEE 2027-A", pct: 91 },
  { batch: "NEET 2027-A", pct: 88 },
  { batch: "AMU-XI", pct: 84 },
  { batch: "JMI-IX", pct: 79 },
];

export const DEMO_WEBSITE_STATUS = {
  online: true,
  lastUpdate: "Oct 2, 2026 • 6:40 PM",
  activeBanners: 3,
  activePopups: 1,
};

// ---- People demo ----

export const DEMO_STUDENTS: AdminStudent[] = [
  { id: "s1", studentId: "NA-2026-001", name: "Ayan Khan", email: "ayan.k@example.com", phone: "+91 97119 10001", batch: "JEE 2027-A", course: "JEE Main + Advanced", joiningDate: "2026-06-10", attendancePct: 92, avgScore: 78, status: "active" },
  { id: "s2", studentId: "NA-2026-002", name: "Fatima Siddiqui", email: "fatima.s@example.com", phone: "+91 97119 10002", batch: "NEET 2027-A", course: "NEET-UG", joiningDate: "2026-06-12", attendancePct: 88, avgScore: 81, status: "active" },
  { id: "s3", studentId: "NA-2026-003", name: "Mohd. Arham", email: "arham.m@example.com", phone: "+91 97119 10003", batch: "AMU-XI", course: "AMU Entrance", joiningDate: "2026-07-01", attendancePct: 76, avgScore: 69, status: "active" },
  { id: "s4", studentId: "NA-2026-004", name: "Zoya Ansari", email: "zoya.a@example.com", phone: "+91 97119 10004", batch: "JMI-IX", course: "Jamia Entrance (JMI)", joiningDate: "2026-07-05", attendancePct: 95, avgScore: 88, status: "active" },
  { id: "s5", studentId: "NA-2026-005", name: "Danish Ali", email: "danish.a@example.com", phone: "+91 97119 10005", batch: "JEE 2027-B", course: "JEE Main + Advanced", joiningDate: "2026-06-20", attendancePct: 64, avgScore: 58, status: "inactive" },
  { id: "s6", studentId: "NA-2026-006", name: "Sana Parveen", email: "sana.p@example.com", phone: "+91 97119 10006", batch: "Foundation X", course: "Foundation (IX–X)", joiningDate: "2026-08-02", attendancePct: 90, avgScore: 84, status: "active" },
];

export const DEMO_FACULTY: AdminFaculty[] = [
  { id: "f1", name: "Dr. S. Rao", photo: "", email: "s.rao@neuronacademy.in", phone: "+91 97119 20001", subject: "Physics", qualification: "Ph.D, IIT Delhi", experience: "12 yrs", batches: ["JEE 2027-A", "JEE 2027-B"], status: "active" },
  { id: "f2", name: "Prof. N. Verma", photo: "", email: "n.verma@neuronacademy.in", phone: "+91 97119 20002", subject: "Biology", qualification: "M.Sc, AIIMS background", experience: "10 yrs", batches: ["NEET 2027-A"], status: "active" },
  { id: "f3", name: "Imran Sheikh", photo: "", email: "i.sheikh@neuronacademy.in", phone: "+91 97119 20003", subject: "Maths", qualification: "B.Tech, AMU", experience: "8 yrs", batches: ["AMU-XI", "JMI-IX"], status: "active" },
  { id: "f4", name: "Huda Khan", photo: "", email: "h.khan@neuronacademy.in", phone: "+91 97119 20004", subject: "Chemistry", qualification: "M.Sc, Jamia Millia", experience: "7 yrs", batches: ["NEET 2027-A", "JEE 2027-A"], status: "inactive" },
];

export const DEMO_BATCHES: AdminBatch[] = [
  { id: "b1", name: "JEE 2027-A", course: "JEE Main + Advanced", faculty: "Dr. S. Rao", studentCount: 42, startDate: "2026-06-10", endDate: "2027-03-31", status: "active" },
  { id: "b2", name: "NEET 2027-A", course: "NEET-UG", faculty: "Prof. N. Verma", studentCount: 38, startDate: "2026-06-12", endDate: "2027-03-31", status: "active" },
  { id: "b3", name: "AMU-XI", course: "AMU Entrance", faculty: "Imran Sheikh", studentCount: 30, startDate: "2026-07-01", endDate: "2027-02-28", status: "active" },
  { id: "b4", name: "JMI-IX", course: "Jamia Entrance (JMI)", faculty: "Imran Sheikh", studentCount: 26, startDate: "2026-07-05", endDate: "2027-02-28", status: "upcoming" },
  { id: "b5", name: "Foundation X", course: "Foundation (IX–X)", faculty: "Huda Khan", studentCount: 34, startDate: "2026-08-02", endDate: "2027-03-15", status: "active" },
];

// ---- Academic demo ----

export const DEMO_TESTS: AdminTest[] = [
  ...DEMO_UPCOMING_TESTS,
  { id: "t5", name: "JEE Advanced Paper-1", batch: "JEE 2027-A", type: "Offline Test", date: "2026-09-28", time: "9:00 AM", durationMin: 180, questions: 54, status: "Completed" },
  { id: "t6", name: "NEET Practice 20", batch: "NEET 2027-A", type: "Practice Test", date: "2026-09-30", time: "—", durationMin: 60, questions: 50, status: "Published" },
];

// ---- Website demo ----

export const DEMO_BANNERS: AdminBanner[] = [
  { id: "bn1", title: "Admissions Open 2026–27", subtitle: "JEE • NEET • AMU • Jamia", description: "Small batches, weekly mocks and mentors who track every mark.", image: "", videoUrl: "", buttonText: "Explore Courses", buttonUrl: "#courses", startDate: "2026-09-01", endDate: "2027-03-31", active: true, order: 1 },
  { id: "bn2", title: "Weekly Mock Tests With Ranks", subtitle: "Practice • Perform • Improve", description: "Exam-pattern mocks every Saturday with solutions and analysis.", image: "", videoUrl: "", buttonText: "Take a Demo Test", buttonUrl: "/student/login", startDate: "2026-09-15", endDate: "2027-03-31", active: true, order: 2 },
  { id: "bn3", title: "Scholarship Test — Oct 12", subtitle: "Up to 100% tuition waiver", description: "Open to Class IX–XII aspirants. Limited seats per slot.", image: "", videoUrl: "", buttonText: "Register Free", buttonUrl: "#contact", startDate: "2026-10-01", endDate: "2026-10-12", active: false, order: 3 },
];

export const DEMO_POPUPS: AdminPopup[] = [
  { id: "pp1", title: "Book Your Free Demo", message: "Attend 2 demo classes + 1 mock test free. Counsellors reply within a day.", image: "", videoUrl: "", buttonText: "Book Free Demo", buttonUrl: "#contact", frequency: "once-per-session", startDate: "2026-09-20", endDate: "2026-12-31", active: true },
  { id: "pp2", title: "Scholarship Alert", message: "Oct 12 scholarship test — early-bird registration closes Oct 10.", image: "", videoUrl: "", buttonText: "Register", buttonUrl: "#contact", frequency: "once-per-day", startDate: "2026-10-01", endDate: "2026-10-12", active: false },
];

export const DEMO_ANNOUNCEMENTS = [
  { id: "an1", text: "Admissions Open — New Batches Starting Soon", active: true, date: "2026-10-01" },
  { id: "an2", text: "Scholarship Test on Oct 12 — Register Free", active: true, date: "2026-10-02" },
  { id: "an3", text: "Diwali break: doubt lounge open till 6 PM", active: false, date: "2026-09-28" },
];

// ---- Communication demo ----

export const DEMO_ENQUIRIES: AdminEnquiry[] = [
  { id: "e1", name: "Salman Farooqui", phone: "+91 97119 30001", email: "salman.f@example.com", course: "JEE Main + Advanced", message: "Fee structure for dropper batch?", date: "2026-10-03", status: "New" },
  { id: "e2", name: "Nazreen Bano", phone: "+91 97119 30002", email: "nazreen.b@example.com", course: "NEET-UG", message: "Demo class timing on Saturday?", date: "2026-10-02", status: "Contacted" },
  { id: "e3", name: "Owais Raza", phone: "+91 97119 30003", email: "owais.r@example.com", course: "AMU Entrance", message: "Hostel facility nearby?", date: "2026-10-01", status: "Converted" },
  { id: "e4", name: "Shabana Khatoon", phone: "+91 97119 30004", email: "shabana.k@example.com", course: "Foundation (IX–X)", message: "Transport from Abul Fazal?", date: "2026-09-30", status: "Closed" },
  { id: "e5", name: "Faizan Ahmad", phone: "+91 97119 30005", email: "faizan.a@example.com", course: "Jamia Entrance (JMI)", message: "Syllabus for class IX entrance?", date: "2026-09-29", status: "New" },
];

export const DEMO_NOTIFICATIONS: AdminNotification[] = [
  { id: "n1", title: "Mock on Sunday", message: "JEE Main Mock 14 starts 10 AM. Reach 30 min early.", audience: "JEE 2027-A", date: "2026-10-03", status: "Sent" },
  { id: "n2", title: "Fee reminder", message: "October fee due by Oct 7. Ignore if paid.", audience: "All students", date: "2026-10-02", status: "Sent" },
  { id: "n3", title: "Parent-teacher meet", message: "PTM on Oct 11, 11 AM at Shaheen Bagh centre.", audience: "Foundation X", date: "2026-10-04", status: "Scheduled" },
];
