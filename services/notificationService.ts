// Notification helpers — student panel reads these; push providers later.
import { getNotifications, markNotificationRead, saveNotification, uid, nowISO } from "@/lib/storage";

export function notifyTestPublished(testName: string, testId: string): void {
  saveNotification({
    id: uid("notif"),
    title: "New Test Available",
    message: `${testName} is now available.`,
    type: "test",
    target: "students",
    testId,
    createdAt: nowISO(),
    read: false,
  });
}

export function notifyResultPublished(testName: string, testId: string): void {
  saveNotification({
    id: uid("notif"),
    title: "Result Published",
    message: `Your result for ${testName} is ready.`,
    type: "result",
    target: "students",
    testId,
    createdAt: nowISO(),
    read: false,
  });
}

export { getNotifications, markNotificationRead };
