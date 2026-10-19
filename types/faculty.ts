// Faculty Module Types - Centralized type definitions

export interface BatchDetail {
  id: string;
  name: string;
  course: string;
  studentCount: number;
  startDate: string;
  endDate: string;
  status: string;
}

export interface StudentRow {
  id: string;
  studentId: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  batchId: string | null;
  batch: string;
  attendancePct: number | null;
  testsTaken: number;
  avgScore: number | null;
  studentType?: string;
  parentName?: string | null;
  parentMobile?: string | null;
}

export interface AttendanceRecord {
  studentId: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE";
  source?: "MANUAL" | "BIOMETRIC";
  checkIn?: string;
  checkOut?: string;
  date: string;
}

export interface TestRow {
  id: string;
  title: string;
  batch: string;
  batchId: string | null;
  status: string;
  type: string;
  totalMarks: number;
  startTime: string | null;
  duration: number;
  accessType: string;
  price: number;
  isHomework: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResultRow {
  id: string;
  testId: string;
  testTitle: string;
  studentId: string;
  studentName: string;
  marks: number;
  totalMarks: number;
  percentage: number;
  date: string;
  rank?: number;
  attempted: number;
  correct: number;
  wrong: number;
  unanswered: number;
}

export interface AnalyticsRow {
  id: string;
  name: string;
  batch: string;
  batchId: string;
  attendancePct: number | null;
  testsTaken: number;
  avgScore: number | null;
}

export interface AssignmentItem {
  id: string;
  title: string;
  description: string;
  batchId: string;
  batch?: string;
  dueDate: string;
  maxMarks: number;
  weight: number;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  createdAt: string;
  testId?: string;
  test?: { title: string } | null;
}

export interface DashboardStats {
  totalBatches: number;
  totalStudents: number;
  upcomingTests: number;
  pendingEvaluations: number;
  attendanceRate: number | null;
}

export interface FacultyProfile {
  id: string;
  facultyId: string;
  name: string;
  email: string;
  phone: string;
  subject: string | null;
  qualification: string | null;
  experience: string | null;
  bio: string | null;
  designation: string;
  status: string;
  batches: Array<{ id: string; name: string }>;
}

export interface DoubtItem {
  id: string;
  subject: string | null;
  questionText: string;
  status: "ASKED" | "ANSWERED" | "CLOSED";
  createdAt: string;
  student: { name: string; id: string };
  batch: { name: string; id: string } | null;
  replies: Array<{
    id: string;
    authorRole: string;
    authorName: string;
    text: string;
    createdAt: string;
  }>;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  testId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface MaterialItem {
  id: string;
  title: string;
  subject: string;
  className?: string | null;
  kind: "NOTE" | "VIDEO" | "LINK" | "PDF";
  url?: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
  batchId: string;
  batch?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  weight: number;
  color: string;
}

export interface GradebookEntry {
  studentId: string;
  studentName: string;
  categoryScores: Record<string, number>;
  finalGrade: number;
  letterGrade: string;
}

export interface GradebookConfig {
  batchId: string;
  categories: Category[];
}

export interface SubmissionItem {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  submittedAt: string;
  content?: string;
  fileUrl?: string;
  marks?: number;
  feedback?: string;
  status: "SUBMITTED" | "GRADED" | "LATE";
}

export interface ParentMessage {
  id: string;
  studentId: string;
  studentName?: string;
  parentName?: string;
  subject: string;
  message: string;
  channel: string;
  status: string;
  sentAt: string;
}

export interface CreateTestPayload {
  title: string;
  batchId?: string;
  type?: "LIVE" | "OFFLINE" | "PRACTICE";
  duration?: number;
  totalMarks?: number;
  startTime?: string;
  endTime?: string;
  isHomework?: boolean;
  accessType?: "FREE" | "PAID" | "PRIVATE";
  price?: number;
}

export interface BulkAttendanceRequest {
  batchId: string;
  date: string;
  records: Array<{ studentId: string; status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE" }>;
  source?: "MANUAL" | "BIOMETRIC";
}

export interface AnnouncementPayload {
  batchId: string;
  title: string;
  message: string;
}

export interface TimetableEntry {
  id: string;
  subject: string;
  title: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  batch?: { name: string; id: string } | null;
  faculty?: { name: string; id: string } | null;
}

export interface UpcomingTest {
  id: string;
  title: string;
  batch: string;
  date: string;
  time: string;
  status: string;
}

export interface ActivityItem {
  id: string;
  text: string;
  time: string;
  type: string;
}