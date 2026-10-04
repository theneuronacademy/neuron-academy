// Faculty directory (public-safe fields only — no student data here).

export interface FacultyMember {
  id: string;
  name: string;
  designation: string;
  subject: string;
  qualification: string;
  experience: string;
  intro: string;
  image: string;
  profileUrl: string;
}

export const FACULTY: FacultyMember[] = [
  {
    id: "f1",
    name: "Demo Faculty — Physics",
    designation: "Senior Faculty",
    subject: "Physics",
    qualification: "M.Sc Physics (Demo — replace with actual profile)",
    experience: "10+ years (demo)",
    intro: "Concept-first physics with numerical drills for JEE / NEET / entrances. Replace with actual faculty bio.",
    image: "/images/faculty-f1.jpg",
    profileUrl: "#faculty",
  },
  {
    id: "f2",
    name: "Demo Faculty — Chemistry",
    designation: "Senior Faculty",
    subject: "Chemistry",
    qualification: "M.Sc Chemistry (Demo — replace with actual profile)",
    experience: "9+ years (demo)",
    intro: "Reaction maps, NCERT drills and PYQ marathons. Replace with actual faculty bio.",
    image: "/images/faculty-f2.jpg",
    profileUrl: "#faculty",
  },
  {
    id: "f3",
    name: "Demo Faculty — Mathematics",
    designation: "Senior Faculty",
    subject: "Mathematics",
    qualification: "M.Sc, B.Ed (Demo — replace with actual profile)",
    experience: "10+ years (demo)",
    intro: "Structured problem solving with DPPs and weekly revision. Replace with actual faculty bio.",
    image: "/images/faculty-f3.jpg",
    profileUrl: "#faculty",
  },
  {
    id: "f4",
    name: "Demo Faculty — Biology",
    designation: "Senior Faculty",
    subject: "Biology",
    qualification: "M.Sc Zoology (Demo — replace with actual profile)",
    experience: "8+ years (demo)",
    intro: "NCERT-line Biology with diagram drills and assertion-reason practice for NEET.",
    image: "/images/faculty-f4.jpg",
    profileUrl: "#faculty",
  },
];
