// Phase 21 — Student Test Bookmarks Panel
// "Revise Later" bookmarks across tests

"use client";

import { useEffect, useState } from "react";
import { Bookmark, X, BookOpen, ArrowRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

interface BookmarkItem {
  id: string;
  testId: string;
  testTitle: string;
  questionId: string;
  questionText: string;
  note?: string;
  createdAt: string;
}

export function BookmarkPanel({ onClose }: { onClose?: () => void }) {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookmarks = async () => {
    try {
      const res = await fetch("/api/bookmarks", { cache: "no-store" });
      const json = await res.json();
      if (json.success && json.data) {
        setBookmarks(json.data);
      } else {
        setError(json.error ?? "Failed to load bookmarks");
      }
    } catch {
      setError("Failed to load bookmarks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookmarks(); }, []);

  const handleRemove = async (id: string) => {
    try {
      const res = await fetch(`/api/bookmarks/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setBookmarks((b) => b.filter((b) => b.id !== id));
      }
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card animate-pulse">
        <div className="h-6 w-1/4 bg-silver-200 rounded mb-4" />
        <div className="space-y-3">
          <div className="h-10 bg-silver-200 rounded" />
          <div className="h-10 bg-silver-200 rounded" />
          <div className="h-10 bg-silver-200 rounded" />
        </div>
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-silver-300 bg-white p-8 text-center">
        <Bookmark className="mx-auto h-12 w-12 text-muted" />
        <p className="mt-3 text-lg font-extrabold text-navy-700">No Bookmarks Yet</p>
        <p className="mt-1 text-sm text-muted">Mark questions during tests to revisit them here.</p>
      </div>
    );
  }

  // Group by test
  const byTest = bookmarks.reduce((acc, b) => {
    if (!acc[b.testId]) acc[b.testId] = { title: b.testTitle, items: [] };
    acc[b.testId].items.push(b);
    return acc;
  }, {} as Record<string, { title: string; items: BookmarkItem[] }>);

  return (
    <div className="rounded-card border border-silver-200 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-silver-200 px-5 py-4">
        <div className="flex items-center gap-2">
          <Bookmark className="h-5 w-5 text-teal-600" />
          <h3 className="text-lg font-extrabold text-navy-700">Revise Later ({bookmarks.length})</h3>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        )}
      </div>

      {error && (
        <div className="border-t border-silver-200 px-5 py-3 text-sm font-bold text-crimson">{error}</div>
      )}

      <div className="divide-y divide-silver-100">
        {Object.entries(byTest).map(([testId, group]) => (
          <div key={testId} className="p-4">
            <p className="mb-3 text-sm font-extrabold text-navy-700 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-teal-600" />
              {group.title} ({group.items.length})
            </p>
            <div className="space-y-2">
              {group.items.map((b) => (
                <div key={b.id} className="flex items-start gap-3 rounded-xl border border-silver-200 p-3 hover:bg-silver-50 transition">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-navy-700 line-clamp-2">{b.questionText}</p>
                    {b.note && <p className="mt-1 text-[12px] text-muted italic">"{b.note}"</p>}
                    <p className="mt-1 text-[11px] text-muted">Added {new Date(b.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { /* TODO: navigate to test review */ }}
                      className="text-teal-600 hover:bg-teal-50"
                      title="Open in test review"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(b.id)}
                      className="text-muted hover:text-crimson hover:bg-crimson-50"
                      title="Remove bookmark"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}