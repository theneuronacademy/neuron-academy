// FAQ content (editable mock data — only claims supported by academy info).

export interface Faq {
  id: string;
  question: string;
  answer: string;
}

export const FAQS: Faq[] = [
  {
    id: "enrol",
    question: "How do I enrol at Neuron Academy?",
    answer: "Fill the enquiry form, visit us in Shaheen Bagh, or message us on WhatsApp. Our counsellor will schedule a free demo class and a diagnostic test, then confirm your batch.",
  },
  {
    id: "courses",
    question: "What courses are available?",
    answer: "JEE Main + Advanced, NEET-UG, AMU Entrance, Jamia (JMI) Entrance and a Foundation track for Classes IX–X. Each track lists its subjects, duration and mode on this page.",
  },
  {
    id: "batches",
    question: "How do batches work?",
    answer: "Batches are small and entrance-focused, with morning, evening, weekend and online options. Batch timings for the current admission cycle are shared during counselling.",
  },
  {
    id: "tests",
    question: "Are tests conducted regularly?",
    answer: "Yes — weekly mock tests with ranks and solutions, chapter-wise tests, daily PYQ drills and a digital test app with instant analysis.",
  },
  {
    id: "contact",
    question: "How can I contact the academy?",
    answer: "Call or WhatsApp us, email hello@neuronacademy.in, or use the enquiry form. We are open Mon–Sat, 8:00 AM – 8:00 PM.",
  },
  {
    id: "location",
    question: "Where is the academy located?",
    answer: "Neuron Academy, Shaheen Bagh, New Delhi — 110025. Visit the Contact section for details and the map.",
  },
];
