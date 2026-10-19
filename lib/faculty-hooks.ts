// Faculty React Query Hooks - Centralized data fetching with caching
// Uses @tanstack/react-query for server state management

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from "@tanstack/react-query";
import * as api from "@/lib/faculty-api";
import type {
  BatchDetail,
  StudentRow,
  TestRow,
  ResultRow,
  AnalyticsRow,
  DashboardStats,
  FacultyProfile,
  DoubtItem,
  NotificationItem,
  TimetableEntry,
  MaterialItem,
  AssignmentItem,
  SubmissionItem,
  GradebookConfig,
  GradebookEntry,
  ParentMessage,
  CreateTestPayload,
  BulkAttendanceRequest,
  Category,
  AnnouncementPayload,
} from "@/types/faculty";

// ============ Query Keys ============
export const facultyKeys = {
  all: ["faculty"] as const,
  batches: () => [...facultyKeys.all, "batches"] as const,
  batch: (id: string) => [...facultyKeys.batches(), "detail", id] as const,
  students: (params?: { batchId?: string; search?: string }) =>
    [...facultyKeys.all, "students", params] as const,
  student: (id: string) => [...facultyKeys.all, "students", "detail", id] as const,
  attendance: (batchId: string, date: string) =>
    [...facultyKeys.all, "attendance", batchId, date] as const,
  attendanceHistory: (batchId: string, studentId: string, month: string) =>
    [...facultyKeys.all, "attendance", "history", batchId, studentId, month] as const,
  tests: () => [...facultyKeys.all, "tests"] as const,
  test: (id: string) => [...facultyKeys.tests(), "detail", id] as const,
  testAnalysis: (id: string) => [...facultyKeys.test(id), "analysis"] as const,
  results: (testId?: string) => [...facultyKeys.all, "results", testId] as const,
  analytics: () => [...facultyKeys.all, "analytics"] as const,
  dashboard: () => [...facultyKeys.all, "dashboard"] as const,
  activity: (limit?: number) => [...facultyKeys.all, "activity", limit] as const,
  profile: () => [...facultyKeys.all, "profile"] as const,
  doubts: (status?: string) => [...facultyKeys.all, "doubts", status] as const,
  notifications: (limit?: number) => [...facultyKeys.all, "notifications", limit] as const,
  announcements: () => [...facultyKeys.all, "announcements"] as const,
  timetable: () => [...facultyKeys.all, "timetable"] as const,
  materials: (batchId?: string) => [...facultyKeys.all, "materials", batchId] as const,
  assignments: (batchId?: string) => [...facultyKeys.all, "assignments", batchId] as const,
  assignmentSubmissions: (assignmentId: string) =>
    [...facultyKeys.assignments(), "submissions", assignmentId] as const,
  gradebookConfig: (batchId: string) => [...facultyKeys.all, "gradebook", batchId, "config"] as const,
  gradebook: (batchId: string) => [...facultyKeys.all, "gradebook", batchId] as const,
  parentMessages: (studentId?: string) =>
    [...facultyKeys.all, "parent-messages", studentId] as const,
};

// ============ Batches ============
export function useFacultyBatches(options?: UseQueryOptions<BatchDetail[]>): ReturnType<typeof useQuery<BatchDetail[]>> {
  return useQuery({
    queryKey: facultyKeys.batches(),
    queryFn: api.getFacultyBatches,
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...options,
  });
}

export function useFacultyBatch(id: string, options?: UseQueryOptions<BatchDetail | null>): ReturnType<typeof useQuery<BatchDetail | null>> {
  return useQuery({
    queryKey: facultyKeys.batch(id),
    queryFn: () => api.getFacultyBatch(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}

// ============ Students ============
export function useFacultyStudents(
  params: { batchId?: string; search?: string } = {},
  options?: UseQueryOptions<StudentRow[]>
): ReturnType<typeof useQuery<StudentRow[]>> {
  return useQuery({
    queryKey: facultyKeys.students(params),
    queryFn: () => api.getFacultyStudents(params),
    staleTime: 1000 * 60 * 2,
    ...options,
  });
}

export function useFacultyStudent(
  id: string,
  options?: UseQueryOptions<ReturnType<typeof api.getFacultyStudent>>
): ReturnType<typeof useQuery<ReturnType<typeof api.getFacultyStudent>>> {
  return useQuery({
    queryKey: facultyKeys.student(id),
    queryFn: () => api.getFacultyStudent(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
    ...options,
  });
}

// ============ Attendance ============
export function useAttendance(
  batchId: string,
  date: string,
  options?: UseQueryOptions<Awaited<ReturnType<typeof api.getAttendance>>>
): ReturnType<typeof useQuery<Awaited<ReturnType<typeof api.getAttendance>>>> {
  return useQuery({
    queryKey: facultyKeys.attendance(batchId, date),
    queryFn: () => api.getAttendance(batchId, date),
    enabled: !!batchId && !!date,
    staleTime: 1000 * 30, // 30 seconds for active marking
    ...options,
  });
}

export function useAttendanceHistory(
  batchId: string,
  studentId: string,
  month: string,
  options?: UseQueryOptions<ReturnType<typeof api.getAttendanceHistory>>
): ReturnType<typeof useQuery<ReturnType<typeof api.getAttendanceHistory>>> {
  return useQuery({
    queryKey: facultyKeys.attendanceHistory(batchId, studentId, month),
    queryFn: () => api.getAttendanceHistory(batchId, studentId, month),
    enabled: !!batchId && !!studentId && !!month,
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}

export function useBulkSaveAttendance(
  options?: UseMutationOptions<{ saved: number }, Error, BulkAttendanceRequest>
): ReturnType<typeof useMutation<{ saved: number }, Error, BulkAttendanceRequest>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.bulkSaveAttendance,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: facultyKeys.attendance(variables.batchId, variables.date) });
      queryClient.invalidateQueries({ queryKey: facultyKeys.analytics() });
      queryClient.invalidateQueries({ queryKey: facultyKeys.dashboard() });
    },
    ...options,
  });
}

// ============ Tests ============
export function useFacultyTests(options?: UseQueryOptions<TestRow[]>): ReturnType<typeof useQuery<TestRow[]>> {
  return useQuery({
    queryKey: facultyKeys.tests(),
    queryFn: api.getFacultyTests,
    staleTime: 1000 * 60 * 2,
    ...options,
  });
}

export function useCreateTest(
  options?: UseMutationOptions<TestRow, Error, CreateTestPayload>
): ReturnType<typeof useMutation<TestRow, Error, CreateTestPayload>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createFacultyTest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: facultyKeys.tests() });
      queryClient.invalidateQueries({ queryKey: facultyKeys.dashboard() });
    },
    ...options,
  });
}

export function useUpdateTest(
  options?: UseMutationOptions<TestRow, Error, { id: string; payload: Partial<CreateTestPayload> }>
): ReturnType<typeof useMutation<TestRow, Error, { id: string; payload: Partial<CreateTestPayload> }>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => api.updateFacultyTest(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: facultyKeys.tests() });
      queryClient.invalidateQueries({ queryKey: facultyKeys.test(variables.id) });
    },
    ...options,
  });
}

export function useDeleteTest(
  options?: UseMutationOptions<void, Error, string>
): ReturnType<typeof useMutation<void, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteFacultyTest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: facultyKeys.tests() });
      queryClient.invalidateQueries({ queryKey: facultyKeys.dashboard() });
    },
    ...options,
  });
}

export function useTestAnalysis(
  testId: string,
  options?: UseQueryOptions<ReturnType<typeof api.getTestAnalysis>>
): ReturnType<typeof useQuery<ReturnType<typeof api.getTestAnalysis>>> {
  return useQuery({
    queryKey: facultyKeys.testAnalysis(testId),
    queryFn: () => api.getTestAnalysis(testId),
    enabled: !!testId,
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}

// ============ Results ============
export function useFacultyResults(
  testId?: string,
  options?: UseQueryOptions<ResultRow[]>
): ReturnType<typeof useQuery<ResultRow[]>> {
  return useQuery({
    queryKey: facultyKeys.results(testId),
    queryFn: () => api.getFacultyResults(testId),
    staleTime: 1000 * 60 * 2,
    ...options,
  });
}

// ============ Analytics ============
export function useFacultyAnalytics(
  options?: UseQueryOptions<Awaited<ReturnType<typeof api.getFacultyAnalytics>>>
): ReturnType<typeof useQuery<Awaited<ReturnType<typeof api.getFacultyAnalytics>>>> {
  return useQuery({
    queryKey: facultyKeys.analytics(),
    queryFn: api.getFacultyAnalytics,
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}

// ============ Dashboard ============
export function useDashboardStats(
  options?: UseQueryOptions<DashboardStats>
): ReturnType<typeof useQuery<DashboardStats>> {
  return useQuery({
    queryKey: facultyKeys.dashboard(),
    queryFn: api.getDashboardStats,
    staleTime: 1000 * 60 * 2,
    ...options,
  });
}

export function useFacultyActivity(
  limit = 20,
  options?: UseQueryOptions<Awaited<ReturnType<typeof api.getFacultyActivity>>>
): ReturnType<typeof useQuery<Awaited<ReturnType<typeof api.getFacultyActivity>>>> {
  return useQuery({
    queryKey: facultyKeys.activity(limit),
    queryFn: () => api.getFacultyActivity(limit),
    staleTime: 1000 * 60 * 2,
    ...options,
  });
}

// ============ Profile ============
export function useFacultyProfile(
  options?: UseQueryOptions<FacultyProfile>
): ReturnType<typeof useQuery<FacultyProfile>> {
  return useQuery({
    queryKey: facultyKeys.profile(),
    queryFn: api.getFacultyProfile,
    staleTime: 1000 * 60 * 10,
    ...options,
  });
}

export function useUpdateFacultyProfile(
  options?: UseMutationOptions<FacultyProfile, Error, Partial<FacultyProfile>>
): ReturnType<typeof useMutation<FacultyProfile, Error, Partial<FacultyProfile>>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.updateFacultyProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: facultyKeys.profile() });
    },
    ...options,
  });
}

// ============ Doubts ============
export function useFacultyDoubts(
  status?: string,
  options?: UseQueryOptions<DoubtItem[]>
): ReturnType<typeof useQuery<DoubtItem[]>> {
  return useQuery({
    queryKey: facultyKeys.doubts(status),
    queryFn: () => api.getFacultyDoubts(status),
    staleTime: 1000 * 60 * 1,
    refetchInterval: 1000 * 30, // Poll for new doubts
    ...options,
  });
}

export function useReplyToDoubt(
  options?: UseMutationOptions<void, Error, { doubtId: string; text: string }>
): ReturnType<typeof useMutation<void, Error, { doubtId: string; text: string }>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ doubtId, text }) => api.replyToDoubt(doubtId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: facultyKeys.doubts() });
    },
    ...options,
  });
}

// ============ Notifications ============
export function useFacultyNotifications(
  limit = 50,
  options?: UseQueryOptions<Awaited<ReturnType<typeof api.getFacultyNotifications>>>
): ReturnType<typeof useQuery<Awaited<ReturnType<typeof api.getFacultyNotifications>>>> {
  return useQuery({
    queryKey: facultyKeys.notifications(limit),
    queryFn: () => api.getFacultyNotifications(limit),
    staleTime: 1000 * 60 * 1,
    refetchInterval: 1000 * 60, // Poll for new notifications
    ...options,
  });
}

export function useMarkNotificationRead(
  options?: UseMutationOptions<void, Error, string>
): ReturnType<typeof useMutation<void, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: facultyKeys.notifications() });
    },
    ...options,
  });
}

export function useMarkAllNotificationsRead(
  options?: UseMutationOptions<void, Error, void>
): ReturnType<typeof useMutation<void, Error, void>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: facultyKeys.notifications() });
    },
    ...options,
  });
}

export function useCreateAnnouncement(
  options?: UseMutationOptions<void, Error, AnnouncementPayload>
): ReturnType<typeof useMutation<void, Error, AnnouncementPayload>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: facultyKeys.announcements() });
      queryClient.invalidateQueries({ queryKey: facultyKeys.notifications() });
    },
    ...options,
  });
}

export function useFacultyAnnouncements(
  options?: UseQueryOptions<ReturnType<typeof api.getFacultyAnnouncements>>
): ReturnType<typeof useQuery<ReturnType<typeof api.getFacultyAnnouncements>>> {
  return useQuery({
    queryKey: facultyKeys.announcements(),
    queryFn: api.getFacultyAnnouncements,
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}

// ============ Timetable ============
export function useFacultyTimetable(
  options?: UseQueryOptions<TimetableEntry[]>
): ReturnType<typeof useQuery<TimetableEntry[]>> {
  return useQuery({
    queryKey: facultyKeys.timetable(),
    queryFn: api.getFacultyTimetable,
    staleTime: 1000 * 60 * 10,
    ...options,
  });
}

// ============ Materials ============
export function useFacultyMaterials(
  batchId?: string,
  options?: UseQueryOptions<MaterialItem[]>
): ReturnType<typeof useQuery<MaterialItem[]>> {
  return useQuery({
    queryKey: facultyKeys.materials(batchId),
    queryFn: () => api.getFacultyMaterials(batchId),
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}

export function useCreateMaterial(
  options?: UseMutationOptions<MaterialItem, Error, Omit<MaterialItem, "id" | "createdAt" | "updatedAt">>
): ReturnType<typeof useMutation<MaterialItem, Error, Omit<MaterialItem, "id" | "createdAt" | "updatedAt">>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createMaterial,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: facultyKeys.materials(variables.batchId) });
    },
    ...options,
  });
}

export function useUpdateMaterial(
  options?: UseMutationOptions<MaterialItem, Error, { id: string; payload: Partial<MaterialItem> }>
): ReturnType<typeof useMutation<MaterialItem, Error, { id: string; payload: Partial<MaterialItem> }>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => api.updateMaterial(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: facultyKeys.materials() });
    },
    ...options,
  });
}

export function useDeleteMaterial(
  options?: UseMutationOptions<void, Error, string>
): ReturnType<typeof useMutation<void, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteMaterial,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: facultyKeys.materials() });
    },
    ...options,
  });
}

// ============ Assignments ============
export function useFacultyAssignments(
  batchId?: string,
  options?: UseQueryOptions<AssignmentItem[]>
): ReturnType<typeof useQuery<AssignmentItem[]>> {
  return useQuery({
    queryKey: facultyKeys.assignments(batchId),
    queryFn: () => api.getFacultyAssignments(batchId),
    staleTime: 1000 * 60 * 2,
    ...options,
  });
}

export function useCreateAssignment(
  options?: UseMutationOptions<AssignmentItem, Error, Omit<AssignmentItem, "id" | "createdAt" | "updatedAt">>
): ReturnType<typeof useMutation<AssignmentItem, Error, Omit<AssignmentItem, "id" | "createdAt" | "updatedAt">>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createAssignment,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: facultyKeys.assignments(variables.batchId) });
    },
    ...options,
  });
}

export function useAssignmentSubmissions(
  assignmentId: string,
  options?: UseQueryOptions<SubmissionItem[]>
): ReturnType<typeof useQuery<SubmissionItem[]>> {
  return useQuery({
    queryKey: facultyKeys.assignmentSubmissions(assignmentId),
    queryFn: () => api.getAssignmentSubmissions(assignmentId),
    enabled: !!assignmentId,
    staleTime: 1000 * 60 * 1,
    ...options,
  });
}

export function useGradeSubmission(
  options?: UseMutationOptions<void, Error, { submissionId: string; marks: number; feedback: string }>
): ReturnType<typeof useMutation<void, Error, { submissionId: string; marks: number; feedback: string }>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, marks, feedback }) => api.gradeSubmission(submissionId, marks, feedback),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: facultyKeys.assignmentSubmissions(variables.submissionId.split("/")[0] || "") });
      queryClient.invalidateQueries({ queryKey: facultyKeys.gradebook("") });
    },
    ...options,
  });
}

// ============ Gradebook ============
export function useGradebookConfig(
  batchId: string,
  options?: UseQueryOptions<GradebookConfig | null>
): ReturnType<typeof useQuery<GradebookConfig | null>> {
  return useQuery({
    queryKey: facultyKeys.gradebookConfig(batchId),
    queryFn: () => api.getGradebookConfig(batchId),
    enabled: !!batchId,
    staleTime: 1000 * 60 * 10,
    ...options,
  });
}

export function useSaveGradebookConfig(
  options?: UseMutationOptions<GradebookConfig, Error, GradebookConfig>
): ReturnType<typeof useMutation<GradebookConfig, Error, GradebookConfig>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.saveGradebookConfig,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: facultyKeys.gradebookConfig(variables.batchId) });
      queryClient.invalidateQueries({ queryKey: facultyKeys.gradebook(variables.batchId) });
    },
    ...options,
  });
}

export function useGradebook(
  batchId: string,
  options?: UseQueryOptions<{ entries: GradebookEntry[]; categories: Category[] }>
): ReturnType<typeof useQuery<{ entries: GradebookEntry[]; categories: Category[] }>> {
  return useQuery({
    queryKey: facultyKeys.gradebook(batchId),
    queryFn: () => api.getGradebook(batchId),
    enabled: !!batchId,
    staleTime: 1000 * 60 * 2,
    ...options,
  });
}

export function useExportGradebook(
  options?: UseMutationOptions<Blob, Error, { batchId: string; format: "csv" | "pdf" }>
): ReturnType<typeof useMutation<Blob, Error, { batchId: string; format: "csv" | "pdf" }>> {
  return useMutation({
    mutationFn: ({ batchId, format }) => api.exportGradebook(batchId, format),
    ...options,
  });
}

// ============ Parent Communication ============
export function useParentMessages(
  studentId?: string,
  options?: UseQueryOptions<ParentMessage[]>
): ReturnType<typeof useQuery<ParentMessage[]>> {
  return useQuery({
    queryKey: facultyKeys.parentMessages(studentId),
    queryFn: () => api.getParentMessages(studentId),
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}

export function useSendParentMessage(
  options?: UseMutationOptions<void, Error, { studentId: string; subject: string; message: string; channel: "SMS" | "EMAIL" | "IN_APP" }>
): ReturnType<typeof useMutation<void, Error, { studentId: string; subject: string; message: string; channel: "SMS" | "EMAIL" | "IN_APP" }>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.sendParentMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: facultyKeys.parentMessages() });
    },
    ...options,
  });
}

export function useSendBulkParentReport(
  options?: UseMutationOptions<void, Error, { batchId: string; template: string }>
): ReturnType<typeof useMutation<void, Error, { batchId: string; template: string }>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables) => api.sendBulkParentReport(variables.batchId, variables.template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: facultyKeys.parentMessages() });
    },
    ...options,
  });
}