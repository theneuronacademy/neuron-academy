// FAQ content (editable mock data — only claims supported by academy info).

export interface Faq {
  id: string;
  question: string;
  answer: string;
}

export const FAQS: Faq[] = [
  {
    id: "classes",
    question: "Which classes does Neuron Academy teach?",
    answer: "We offer classes from Class 1 through Class 12.",
  },
  {
    id: "subjects",
    question: "Which subjects are available?",
    answer: "We provide support across school subjects, including Mathematics, Science, English, Social Studies and other subjects according to class and availability.",
  },
  {
    id: "jee",
    question: "Do you offer JEE preparation?",
    answer: "Yes, we offer JEE preparation. Contact the academy for course details and batch availability.",
  },
  {
    id: "neet",
    question: "Do you offer NEET or medical entrance preparation?",
    answer: "We offer medical entrance preparation. Contact the academy to confirm the available courses and batches.",
  },
  {
    id: "commerce",
    question: "Do you teach Commerce students?",
    answer: "We provide Commerce subject support. Ask the academy about the subjects and classes currently available.",
  },
  {
    id: "arts",
    question: "Do you teach Arts or Humanities subjects?",
    answer: "Contact the academy to discuss available Arts and Humanities subjects for your class.",
  },
  {
    id: "school-exams",
    question: "Can students get help with school exams?",
    answer: "Yes, students can enquire about school subject support and exam preparation for their class.",
  },
  {
    id: "all-subjects",
    question: "Are classes available for all school subjects?",
    answer: "We support multiple school subjects. Availability depends on the class, subject and current timetable.",
  },
  {
    id: "admission",
    question: "How can I enquire about admission?",
    answer: "Call the academy, send a WhatsApp message, or email us using the contact details on the website.",
  },
  {
    id: "fees",
    question: "How can I find out about fees and batches?",
    answer: "Contact the academy directly for current fees, schedules and batch availability.",
  },
  {
    id: "hours",
    question: "What are the academy's opening hours?",
    answer: "The academy is open Monday through Saturday, from 8:00 AM to 10:30 PM.",
  },
  {
    id: "location",
    question: "Where is Neuron Academy located?",
    answer: "FA-23, near Shaheen Masjid, Shaheen Bagh, Jamia Nagar, New Delhi — 110025.",
  },
];
