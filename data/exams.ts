// Exam landing pages (/coaching/[slug]).
//
// Two kinds of statement appear here and they are kept apart on purpose:
//  - `about`: facts about the examination itself. Only what the conducting
//    body publishes and that stays true year to year; anything that changes
//    annually (dates, seats, pattern, fees) is left to the official site.
//  - everything else: what Neuron Academy offers, taken from the academy's
//    own published course descriptions.

export interface ExamProgramme {
  name: string;
  /** Slug of the matching course page (/courses/[slug]). */
  courseSlug: string;
  forWhom: string;
  points: string[];
}

export interface ExamPage {
  slug: string;
  /** Short label for links and chips. */
  label: string;
  eyebrow: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  lead: string;
  aboutHeading: string;
  about: string[];
  official: { label: string; url: string };
  programmes: ExamProgramme[];
  approach: string[];
  faqs: { question: string; answer: string }[];
  /** Name used in the "not affiliated" note. */
  conductedBy: string;
}

const ADDRESS = "FA-23, near Shaheen Masjid, Shaheen Bagh, Jamia Nagar, New Delhi 110025";

const ACE_6: ExamProgramme = {
  name: "NEURON ENTRANCE ACE – Class 6",
  courseSlug: "neuron-entrance-ace-class-06",
  forWhom: "For students currently in Class 5",
  points: [
    "Complete Class 5 NCERT-based syllabus",
    "Mathematics, Science, English and Social Science",
    "General Knowledge, Mental Ability and Logical Reasoning",
    "Weekly tests, worksheets and assignments",
  ],
};

const ACE_9: ExamProgramme = {
  name: "NEURON ENTRANCE ACE – Class 9",
  courseSlug: "neuron-entrance-ace-class-09",
  forWhom: "For students currently in Class 8",
  points: [
    "Complete Class 8 CBSE/NCERT syllabus",
    "Mathematics, Science, English and Social Science",
    "General Knowledge, Mental Ability and Logical Reasoning",
    "Regular tests, mock examinations and previous years' questions",
  ],
};

const ACE_11: ExamProgramme = {
  name: "NEURON ENTRANCE ACE – Class 11",
  courseSlug: "neuron-entrance-ace-class-11",
  forWhom: "For students currently in Class 10",
  points: [
    "Complete Class 10 NCERT syllabus coverage",
    "Integrated board and entrance preparation",
    "Concept-based teaching in Science and Mathematics",
    "Entrance-oriented MCQs, previous years' questions and mock tests",
  ],
};

const TEST_SERIES: ExamProgramme = {
  name: "NEURON ENTRANCE ACE – Test Series",
  courseSlug: "neuron-entrance-ace-test-series",
  forWhom: "For Class 6, 9 and 11 entrance aspirants",
  points: [
    "A structured 6-month test series",
    "Topic-wise, part-syllabus and full-length mock tests",
    "Exam-pattern-based practice papers and previous years' questions",
    "Performance analysis after each test",
  ],
};

const ENTRANCE_APPROACH = [
  "School syllabus and entrance preparation taught together, so neither is neglected.",
  "NCERT-based concept teaching before any shortcut or trick.",
  "Entrance-oriented MCQs and practice worksheets for every chapter.",
  "Previous years' questions and regular mock tests.",
  "Doubt-clearing sessions and individual performance guidance.",
  "Classes available offline at Shaheen Bagh and online.",
];

function entranceFaqs(exam: string, official: string): { question: string; answer: string }[] {
  return [
    {
      question: `Which classes do you prepare for the ${exam} entrance?`,
      answer: `Our NEURON ENTRANCE ACE programmes prepare students seeking admission to Classes 6, 9 and 11. A separate 6-month test series is available for all three.`,
    },
    {
      question: "When should my child join?",
      answer: "Each programme runs for one academic year and is taken in the class before the admission year: Class 5 students join the Class 6 programme, Class 8 students join the Class 9 programme, and Class 10 students join the Class 11 programme.",
    },
    {
      question: "Will my child's school studies suffer?",
      answer: "No. The programmes are integrated: they cover the current class's NCERT syllabus and add entrance-oriented practice on top of it.",
    },
    {
      question: "Are classes offline or online?",
      answer: `The Entrance Ace programmes run in both modes. Offline classes are held at ${ADDRESS}.`,
    },
    {
      question: `Where can I find the official ${exam} dates, syllabus and application form?`,
      answer: `Only on the official website: ${official}. Dates, seats, eligibility and the test pattern are announced there each year and can change, so please confirm them at the source.`,
    },
    {
      question: "Does joining guarantee admission?",
      answer: "No coaching can guarantee admission. Selection depends on the student's performance in the test and on the institution's own rules. We provide teaching, practice and honest feedback.",
    },
  ];
}

export const EXAM_PAGES: ExamPage[] = [
  {
    slug: "jmi-entrance",
    label: "JMI Entrance",
    eyebrow: "JAMIA SCHOOL ENTRANCE",
    title: "JMI Entrance Coaching in Shaheen Bagh",
    metaTitle: "JMI Entrance Coaching in Shaheen Bagh (Class 6, 9 & 11)",
    metaDescription:
      "Coaching for the Jamia Millia Islamia (JMI) school entrance test for Classes 6, 9 and 11 at Neuron Academy, Shaheen Bagh, New Delhi. NCERT-based teaching, mock tests and previous years' questions.",
    lead: "Preparation for the Jamia Millia Islamia school entrance test for Classes 6, 9 and 11, at Shaheen Bagh in Jamia Nagar, New Delhi.",
    aboutHeading: "About the JMI school entrance test",
    about: [
      "Jamia Millia Islamia admits students to its schools in Classes VI, IX and XI through an entrance test.",
      "According to the Jamia schools' prospectus, the entrance test syllabus follows the CBSE curriculum.",
      "Applications are made online on Jamia's admission portal. The prospectus for each year gives the dates, seats, eligibility and the test pattern.",
    ],
    official: { label: "admission.jmi.ac.in", url: "https://admission.jmi.ac.in" },
    programmes: [ACE_6, ACE_9, ACE_11, TEST_SERIES],
    approach: ENTRANCE_APPROACH,
    faqs: entranceFaqs("JMI", "admission.jmi.ac.in"),
    conductedBy: "Jamia Millia Islamia",
  },
  {
    slug: "amu-entrance",
    label: "AMU Entrance",
    eyebrow: "AMU SCHOOL ENTRANCE",
    title: "AMU Entrance Coaching in Shaheen Bagh",
    metaTitle: "AMU Entrance Coaching in Delhi (Class 6, 9 & 11)",
    metaDescription:
      "Coaching for the Aligarh Muslim University (AMU) school admission test at Neuron Academy, Shaheen Bagh, New Delhi. NCERT-based teaching, entrance-oriented practice, mock tests and previous years' questions.",
    lead: "Preparation in Delhi for the Aligarh Muslim University school admission test, alongside the student's regular school syllabus.",
    aboutHeading: "About the AMU school admission test",
    about: [
      "Aligarh Muslim University admits students to its schools in Classes VI and IX through an admission test conducted by the university's Controller of Examinations.",
      "The Guide to Admissions published by the university each year gives the dates, eligibility, test centres and the test pattern, including the arrangements for Class XI.",
    ],
    official: { label: "amucontrollerexams.com", url: "https://www.amucontrollerexams.com" },
    programmes: [ACE_6, ACE_9, ACE_11, TEST_SERIES],
    approach: ENTRANCE_APPROACH,
    faqs: entranceFaqs("AMU", "amucontrollerexams.com"),
    conductedBy: "Aligarh Muslim University",
  },
  {
    slug: "cm-shri-entrance",
    label: "CM SHRI",
    eyebrow: "CM SHRI SCHOOLS ADMISSION TEST",
    title: "CM SHRI Entrance Coaching in Shaheen Bagh",
    metaTitle: "CM SHRI School Entrance Coaching in Delhi (Class 6, 9 & 11)",
    metaDescription:
      "Coaching for the CM SHRI Schools admission test for Classes 6, 9 and 11 at Neuron Academy, Shaheen Bagh, New Delhi. NCERT-based teaching, objective practice papers and mock tests.",
    lead: "Preparation for the Delhi government's CM SHRI Schools admission test for Classes 6, 9 and 11.",
    aboutHeading: "About the CM SHRI admission test",
    about: [
      "CM SHRI Schools are run by the Directorate of Education, Government of NCT of Delhi. Admission to Classes 6, 9 and 11 is through an admission test.",
      "The Directorate publishes the circular for each year with the eligibility conditions, syllabus, dates and application process. Please read the eligibility conditions carefully before applying.",
    ],
    official: { label: "edudel.nic.in", url: "https://www.edudel.nic.in" },
    programmes: [ACE_6, ACE_9, ACE_11, TEST_SERIES],
    approach: ENTRANCE_APPROACH,
    faqs: entranceFaqs("CM SHRI", "edudel.nic.in"),
    conductedBy: "the Directorate of Education, Delhi",
  },
  {
    slug: "class-10-cbse",
    label: "Class 10 CBSE",
    eyebrow: "CBSE BOARD EXAMINATION",
    title: "Class 10 CBSE Coaching in Shaheen Bagh",
    metaTitle: "Class 10 CBSE Coaching in Shaheen Bagh (Maths, Science, SST, English)",
    metaDescription:
      "Class 10 CBSE board exam coaching at Neuron Academy, Shaheen Bagh, New Delhi: Mathematics, Science, Social Science and English with NCERT-based teaching, PYQs, sample papers and pre-board practice.",
    lead: "A full-year programme for the CBSE Class 10 board examination: Mathematics, Science, Social Science and English.",
    aboutHeading: "About the Class 10 board examination",
    about: [
      "The Class 10 board examination is conducted by the Central Board of Secondary Education (CBSE). NCERT textbooks are the base for preparation.",
      "CBSE publishes the syllabus, sample question papers and marking schemes for each session on its academic website. Students should always work from the current session's documents.",
    ],
    official: { label: "cbseacademic.nic.in", url: "https://cbseacademic.nic.in" },
    programmes: [
      {
        name: "NEURON VICTORY BATCH – Class 10",
        courseSlug: "neuron-victory-batch-class-10",
        forWhom: "For students in Class 10",
        points: [
          "Complete CBSE Class 10 syllabus coverage",
          "Mathematics, Science, Social Science and English",
          "Chapter-wise notes, worksheets and assignments",
          "Board and pre-board examination practice",
        ],
      },
      {
        name: "NEURON AAGAZ BATCH – Class 9",
        courseSlug: "neuron-aagaz-batch-class-09",
        forWhom: "For students in Class 9, to build the base for Class 10",
        points: ["A structured academic programme to strengthen concepts before the board year"],
      },
    ],
    approach: [
      "NCERT-based conceptual teaching in every subject.",
      "Chapter-wise notes, worksheets and assignments.",
      "Regular tests and full-syllabus assessments.",
      "Previous years' questions, competency-based questions and sample papers.",
      "Board and pre-board examination practice.",
      "Dedicated doubt-clearing sessions and individual performance guidance.",
    ],
    faqs: [
      {
        question: "Which subjects are covered in the Class 10 programme?",
        answer: "Mathematics, Science, Social Science and English, covering the complete CBSE Class 10 syllabus.",
      },
      {
        question: "Is the teaching based on NCERT?",
        answer: "Yes. Teaching is NCERT-based, supported by chapter-wise notes, worksheets, previous years' questions, competency-based questions and sample papers.",
      },
      {
        question: "Are classes offline or online?",
        answer: `The Class 10 programme runs offline and online. Offline classes are held at ${ADDRESS}.`,
      },
      {
        question: "How is my child's progress checked?",
        answer: "Through regular tests, full-syllabus assessments and pre-board practice, followed by individual performance analysis and guidance.",
      },
      {
        question: "Where can I find the official CBSE syllabus and sample papers?",
        answer: "On CBSE's academic website, cbseacademic.nic.in. Always use the documents for the current session.",
      },
      {
        question: "Do you guarantee a particular percentage?",
        answer: "No. Results depend on the student's own work through the year. We provide structured teaching, practice and honest feedback.",
      },
    ],
    conductedBy: "the Central Board of Secondary Education",
  },
  {
    slug: "neet",
    label: "NEET",
    eyebrow: "MEDICAL ENTRANCE",
    title: "NEET Coaching in Shaheen Bagh",
    metaTitle: "NEET Coaching in Shaheen Bagh, Delhi (Two-Year Programme)",
    metaDescription:
      "NEET-UG coaching at Neuron Academy, Shaheen Bagh, New Delhi: a two-year integrated programme in Physics, Chemistry and Biology with NCERT-focused teaching, chapter-wise tests, mock exams and PYQs.",
    lead: "A two-year integrated programme for NEET-UG in Physics, Chemistry and Biology, built on NCERT.",
    aboutHeading: "About NEET (UG)",
    about: [
      "NEET (UG) is the national entrance examination for admission to undergraduate medical courses in India. It is conducted by the National Testing Agency (NTA).",
      "The examination tests Physics, Chemistry and Biology. The information bulletin published for each year gives the syllabus, eligibility, dates and the paper pattern.",
    ],
    official: { label: "neet.nta.nic.in", url: "https://neet.nta.nic.in" },
    programmes: [
      {
        name: "NEET – Two-Year Integrated Programme",
        courseSlug: "neet",
        forWhom: "For students entering Class 11",
        points: [
          "Complete Physics, Chemistry and Biology syllabus",
          "NCERT-focused, concept-oriented teaching",
          "Chapter-wise tests and full-length mock exams",
          "Previous years' questions, practice assignments and question banks",
        ],
      },
    ],
    approach: [
      "NCERT-focused teaching in Physics, Chemistry and Biology.",
      "Concepts first, then graded practice from assignments and question banks.",
      "Chapter-wise tests through the year and full-length mock exams.",
      "Previous years' questions worked into every chapter.",
      "Dedicated doubt-clearing sessions.",
      "Regular performance analysis and individual guidance.",
    ],
    faqs: [
      {
        question: "Who is the NEET programme for?",
        answer: "It is a two-year integrated programme, designed to be taken through Classes 11 and 12.",
      },
      {
        question: "Which subjects are covered?",
        answer: "Physics, Chemistry and Biology, covering the complete syllabus with NCERT as the base.",
      },
      {
        question: "Are classes offline or online?",
        answer: `The NEET programme is held offline at ${ADDRESS}.`,
      },
      {
        question: "How is progress checked?",
        answer: "Through chapter-wise tests and full-length mock exams, followed by performance analysis and individual guidance.",
      },
      {
        question: "Where can I find the official NEET syllabus, dates and application form?",
        answer: "On the National Testing Agency's NEET website, neet.nta.nic.in. Dates, eligibility and the paper pattern are announced there each year and can change, so please confirm them at the source.",
      },
      {
        question: "Does joining guarantee a medical seat?",
        answer: "No coaching can guarantee a seat. Selection depends on the student's performance in the examination and on the counselling rules. We provide teaching, practice and honest feedback.",
      },
    ],
    conductedBy: "the National Testing Agency",
  },
  {
    slug: "jee",
    label: "JEE",
    eyebrow: "ENGINEERING ENTRANCE",
    title: "JEE Main & Advanced Coaching in Shaheen Bagh",
    metaTitle: "JEE Main & Advanced Coaching in Shaheen Bagh, Delhi",
    metaDescription:
      "JEE Main and JEE Advanced coaching at Neuron Academy, Shaheen Bagh, New Delhi: a two-year integrated programme in Physics, Chemistry and Mathematics with chapter-wise tests, mock exams and PYQs.",
    lead: "A two-year integrated programme for JEE Main and JEE Advanced in Physics, Chemistry and Mathematics.",
    aboutHeading: "About JEE Main and JEE Advanced",
    about: [
      "JEE Main is conducted by the National Testing Agency (NTA). It is used for admission to NITs, IIITs and other engineering institutions, and to qualify for JEE Advanced.",
      "JEE Advanced is the entrance examination for the IITs. It is organised each year by one of the IITs.",
      "Both examinations test Physics, Chemistry and Mathematics. The information bulletin and brochure for each year give the syllabus, eligibility, dates and the paper pattern.",
    ],
    official: { label: "jeemain.nta.nic.in", url: "https://jeemain.nta.nic.in" },
    programmes: [
      {
        name: "JEE Main & Advanced – Two-Year Integrated Programme",
        courseSlug: "jee-main-and-advance",
        forWhom: "For students entering Class 11",
        points: [
          "Complete Physics, Chemistry and Mathematics syllabus",
          "Concept-based teaching from basic to advanced levels",
          "Chapter-wise tests and full-length mock exams",
          "Previous years' questions, advanced assignments and practice worksheets",
        ],
      },
    ],
    approach: [
      "NCERT fundamentals first, then advanced problem-solving.",
      "Concept-based teaching from basic to advanced levels in Physics, Chemistry and Mathematics.",
      "Advanced assignments and practice worksheets for every chapter.",
      "Chapter-wise tests, full-length mock exams and previous years' questions.",
      "Time-management and exam strategy practice.",
      "Regular doubt-clearing sessions, performance analysis and individual guidance.",
    ],
    faqs: [
      {
        question: "Who is the JEE programme for?",
        answer: "It is a two-year integrated programme, designed to be taken through Classes 11 and 12.",
      },
      {
        question: "Does the programme cover both JEE Main and JEE Advanced?",
        answer: "Yes. It prepares students for both, moving from NCERT fundamentals to advanced problem-solving in Physics, Chemistry and Mathematics.",
      },
      {
        question: "Are classes offline or online?",
        answer: `The JEE programme is held offline at ${ADDRESS}.`,
      },
      {
        question: "How is progress checked?",
        answer: "Through chapter-wise tests and full-length mock exams, followed by performance analysis and individual guidance.",
      },
      {
        question: "Where can I find the official JEE syllabus, dates and application forms?",
        answer: "For JEE Main, on the National Testing Agency's website, jeemain.nta.nic.in. For JEE Advanced, on jeeadv.ac.in. Dates, eligibility and paper patterns are announced there each year and can change.",
      },
      {
        question: "Does joining guarantee admission to an IIT or NIT?",
        answer: "No coaching can guarantee admission. Selection depends on the student's performance in the examinations and on the counselling rules. We provide teaching, practice and honest feedback.",
      },
    ],
    conductedBy: "the National Testing Agency or the IITs",
  },
];

export function getExamPage(slug: string): ExamPage | undefined {
  return EXAM_PAGES.find((e) => e.slug === slug);
}
