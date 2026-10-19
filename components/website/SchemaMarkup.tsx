"use client";

import type { Course } from "@/data/courses";
import type { FacultyMember } from "@/data/faculty";
import type { Testimonial } from "@/data/testimonials";
import type { AcademyResult } from "@/data/results";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://neuronacademy.in";

export function OrganizationJsonLd() {
  const json = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: "Neuron Academy",
    url: SITE_URL,
    logo: `${SITE_URL}/images/logo.png`,
    description:
      "JEE, NEET, AMU & Jamia entrance coaching in Shaheen Bagh, New Delhi — small batches, weekly mocks and mentor-guided preparation.",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Shaheen Bagh",
      addressLocality: "New Delhi",
      addressRegion: "Delhi",
      postalCode: "110025",
      addressCountry: "IN",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 28.5562,
      longitude: 77.2891,
    },
    telephone: "+91-9876543210",
    email: "info@neuronacademy.in",
    sameAs: [
      "https://www.facebook.com/neuronacademy",
      "https://www.instagram.com/neuronacademy",
      "https://www.youtube.com/@neuronacademy",
      "https://www.linkedin.com/company/neuronacademy",
    ],
    knowsAbout: [
      "JEE Main",
      "JEE Advanced",
      "NEET UG",
      "AMU Entrance Exam",
      "Jamia Millia Islamia Entrance",
      "Foundation Courses",
      "Olympiad Preparation",
    ],
    offers: {
      "@type": "OfferCatalog",
      name: "Entrance Coaching Programs",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Course",
            name: "JEE Main + Advanced Coaching",
            description: "Physics, Chemistry and Maths with DPPs, PYQ marathons, revision cycles and rank-focused mentoring.",
            provider: { "@type": "EducationalOrganization", name: "Neuron Academy" },
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Course",
            name: "NEET-UG Coaching",
            description: "NCERT-line Biology with Physics + Chemistry numerical drills, assertion-reason practice and mock ladders.",
            provider: { "@type": "EducationalOrganization", name: "Neuron Academy" },
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Course",
            name: "AMU Entrance Coaching",
            description: "Class XI Science / Diploma / B.Sc. entrance track — science, maths, reasoning and English with AMU-pattern mocks.",
            provider: { "@type": "EducationalOrganization", name: "Neuron Academy" },
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Course",
            name: "Jamia Entrance (JMI) Coaching",
            description: "Jamia schools (IX / XI) and UG entrance preparation — complete syllabus coverage with JMI-pattern test series.",
            provider: { "@type": "EducationalOrganization", name: "Neuron Academy" },
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Course",
            name: "Foundation (IX–X) Coaching",
            description: "Science + Maths foundation with NTSE / Olympiad orientation — built for future JEE / NEET / entrance success.",
            provider: { "@type": "EducationalOrganization", name: "Neuron Academy" },
          },
        },
      ],
    },
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}

export function CourseJsonLd({ course }: { course: Course }) {
  const json = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.name,
    description: course.desc,
    provider: {
      "@type": "EducationalOrganization",
      name: "Neuron Academy",
      url: SITE_URL,
    },
    offers: {
      "@type": "Offer",
      name: course.name,
      description: course.desc,
      category: course.category,
      availability: course.admissionOpen ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${SITE_URL}/courses/${course.id}`,
    },
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: course.mode,
      courseWorkload: course.duration,
      instructor: {
        "@type": "Person",
        name: course.faculty,
      },
    },
    teaches: course.subjects,
    educationalLevel: course.target,
    audience: {
      "@type": "EducationalAudience",
      educationalRole: "student",
    },
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}

export function CourseListJsonLd({ courses }: { courses: Course[] }) {
  const json = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: courses.map((course, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Course",
        name: course.name,
        description: course.desc,
        url: `${SITE_URL}/courses/${course.id}`,
        provider: {
          "@type": "EducationalOrganization",
          name: "Neuron Academy",
        },
        offers: {
          "@type": "Offer",
          availability: course.admissionOpen ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          url: `${SITE_URL}/courses/${course.id}`,
        },
      },
    })),
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}

export function FacultyJsonLd({ faculty }: { faculty: FacultyMember }) {
  const json = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: faculty.name,
    jobTitle: faculty.designation,
    worksFor: {
      "@type": "EducationalOrganization",
      name: "Neuron Academy",
      url: SITE_URL,
    },
    knowsAbout: faculty.subject,
    description: faculty.intro,
    alumniOf: faculty.qualification
      ? {
          "@type": "EducationalOrganization",
          name: faculty.qualification,
        }
      : undefined,
    url: `${SITE_URL}/faculty/${faculty.id}`,
    image: faculty.image ? `${SITE_URL}${faculty.image}` : undefined,
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}

export function TestimonialJsonLd({ testimonials }: { testimonials: Testimonial[] }) {
  const json = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: testimonials.map((t, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Review",
        author: {
          "@type": "Person",
          name: t.studentName,
        },
        reviewBody: t.testimonial,
        reviewRating: {
          "@type": "Rating",
          ratingValue: 5,
          bestRating: 5,
          worstRating: 1,
        },
        itemReviewed: {
          "@type": "Course",
          name: t.course,
        },
        publisher: {
          "@type": "EducationalOrganization",
          name: "Neuron Academy",
        },
      },
    })),
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}

export function ResultJsonLd({ results }: { results: AcademyResult[] }) {
  const json = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: results.map((r, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "EducationalOccupationalCredential",
        name: `${r.name} - ${r.exam} ${r.year}`,
        description: `${r.tag}: ${r.score}`,
        recognizedBy: {
          "@type": "EducationalOrganization",
          name: "Neuron Academy",
        },
        dateCreated: r.year,
      },
    })),
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  const json = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${SITE_URL}${item.url}`,
    })),
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}

export function WebSiteJsonLd() {
  const json = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Neuron Academy",
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    publisher: {
      "@type": "EducationalOrganization",
      name: "Neuron Academy",
    },
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}

export function FAQJsonLd({ faqs }: { faqs: { question: string; answer: string }[] }) {
  const json = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}