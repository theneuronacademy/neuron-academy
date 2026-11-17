// FAQ content. Only facts the academy has published elsewhere on the site
// (courses, contact details, hours, ticker).

import { CONTACT } from "@/data/contact";

export interface Faq {
  id: string;
  question: string;
  answer: string;
}

export const FAQS: Faq[] = [
  {
    id: "classes",
    question: "Which classes does Neuron Academy teach?",
    answer: "Classes 6 to 12. Class 5 students can also join our batch for the Class 6 entrance at JMI, AMU and CM SHRI schools.",
  },
  {
    id: "entrance",
    question: "Which school entrances do you prepare for?",
    answer: "JMI (Jamia), AMU and CM SHRI, for admission to Class 6, Class 9 and Class 11. Each has its own batch, and there is also a separate entrance test series.",
  },
  {
    id: "subjects",
    question: "Which subjects are taught?",
    answer: "Mathematics, Science, English and Social Science in the school batches; Physics, Chemistry, Biology and Mathematics for NEET and JEE; and Commerce subjects. Ask us which subjects run in your child's batch.",
  },
  {
    id: "school-exams",
    question: "Do you help with school and board exams?",
    answer: "Yes. Our school batches follow the NCERT and CBSE syllabus, and the Class 10 batch prepares students for the CBSE board exam.",
  },
  {
    id: "neet-jee",
    question: "Do you offer NEET and JEE preparation?",
    answer: "Yes. Both are two-year programmes for students in Class 11 and 12.",
  },
  {
    id: "tests",
    question: "How often are tests held?",
    answer: "There is a mock test every week, and students can bring their questions to the doubt lounge, which stays open till 8 PM.",
  },
  {
    id: "fees",
    question: "What are the fees, and when do batches start?",
    answer: `Fees and start dates depend on the batch. Call or WhatsApp ${CONTACT.phone} and we will tell you the current fee and timings.`,
  },
  {
    id: "admission",
    question: "How do I take admission?",
    answer: `Visit the academy, call or WhatsApp ${CONTACT.phone}, or send the enquiry form on this page. You can also ask for a free demo class first.`,
  },
  {
    id: "hours",
    question: "When is the academy open?",
    answer: "Monday to Saturday, 8:00 AM to 10:30 PM.",
  },
  {
    id: "location",
    question: "Where is Neuron Academy?",
    answer: "FA-23, near Shaheen Masjid, Shaheen Bagh, Jamia Nagar, New Delhi 110025.",
  },
];
