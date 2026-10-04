"use client";

// First-run seed: 20 Percentage demo questions + 2 demo tests + welcome
// notification. Idempotent — only seeds when storage is empty. Never
// overwrites admin-created data. Advertisements are seeded separately by
// lib/mockStore.ts (untouched).

import { getAllAds } from "@/lib/mockStore";
import { getQuestions, getTests, nowISO, saveNotification, saveQuestions, saveTest } from "@/lib/storage";
import type { BankQuestion, TestItem } from "@/lib/testTypes";

const FLAG = "neuron_test_seeded_v1";

const Q = (
  n: number,
  question: string,
  options: [string, string, string, string],
  correctAnswer: number,
  explanation: string,
  difficulty: BankQuestion["difficulty"],
  chapter = "Percentage"
): BankQuestion => ({
  id: `demo-q-${String(n).padStart(2, "0")}`,
  question,
  options: [...options],
  correctAnswer,
  explanation,
  subject: "Quantitative Aptitude",
  chapter,
  difficulty,
  marks: 2,
  negativeMarks: 0.5,
  tags: ["percentage", "demo"],
  sourceFile: "demo-percentage-set.pdf",
  sourcePage: Math.ceil(n / 4),
  containsImage: false,
  imageUrl: "",
  confidence: 96,
  needsReview: false,
  status: "approved",
  createdAt: "2026-09-25T10:00:00.000Z",
  updatedAt: "2026-09-25T10:00:00.000Z",
});

const DEMO_QUESTIONS: BankQuestion[] = [
  Q(1, "What is 25% of 640?", ["120", "140", "160", "180"], 2, "25% = 1/4. 640 ÷ 4 = 160.", "Easy"),
  Q(2, "A number increased by 20% becomes 360. Find the original number.", ["280", "300", "320", "340"], 1, "120% = 360 → 100% = 360 × 100/120 = 300.", "Easy"),
  Q(3, "If 40% of a number is 96, what is 75% of the same number?", ["150", "165", "180", "195"], 2, "Number = 96 × 100/40 = 240. 75% of 240 = 180.", "Easy"),
  Q(4, "Price of sugar rises by 25%. By what % must consumption reduce to keep expense same?", ["15%", "20%", "22%", "25%"], 1, "Reduction = 25/125 × 100 = 20%.", "Medium"),
  Q(5, "A student scores 70% of 800 marks. How many marks did the student score?", ["540", "560", "580", "600"], 1, "0.70 × 800 = 560.", "Easy"),
  Q(6, "Two successive discounts of 10% and 20% equal a single discount of:", ["28%", "30%", "25%", "32%"], 0, "Single = 10 + 20 − (10×20)/100 = 28%.", "Medium"),
  Q(7, "If x is 30% more than y, then y is what % less than x?", ["23.07%", "30%", "25%", "21.5%"], 0, "Less % = 30/130 × 100 = 23.07%.", "Medium"),
  Q(8, "In an election, the winner gets 55% of 20,000 votes. How many votes did the winner get?", ["10,500", "11,000", "11,500", "12,000"], 1, "0.55 × 20,000 = 11,000.", "Easy"),
  Q(9, "A salary of ₹50,000 is reduced by 10% and then increased by 10%. Net change?", ["No change", "1% decrease", "1% increase", "2% decrease"], 1, "50,000 × 0.9 × 1.1 = 49,500 → 1% decrease.", "Medium"),
  Q(10, "What percent is 45 of 180?", ["20%", "22.5%", "25%", "30%"], 2, "45/180 × 100 = 25%.", "Easy"),
  Q(11, "Population of a town increases 5% yearly. From 40,000, population after 2 years?", ["44,000", "44,100", "44,200", "44,500"], 1, "40,000 × 1.05² = 44,100.", "Medium"),
  Q(12, "If 12.5% of a number is 37.5, the number is:", ["250", "300", "275", "325"], 1, "12.5% = 1/8 → number = 37.5 × 8 = 300.", "Easy"),
  Q(13, "A mixture has 30% alcohol. In 50 litres, how much alcohol?", ["12 L", "15 L", "18 L", "20 L"], 1, "0.30 × 50 = 15 litres.", "Easy"),
  Q(14, "Pass marks are 40%. A student scores 250/800. By how many marks did they fail?", ["50", "60", "70", "80"], 2, "Pass = 320. Failed by 320 − 250 = 70.", "Medium"),
  Q(15, "If length of a rectangle increases 20% and breadth decreases 20%, area changes by:", ["No change", "4% decrease", "4% increase", "2% decrease"], 1, "1.2 × 0.8 = 0.96 → 4% decrease.", "Hard"),
  Q(16, "A trader marks goods 40% above cost and gives 15% discount. Profit %?", ["19%", "21%", "25%", "17%"], 0, "1.4 × 0.85 = 1.19 → 19% profit.", "Hard"),
  Q(17, "72 is what % more than 60?", ["15%", "18%", "20%", "25%"], 2, "(72−60)/60 × 100 = 20%.", "Easy"),
  Q(18, "Fresh fruit is 80% water; dry fruit is 20% water. From 100 kg fresh, dry fruit obtained?", ["20 kg", "25 kg", "30 kg", "35 kg"], 1, "Pulp = 20 kg stays. Dry: 80% pulp → 20/0.8 = 25 kg.", "Hard"),
  Q(19, "In a class of 60, 45% are girls. Number of boys?", ["27", "30", "33", "36"], 2, "Boys = 55% of 60 = 33.", "Easy"),
  Q(20, "Compound effect: price rises 10% then falls 10%. Net change on ₹1,000?", ["No change", "₹10 loss", "₹20 loss", "₹10 gain"], 1, "1,000 × 1.1 × 0.9 = 990 → ₹10 loss (1%).", "Medium"),
];

export const DEMO_STUDENT = { id: "STU-1001", name: "Demo Student" };
export const DEMO_FACULTY = { id: "FAC-1001", name: "Demo Faculty" };

export function ensureSeeded(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(FLAG) === "done") {
      getAllAds(); // touch ads seed (mockStore self-seeds, untouched)
      return;
    }
    if (getQuestions().length === 0) saveQuestions(DEMO_QUESTIONS);
    if (getTests().length === 0) {
      const ten = DEMO_QUESTIONS.slice(0, 10).map((q) => q.id);
      const five = DEMO_QUESTIONS.slice(10, 15).map((q) => q.id);
      const t1: TestItem = {
        id: "demo-test-percentage-01",
        name: "Percentage Practice Test 01",
        description: "10 Percentage questions • auto-evaluated demo test.",
        subject: "Quantitative Aptitude",
        chapter: "Percentage",
        questionIds: ten,
        durationMinutes: 20,
        marksPerQuestion: 2,
        negativeMarks: 0.5,
        difficulty: "Mixed",
        status: "published",
        startAt: "",
        endAt: "",
        createdBy: "ADMIN-001",
        createdAt: nowISO(),
        updatedAt: nowISO(),
        source: "demo",
      };
      const t2: TestItem = {
        id: "demo-test-percentage-02",
        name: "Percentage Speed Drill (Draft)",
        description: "5-question speed drill — draft, publish to release to students.",
        subject: "Quantitative Aptitude",
        chapter: "Percentage",
        questionIds: five,
        durationMinutes: 10,
        marksPerQuestion: 2,
        negativeMarks: 0,
        difficulty: "Mixed",
        status: "draft",
        startAt: "",
        endAt: "",
        createdBy: "ADMIN-001",
        createdAt: nowISO(),
        updatedAt: nowISO(),
        source: "demo",
      };
      saveTest(t1);
      saveTest(t2);
      saveNotification({
        id: `notif-${Date.now().toString(36)}`,
        title: "New Test Available",
        message: "Percentage Practice Test 01 is now available.",
        type: "test",
        target: "students",
        testId: "demo-test-percentage-01",
        createdAt: nowISO(),
        read: false,
      });
    }
    getAllAds();
    window.localStorage.setItem(FLAG, "done");
  } catch {
    /* ignore */
  }
}
