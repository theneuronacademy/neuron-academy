// Course catalogue. Categories are configurable — the Courses section
// renders filter pills from COURSE_CATEGORIES automatically.

export interface Course {
  id: string;
  name: string;
  category: string;
  desc: string;
  target: string;
  duration: string;
  mode: string;
  faculty: string;
  imageLabel: string;
  image: string;
  accent: string;
  badge: string;
  subjects: string[];
  highlights: string[];
  admissionOpen: boolean;
}

export const COURSE_CATEGORIES = ["Engineering", "Medical", "University Entrance", "Foundation"] as const;

// Single source for enquiry-form "interested in" options (audit fix #7):
// the coaching catalogue below (course names actually offered) plus the school
// tuition classes the academy teaches (Classes 1–12; see the faq classes
// entry). Keep every website form dropdown driven from here so the option
// lists can never drift apart again.
export const COURSE_INTEREST_CLASSES: string[] = [
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11",
  "Class 12",
  "Dropper",
];

export const COURSES: Course[] = [
  {
    id: "jee",
    name: "JEE Main + Advanced",
    category: "Engineering",
    desc: "Physics, Chemistry and Maths with DPPs, PYQ marathons, revision cycles and rank-focused mentoring.",
    target: "Class 11–12 • Droppers",
    duration: "2 years",
    mode: "Offline + Online",
    faculty: "IIT / NIT Alumni Mentors",
    imageLabel: "JEE Track",
    image: "/images/course-jee.jpg",
    accent: "#1AA6B5",
    badge: "Flagship",
    subjects: ["Physics", "Chemistry", "Maths"],
    highlights: ["Daily Practice Problems", "PYQ marathons", "All-India style mocks", "1:1 mentor reviews"],
    admissionOpen: true,
  },
  {
    id: "neet",
    name: "NEET-UG",
    category: "Medical",
    desc: "NCERT-line Biology with Physics + Chemistry numerical drills, assertion-reason practice and mock ladders.",
    target: "Class 11–12 • Droppers",
    duration: "2 years",
    mode: "Offline + Online",
    faculty: "Medical Faculty Team",
    imageLabel: "NEET Track",
    image: "/images/course-neet.jpg",
    accent: "#16A34A",
    badge: "High Demand",
    subjects: ["Physics", "Chemistry", "Biology"],
    highlights: ["NCERT mastery drills", "Assertion-reason sets", "Chapter-wise tests", "Doubt lounge access"],
    admissionOpen: true,
  },
  {
    id: "amu",
    name: "AMU Entrance",
    category: "University Entrance",
    desc: "Class XI Science / Diploma / B.Sc. entrance track — science, maths, reasoning and English with AMU-pattern mocks.",
    target: "Class 9–11 aspirants",
    duration: "1 year",
    mode: "Offline + Online",
    faculty: "AMU Alumni Mentors",
    imageLabel: "AMU Track",
    image: "/images/course-amu.jpg",
    accent: "#D97706",
    badge: "Specialised",
    subjects: ["Science", "Maths", "Reasoning", "English"],
    highlights: ["AMU-pattern mocks", "Previous paper analysis", "Speed techniques", "Interview guidance"],
    admissionOpen: true,
  },
  {
    id: "jamia",
    name: "Jamia Entrance (JMI)",
    category: "University Entrance",
    desc: "Jamia schools (IX / XI) and UG entrance preparation — complete syllabus coverage with JMI-pattern test series.",
    target: "Class 9–12 aspirants",
    duration: "1 year",
    mode: "Offline + Online",
    faculty: "JMI Alumni Mentors",
    imageLabel: "Jamia Track",
    image: "/images/course-jamia.jpg",
    accent: "#B4453D",
    badge: "Specialised",
    subjects: ["Science", "Maths", "English", "GK"],
    highlights: ["JMI-pattern test series", "Syllabus completion plan", "Revision bootcamps", "Counselling support"],
    admissionOpen: true,
  },
  {
    id: "foundation",
    name: "Foundation (IX–X)",
    category: "Foundation",
    desc: "Science + Maths foundation with NTSE / Olympiad orientation — built for future JEE / NEET / entrance success.",
    target: "Class 9–10",
    duration: "1–2 years",
    mode: "Offline + Online",
    faculty: "Foundation Team",
    imageLabel: "Foundation Track",
    image: "/images/course-foundation.jpg",
    accent: "#24466D",
    badge: "Foundation",
    subjects: ["Science", "Maths", "Mental Ability"],
    highlights: ["Concept-first classes", "Olympiad / NTSE sets", "Study habits coaching", "Parent reports"],
    admissionOpen: true,
  },
];
