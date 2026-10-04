// Student testimonials (mock/demo — clearly labelled in UI).

export interface Testimonial {
  id: string;
  studentName: string;
  course: string;
  photo: string;
  testimonial: string;
  achievement: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "t1",
    studentName: "Demo Student — JEE",
    course: "JEE Main + Advanced",
    photo: "",
    testimonial: "Weekly mocks and 1:1 mentor reviews fixed my Physics rotation chapter in a month. The DPP discipline here is unmatched. (Demo testimonial — replace with verified student quotes.)",
    achievement: "Demo • 99+ percentile (Physics)",
  },
  {
    id: "t2",
    studentName: "Demo Student — NEET",
    course: "NEET-UG",
    photo: "",
    testimonial: "NCERT drills plus assertion-reason sets made Biology my strongest subject. Doubt lounge till 8 PM genuinely helped before tests. (Demo testimonial.)",
    achievement: "Demo • 360/360 (Biology)",
  },
  {
    id: "t3",
    studentName: "Demo Student — AMU XI",
    course: "AMU Entrance",
    photo: "",
    testimonial: "AMU-pattern mocks matched the real paper closely. Speed techniques saved me at least 15 minutes. (Demo testimonial.)",
    achievement: "Demo • Selected (Science)",
  },
  {
    id: "t4",
    studentName: "Demo Parent — Jamia",
    course: "Jamia Entrance (JMI)",
    photo: "",
    testimonial: "Monthly parent reports meant we always knew exactly where our child stood. Honest counselling, no false promises. (Demo testimonial.)",
    achievement: "Demo • Selected (JMI School)",
  },
];
