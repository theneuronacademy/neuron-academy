// Student testimonials.
// Phase 10: demo quotes removed. Publish verified quotes via
// /admin/website/testimonials (database) — empty state shows until then.

export interface Testimonial {
  id: string;
  studentName: string;
  course: string;
  photo: string;
  testimonial: string;
  achievement: string;
}

export const TESTIMONIALS: Testimonial[] = [];
