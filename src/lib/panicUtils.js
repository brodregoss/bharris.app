import { normalizeExamType } from '@/lib/studyUtils';

// Exam-type-aware reminder for the top strip (not a generic pep talk).
export function examReminder(examType) {
  const t = normalizeExamType(examType);
  if (t === 'mcq')
    return 'Read every option before picking — watch for "except" and "all of the above."';
  if (t === 'short_answer')
    return 'Name the term first, then explain it in one breath — partial credit is in the explain.';
  return 'MCQ: read all options first. Short answer: define the term, then explain. Never leave one blank.';
}