/** Topic pages behind the homepage WHY cards ("A focused learning
 * experience") and the STEADY RHYTHM / learning-approach step cards. Each
 * topic gets its own static route at /topics/[slug]. Content is marketing
 * copy only — public-safe, no student data. */

export interface Topic {
  slug: string;
  eyebrow: string;
  title: string;
  lead: string;
  paragraphs: string[];
  bullets: string[];
  closing: string;
}

const WHY_TOPICS: Topic[] = [
  {
    slug: "entrance-focused-courses",
    eyebrow: "WHY NEURON ACADEMY",
    title: "Entrance-focused courses",
    lead: "Study pathways built around JEE, NEET, AMU and Jamia entrance patterns — not generic syllabus coverage.",
    paragraphs: [
      "Every course at Neuron Academy is designed backwards from the entrance test you are preparing for. Chapters are sequenced by exam weightage, practice sets mirror the actual paper style, and revision cycles are timed against the real admission calendar.",
      "You are never studying in the dark. From the first week you know which chapters matter most for your target exam, how quickly you must finish the syllabus, and when the full-length revision blocks begin.",
    ],
    bullets: [
      "Dedicated pathways for JEE, NEET, AMU and Jamia entrances.",
      "Chapter sequencing follows exam weightage and past papers.",
      "Practice material matches the question style of each entrance.",
      "Revision and mock-test cycles timed to the admission calendar.",
      "Foundation support alongside entrance preparation.",
      "Counselling that maps your goal to the right course.",
    ],
    closing: "Visit our courses page to find the pathway that matches your target entrance.",
  },
  {
    slug: "small-batches",
    eyebrow: "WHY NEURON ACADEMY",
    title: "Small batches",
    lead: "A focused classroom environment where there is room to ask questions and get personal guidance.",
    paragraphs: [
      "Large batches hide struggling students; small batches reveal them early. Our classrooms are kept deliberately compact so teachers can track every student's pace, notice hesitation, and adjust the lesson while it is still happening.",
      "In a small batch, humour and questions are welcome. No one gets lost at the back, and personal guidance is part of the routine — not a separate remedial programme.",
    ],
    bullets: [
      "Compact batch sizes with individual attention.",
      "Teachers track attendance, pace and concepts per student.",
      "Doubts resolved within the class flow.",
      "Mentors check in on each learner's preparation plan.",
      "Peer groups stay supportive and exam-focused.",
      "Families receive honest updates about readiness.",
    ],
    closing: "Fees and batch details are shared personally during counselling — reach us on WhatsApp or the enquiry form.",
  },
  {
    slug: "regular-mock-tests",
    eyebrow: "WHY NEURON ACADEMY",
    title: "Regular mock tests",
    lead: "Practice with exam-style papers and review your performance thoroughly after every test.",
    paragraphs: [
      "Entrance exams reward people who have already made their mistakes in practice. Regular mocks — weekly and full-length — build speed, accuracy and calm under the clock.",
      "After each test, the work continues: solution review, error-pattern analysis and a revised study plan. Discussion sessions convert every mock from a score into a set of concrete next steps.",
    ],
    bullets: [
      "Weekly chapter tests alongside full-length mocks.",
      "Real exam-style question papers and timing.",
      "Solution discussion after every test.",
      "Error-pattern tracking across attempts.",
      "Ranking and percentile context within the batch.",
      "Structured feedback feeding into the next study plan.",
    ],
    closing: "See how assessment works with the online practice tools on our student platform.",
  },
  {
    slug: "doubt-support",
    eyebrow: "WHY NEURON ACADEMY",
    title: "Doubt support",
    lead: "Bring your questions to your mentors and work through concepts together — inside and outside class.",
    paragraphs: [
      "Doubts are information. A question you cannot answer today tells your teacher exactly what to teach tomorrow. Our mentors keep an open door: classroom doubt rounds, one-to-one sessions, and patient explanations until the concept clicks.",
      "The learning process is built so that doubts feed back into class — records of difficult topics shape the revision schedule and the next practice set.",
    ],
    bullets: [
      "Classroom doubt rounds after every concept block.",
      "One-to-one sessions with subject mentors.",
      "Honestly — no question is too basic to ask.",
      "Repeating difficult chapters in revision cycles.",
      "WhatsApp channels for quick clarifications.",
      "Doubt patterns guide the next mock-test design.",
    ],
    closing: "Students also use the doubt-sending feature inside the student platform after login.",
  },
  {
    slug: "progress-tracking",
    eyebrow: "WHY NEURON ACADEMY",
    title: "Progress tracking",
    lead: "Students and families can follow academic activity, attendance and performance in one place.",
    paragraphs: [
      "Preparation is a long campaign; you need honest instruments, not vibes. Attendance, homework completion, mock scores and concept maps are logged continuously, so every family conversation is grounded in real data.",
      "Mentors hold periodic review meetings where the data shapes an adjusted study plan — extra hours in Physics, a tighter revision loop in Maths, or a smarter rest schedule before a mock.",
    ],
    bullets: [
      "Attendance and homework logged per batch.",
      "Mock-test scorecards with trends over time.",
      "Concept-wise report cards, not just totals.",
      "Periodic mentor review meetings with parents.",
      "Data-driven study-plan adjustments.",
      "Honest reporting — strengths and gaps alike.",
    ],
    closing: "Records appear on the student platform after login; ask our team for a walkthrough during counselling.",
  },
  {
    slug: "digital-practice-tools",
    eyebrow: "WHY NEURON ACADEMY",
    title: "Digital practice tools",
    lead: "Use online tests, question banks and performance review from the student platform.",
    paragraphs: [
      "The academy pairs classroom teaching with a digital study companion. On the student platform you can take assigned online tests, practise entire question banks by subject or chapter, and review solutions with explanations — all tied to your batch.",
      "Because your practice lives in one system, mentors can see your effort and design the right challenge for the coming week.",
    ],
    bullets: [
      "Assigned online tests published per batch.",
      "Question banks for self-practice by subject.",
      "Results and rankings right after submission.",
      "Question-wise review with complete solutions.",
      "Notifications for every important deadline.",
      "The same tools faculty use to track progress.",
    ],
    closing: "Log in at estudde.com or ask us to show the platform during your visit.",
  },
];

const STEP_TOPICS: Topic[] = [
  {
    slug: "learn",
    eyebrow: "LEARNING APPROACH",
    title: "Learn",
    lead: "Build real understanding of core concepts with your teachers — the first step of our steady rhythm.",
    paragraphs: [
      "Every week starts with focused teaching. Concepts are developed live on the board with plenty of examples, so you understand why a formula works instead of memorising it. Notes are structured for later revision.",
      "The teaching follows the sequence of your target entrance, so every concept you learn lands exactly where the exam will ask it.",
    ],
    bullets: [
      "Concept-first teaching with worked examples.",
      "Structured notes designed for later revision.",
      "Sequence aligned with your target entrance.",
      "Classroom interaction and immediate clarifications.",
      "Weekly recap of the concepts taught so far.",
      "Foundation concepts that never get skipped.",
    ],
    closing: "This is step one of five — next comes focused Practice.",
  },
  {
    slug: "practice",
    eyebrow: "LEARNING APPROACH",
    title: "Practice",
    lead: "Strengthen every concept with focused question practice — the second step of our steady rhythm.",
    paragraphs: [
      "Right after concepts are taught, practice follows: graded question sets from easy to exam-level, so confidence meets challenge every week. Solutions are discussed in class to cement the reasoning, not just the answer.",
      "Practice volume is planned, not random — the mentor tracks how much you solve and where accuracy dips, then tunes the next set.",
    ],
    bullets: [
      "Graded question sheets after each concept.",
      "Difficulty ramps from basic to exam level.",
      "Solution walkthroughs in class.",
      "Accuracy tracked across every set you solve.",
      "Attempt history logged on the student platform.",
      "Practice volume increases as the syllabus deepens.",
    ],
    closing: "Once practice feels natural, it is time to Test under real conditions.",
  },
  {
    slug: "test",
    eyebrow: "LEARNING APPROACH",
    title: "Test",
    lead: "Apply your learning in exam-style assessments — the third step of our steady rhythm.",
    paragraphs: [
      "Weekly chapter tests and periodic full-length mocks simulate the pressure and pattern of the real entrance — same timing, same marking scheme, honest invigilation.",
      "Testing is where practice meets scrutiny. Every paper you write adds a reliable data point: which concepts are exam-ready, which need another pass before the next test.",
    ],
    bullets: [
      "Weekly chapter tests plus full-length mocks.",
      "Real entrance timing and marking scheme.",
      "Results and rankings published speedily.",
      "Performance review after every paper.",
      "Attempt strategy shared and refined with mentors.",
      "Progress tools keep records on the platform.",
    ],
    closing: "A test without a Review is a wasted opportunity — see the fourth step.",
  },
  {
    slug: "review",
    eyebrow: "LEARNING APPROACH",
    title: "Review",
    lead: "Review every answer and identify topics to revisit — the fourth step of our steady rhythm.",
    paragraphs: [
      "After every test there is a serious review session: correct answers get pushed deeper, and every mistake gets a reason — concept gap, haste, or a careless pattern that keeps repeating.",
      "Your mentor keeps a running error map for each student, so the revision cycle ahead is specific: which three chapters, which question types, in what order.",
    ],
    bullets: [
      "Solution discussion after every test.",
      "Error map of recurring preparation leaks.",
      "Concept gaps routed back into Learn.",
      "Detection and repair of guesswork patterns.",
      "Topic-level targets set for the next cycle.",
      "Everything documented on the platform.",
    ],
    closing: "With the gaps clear, the next step is Improve.",
  },
  {
    slug: "improve",
    eyebrow: "LEARNING APPROACH",
    title: "Improve",
    lead: "Plan the next step with guidance from your mentors — the fifth step of our steady rhythm.",
    paragraphs: [
      "Improvement is a cycle, not a hope. With your review data on the table, mentors set a precise plan for the coming week: what to relearn, what to practise faster, and where to stop stretching into new territory.",
      "The rhythm repeats — Learn, Practise, Test, Review, Improve — until the exam day feels like just another Sunday mock.",
    ],
    bullets: [
      "Weekly plan built from review data.",
      "Mentor sign-offs after each cycle.",
      "Targeted relearning of weak concepts.",
      "Speed and accuracy goals per subject.",
      "Progress tracked week over week.",
      "Same rhythm until exam week arrives.",
    ],
    closing: "Begin the cycle with us — explore our Courses, connect with our team, and start your rhythm.",
  },
];

export const TOPICS: Topic[] = [...WHY_TOPICS, ...STEP_TOPICS];

export function getTopicBySlug(slug: string): Topic | undefined {
  return TOPICS.find((t) => t.slug === slug);
}
