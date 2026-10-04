// Results / achievements (mock/demo — UI labels them DEMO until the
// academy provides verified selections).

export interface AcademyResult {
  id: string;
  name: string;
  score: string;
  tag: string;
  exam: string;
  year: string;
  color: string;
}

export const RESULTS: AcademyResult[] = [
  { id: "r1", name: "Demo Topper — JEE Main", score: "99.2 %ile", tag: "Physics 99+", exam: "JEE Main", year: "2026", color: "#1AA6B5" },
  { id: "r2", name: "Demo Topper — NEET", score: "685 / 720", tag: "Biology 360", exam: "NEET-UG", year: "2026", color: "#16A34A" },
  { id: "r3", name: "Demo Topper — AMU XI", score: "Selected", tag: "Science stream", exam: "AMU Entrance", year: "2026", color: "#D97706" },
  { id: "r4", name: "Demo Topper — JMI IX", score: "Selected", tag: "Jamia School", exam: "Jamia Entrance", year: "2026", color: "#B4453D" },
];
