// Results-showcase validation (pure, server + tests).
// Publication requires explicit consent: a row goes public only when
// consent AND isActive are both true, so an identifiable student
// name/photo is never published by accident.

import { isNonEmpty } from "@/lib/validation";

export function showcaseValidation(body: Record<string, unknown>): string | null {
  if (!isNonEmpty(body.studentName) || String(body.studentName).trim().length < 2) {
    return "Student display name (2–80 characters) is required.";
  }
  if (String(body.studentName).trim().length > 80) return "Student display name is too long (max 80).";
  if (!isNonEmpty(body.achievement) || String(body.achievement).trim().length > 80) {
    return "Achievement is required (max 80 characters).";
  }
  if (body.exam !== undefined && !isNonEmpty(body.exam)) return "Exam must not be empty.";
  if (isNonEmpty(body.exam) && String(body.exam).trim().length > 40) return "Exam is too long (max 40).";
  if (body.score !== undefined && body.score !== "" && String(body.score).trim().length > 40) {
    return "Score is too long (max 40).";
  }
  if (body.year !== undefined && body.year !== "") {
    if (!/^(19|20)\d{2}$/.test(String(body.year).trim()) || Number(String(body.year).trim()) > 2100) {
      return "Year must be a valid 4-digit year.";
    }
  }
  if (body.imageUrl !== undefined && body.imageUrl !== "") {
    const url = String(body.imageUrl).trim();
    if (url.length > 500 || (!url.startsWith("https://") && !url.startsWith("http://"))) {
      return "Image URL must be an http(s) URL under 500 characters.";
    }
  }
  if (body.description !== undefined && body.description !== "" && String(body.description).trim().length > 400) {
    return "Description is too long (max 400 characters).";
  }
  return null;
}

/** Activation is consent-gated: publishing an identifiable name/photo
 * without confirmed consent is rejected, on create and on update. */
export function activationAllowed(consent: boolean, isActive: boolean): boolean {
  return !isActive || consent === true;
}
