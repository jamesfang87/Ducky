// Course numbers are entered by the teacher (e.g. "phys 1401") and stored normalized ("PHYS 1401").
// Must match the classes_course_number_check constraint (ducky-backend migrations 0002 / 0004).
const COURSE_NUMBER = /^[A-Z0-9][A-Z0-9 .-]{0,18}[A-Z0-9]$/;

export function normalizeCourseNumber(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, " ");
}

export function isValidCourseNumber(value: string): boolean {
  return COURSE_NUMBER.test(value);
}
