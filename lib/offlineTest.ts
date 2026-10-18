// Phase 20 — Offline Test Support
// IndexedDB for storing answers offline, Service Worker sync when online

interface OfflineAnswer {
  testId: string;
  attemptId: string;
  studentId: string;
  answers: Record<string, string | null>;
  marked: string[];
  currentQuestionIndex: number;
  timestamp: number;
  synced: boolean;
}

interface OfflineTestPaper {
  testId: string;
  paper: {
    id: string;
    questionText: string;
    options: { display: string; text: string | null }[];
    marks: number;
    negativeMarks: number;
  }[];
  duration: number;
  timestamp: number;
}

const DB_NAME = "neuron-offline";
const DB_VERSION = 1;
const ANSWERS_STORE = "offline-answers";
const PAPERS_STORE = "offline-papers";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(ANSWERS_STORE)) {
        const store = db.createObjectStore(ANSWERS_STORE, { keyPath: "attemptId" });
        store.createIndex("testId", "testId", { unique: false });
        store.createIndex("studentId", "studentId", { unique: false });
        store.createIndex("synced", "synced", { unique: false });
      }
      if (!db.objectStoreNames.contains(PAPERS_STORE)) {
        db.createObjectStore(PAPERS_STORE, { keyPath: "testId" });
      }
    };
  });
}

/** Save answers locally for offline use */
export async function saveOfflineAnswers(data: Omit<OfflineAnswer, "synced" | "timestamp">): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ANSWERS_STORE, "readwrite");
    const store = tx.objectStore(ANSWERS_STORE);
    const payload: OfflineAnswer = { ...data, synced: false, timestamp: Date.now() };
    const request = store.put(payload);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/** Get offline answers for an attempt */
export async function getOfflineAnswers(attemptId: string): Promise<OfflineAnswer | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ANSWERS_STORE, "readonly");
    const store = tx.objectStore(ANSWERS_STORE);
    const request = store.get(attemptId);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

/** Get all unsynced answers for a student */
export async function getUnsyncedAnswers(studentId: string): Promise<OfflineAnswer[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ANSWERS_STORE, "readonly");
    const store = tx.objectStore(ANSWERS_STORE);
    const index = store.index("synced");
    const request = index.getAll(false);
    request.onsuccess = () => {
      const results = request.result.filter((a) => a.studentId === studentId);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

/** Mark answers as synced */
export async function markAnswersSynced(attemptId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ANSWERS_STORE, "readwrite");
    const store = tx.objectStore(ANSWERS_STORE);
    const request = store.get(attemptId);
    request.onsuccess = () => {
      const data = request.result;
      if (data) {
        data.synced = true;
        const putRequest = store.put(data);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/** Save test paper for offline access */
export async function saveOfflinePaper(data: OfflineTestPaper): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PAPERS_STORE, "readwrite");
    const store = tx.objectStore(PAPERS_STORE);
    const request = store.put(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/** Get offline test paper */
export async function getOfflinePaper(testId: string): Promise<OfflineTestPaper | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PAPERS_STORE, "readonly");
    const store = tx.objectStore(PAPERS_STORE);
    const request = store.get(testId);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

/** Clear old offline data (older than 7 days) */
export async function clearOldOfflineData(): Promise<void> {
  const db = await openDB();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return new Promise((resolve, reject) => {
    const tx = db.transaction([ANSWERS_STORE, PAPERS_STORE], "readwrite");
    let completed = 0;
    const checkDone = () => { completed++; if (completed === 2) resolve(); };

    const answersTx = tx.objectStore(ANSWERS_STORE);
    const answersIndex = answersTx.index("timestamp");
    const answersRequest = answersIndex.openCursor(IDBKeyRange.upperBound(weekAgo));
    answersRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    answersRequest.onerror = () => reject(answersRequest.error);
    answersTx.transaction.oncomplete = checkDone;

    const papersTx = tx.objectStore(PAPERS_STORE);
    const papersIndex = papersTx.index("timestamp");
    const papersRequest = papersIndex.openCursor(IDBKeyRange.upperBound(weekAgo));
    papersRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    papersRequest.onerror = () => reject(papersRequest.error);
    papersTx.transaction.oncomplete = checkDone;
  });
}

/** Check if we're online */
export function isOnline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine;
}

/** Listen for online/offline events */
export function onOnlineChange(callback: (online: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback(navigator.onLine);
  window.addEventListener("online", handler);
  window.addEventListener("offline", handler);
  return () => {
    window.removeEventListener("online", handler);
    window.removeEventListener("offline", handler);
  };
}