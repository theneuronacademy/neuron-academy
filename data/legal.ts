// Text of the Privacy Policy and Terms of Use pages.
// Written from how this website actually works (the forms it has and the
// services it runs on). Review with the academy before relying on it.

import { CONTACT } from "@/data/contact";

export interface LegalSection {
  heading: string;
  /** Sentence shown before the bullet list. */
  lead?: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalDoc {
  slug: "privacy-policy" | "terms" | "refund-policy";
  title: string;
  description: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

const CONTACT_LINE = `Neuron Academy, ${CONTACT.address}. Phone / WhatsApp: ${CONTACT.phone}. Email: ${CONTACT.email}.`;

export const PRIVACY_POLICY: LegalDoc = {
  slug: "privacy-policy",
  title: "Privacy Policy",
  description: "How Neuron Academy collects, uses and protects the personal information of students, parents and website visitors.",
  updated: "14 November 2026",
  intro:
    "This policy explains what personal information Neuron Academy collects through this website, why we collect it, who we share it with and the choices you have. It applies to www.neuron-academy.in.",
  sections: [
    {
      heading: "1. Who we are",
      paragraphs: [`Neuron Academy is a coaching institute at Shaheen Bagh, New Delhi. ${CONTACT_LINE}`],
    },
    {
      heading: "2. Information we collect",
      bullets: [
        "Enquiry and admission forms: the student's or parent's name, mobile number, email address (if given), the course or class of interest, preferred batch and any message you write.",
        "Student registration for tests on this website: name, mobile number (verified by a one-time password sent by SMS), email address and password, and the tests attempted with their answers and scores.",
        "Study material bought on this website: your name, mobile number, email address (if given), the item bought and the payment transaction number you enter. Payments are made through Razorpay, our payment partner, or directly to the academy by UPI; Razorpay receives your name and contact details to process the payment and handles the card, bank or UPI details itself. This website does not collect or store card, bank or UPI PIN details.",
        "When you call, message or WhatsApp us: your number and what you choose to tell us.",
        "Technical information: like most websites, our hosting provider records basic details such as IP address, browser type and the pages requested. The site also stores small items on your device, for example to remember that you have already seen an announcement.",
        "Student results and photographs: published on this website only with the consent of the student or, for a minor, the parent or guardian.",
      ],
    },
    {
      heading: "3. How we use it",
      bullets: [
        "To reply to enquiries and process admissions.",
        "To run classes, tests and scholarship tests, and to share results and progress with the student and parent.",
        "To send academic and administrative messages about batches, timings, fees and tests.",
        "To keep the website working, secure and improving.",
      ],
      paragraphs: ["We do not sell personal information."],
    },
    {
      heading: "4. Children",
      paragraphs: [
        "Most of our students are under 18. We ask that a parent or guardian submits the enquiry or admission details, or that the student does so with their parent's knowledge and consent. A parent or guardian may ask us at any time to see, correct or delete their child's information.",
      ],
    },
    {
      heading: "5. Who we share it with",
      lead: "We share information only as needed to run the academy and this website:",
      bullets: [
        "Service providers that host and operate the website, store images and deliver SMS one-time passwords. They handle the information on our behalf.",
        "The student portal and mobile app are run by a separate provider. Information you enter there is covered by that provider's own privacy policy.",
        "Google services used on the site, such as the embedded map. If you follow a link to WhatsApp, Google or a social network, that service's policy applies.",
        "Authorities, when the law requires it.",
      ],
    },
    {
      heading: "6. Analytics and advertising",
      paragraphs: [
        "We may use Google Analytics to understand how visitors use the website, and may show advertisements through Google AdSense. These services can set cookies or use similar identifiers on your device. You can control cookies in your browser settings, and Google provides its own tools to limit personalised advertising.",
      ],
    },
    {
      heading: "7. How long we keep it",
      paragraphs: [
        "We keep enquiry details for as long as they are useful for answering you, and student records for the period of enrolment and for as long afterwards as academic, accounting or legal reasons require. After that we delete them or remove what identifies you.",
      ],
    },
    {
      heading: "8. Your choices and rights",
      bullets: [
        "Ask what information we hold about you or your child.",
        "Ask us to correct or update it.",
        "Ask us to delete it, or to remove a published result or photograph.",
        "Withdraw a consent you gave earlier.",
      ],
      paragraphs: ["To do any of these, or to raise a concern about how your information is handled, contact us using the details in section 1. We will respond within a reasonable time."],
    },
    {
      heading: "9. Security",
      paragraphs: [
        "We use reasonable technical and organisational measures to protect personal information, including encrypted connections to the website and restricted access to student records. No method of storage or transmission is completely secure, so we cannot promise absolute security.",
      ],
    },
    {
      heading: "10. Changes to this policy",
      paragraphs: ["We may update this policy as the website or the law changes. The date at the top shows when it was last revised."],
    },
  ],
};

export const TERMS: LegalDoc = {
  slug: "terms",
  title: "Terms of Use",
  description: "The terms that apply to using the Neuron Academy website, its tests and its content.",
  updated: "14 November 2026",
  intro: "These terms apply to your use of www.neuron-academy.in. By using the website you agree to them.",
  sections: [
    {
      heading: "1. About this website",
      paragraphs: [`This website is operated by Neuron Academy. ${CONTACT_LINE}`],
    },
    {
      heading: "2. Information on the website",
      paragraphs: [
        "We try to keep course details, batch dates, timings and fees on this website accurate, but they can change. Please confirm current details with the academy before making a decision. Information about entrance examinations is given for general guidance; the official website of the conducting body is always the authority on dates, eligibility, syllabus and pattern.",
      ],
    },
    {
      heading: "3. No guarantee of results",
      paragraphs: [
        "Coaching supports a student's own effort. We do not guarantee any mark, rank, selection or admission. Results shown on the website are those of the named students and do not promise a similar outcome for others.",
        "Neuron Academy is an independent coaching institute. It is not affiliated with Jamia Millia Islamia, Aligarh Muslim University, the Directorate of Education, CBSE, the National Testing Agency or any other examining body.",
      ],
    },
    {
      heading: "4. Admissions and fees",
      paragraphs: [
        "Admission to a course, the fee payable and the terms for any refund or withdrawal are as stated by the academy at the time of admission. Offers shown on the website are valid for the period stated with them.",
      ],
    },
    {
      heading: "5. Study material bought online",
      bullets: [
        "Study material sold on this website is a digital PDF. Nothing is posted to you.",
        "Payment is made online through Razorpay (UPI, card or net banking) and your download unlocks on your order page as soon as the payment goes through. If online payment is unavailable, you pay the academy directly and the download unlocks after the academy confirms that the payment has been received.",
        "The file is for the buyer's own study. Please do not share, resell or upload it.",
        "Please read the description and any free sample before buying. Digital study material is not refundable; see our Refund and Cancellation Policy. If you paid twice, paid the wrong amount or cannot open your file, contact us with your order number.",
      ],
    },
    {
      heading: "6. Accounts and online tests",
      bullets: [
        "Give accurate details when you register, and keep your password and one-time passwords private.",
        "Attempt tests yourself and honestly. Do not copy, share or publish test questions.",
        "We may suspend an account that is misused.",
      ],
    },
    {
      heading: "7. Our content",
      paragraphs: [
        "The Neuron Academy name and logo, and the notes, question papers, videos, images and text on this website, belong to Neuron Academy or are used with permission. You may use them for your own study. Please do not copy, sell or redistribute them without our written permission.",
      ],
    },
    {
      heading: "8. Links to other websites",
      paragraphs: ["The website links to other services, such as the student portal, WhatsApp, Google and official examination websites. We are not responsible for their content or their handling of your information."],
    },
    {
      heading: "9. Liability",
      paragraphs: [
        "The website is provided as it is. To the extent the law allows, Neuron Academy is not liable for loss arising from reliance on information on the website, or from the website being unavailable.",
      ],
    },
    {
      heading: "10. Governing law",
      paragraphs: ["These terms are governed by the laws of India. The courts at Delhi have jurisdiction over any dispute."],
    },
    {
      heading: "11. Changes and contact",
      paragraphs: ["We may update these terms from time to time; the date at the top shows the latest revision. For any question about them, contact us using the details in section 1."],
    },
  ],
};

export const REFUND_POLICY: LegalDoc = {
  slug: "refund-policy",
  title: "Refund and Cancellation Policy",
  description: "Neuron Academy's refund and cancellation rules for study material and other purchases made on this website.",
  updated: "14 November 2026",
  intro: "This policy applies to anything bought on this website. Please read it before you pay.",
  sections: [
    {
      heading: "1. No refund on purchases made on this website",
      paragraphs: [
        "Purchases made on this website are final. Once a payment is made, the order cannot be cancelled and the amount is not refunded, except as stated in section 3.",
      ],
    },
    {
      heading: "2. Digital study material (PDF downloads)",
      bullets: [
        "Digital study material is delivered as a download as soon as the payment goes through. Because it cannot be returned, it is not refundable and cannot be exchanged.",
        "Please read the description and any free sample before buying.",
      ],
    },
    {
      heading: "3. Material delivered to you (physical items)",
      bullets: [
        "If you buy material that is delivered to you physically, you may ask for a refund within 4 days of receiving it.",
        "To ask for a refund, contact us within those 4 days with your order number. Requests made after 4 days are not accepted.",
      ],
    },
    {
      heading: "4. Payment problems",
      bullets: [
        "If money left your account but your order does not show as paid, open your order page and press Check status, or contact us with your order number and we will sort it out.",
        "If you were charged more than once for the same order, contact us with your order number and the payment details; the extra payment will be returned to the account it was paid from.",
        "If you have paid and cannot open your file, contact us and we will send it to you.",
      ],
    },
    {
      heading: "5. Course fees",
      paragraphs: ["Fees for classroom and online courses are not covered by this policy. They follow the terms stated by the academy at the time of admission."],
    },
    {
      heading: "6. Contact",
      paragraphs: [CONTACT_LINE],
    },
  ],
};
