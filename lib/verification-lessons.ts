/**
 * Parse verificationRequiredLessonIds JSON.
 * Supports legacy format: ["lesson-1", "lesson-2"]
 * And new format: [{ lessonId, instructions?, maxFiles?, requiredFormat? }]
 */
export type VerificationLessonConfig = {
  lessonId: string;
  instructions?: string;
  maxFiles?: number;
  requiredFormat?: 'video' | 'photo' | 'document';
};

export function parseVerificationLessons(json: string | null | undefined): VerificationLessonConfig[] {
  if (!json?.trim()) return [];
  try {
    const arr = JSON.parse(json) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x): VerificationLessonConfig | null => {
        if (typeof x === 'string') {
          return { lessonId: x };
        }
        if (x && typeof x === 'object' && 'lessonId' in x && typeof (x as { lessonId: unknown }).lessonId === 'string') {
          const o = x as { lessonId: string; instructions?: string; maxFiles?: number; requiredFormat?: string };
          return {
            lessonId: o.lessonId,
            instructions: typeof o.instructions === 'string' ? o.instructions : undefined,
            maxFiles: typeof o.maxFiles === 'number' ? o.maxFiles : undefined,
            requiredFormat: ['video', 'photo', 'document'].includes(o.requiredFormat ?? '') ? o.requiredFormat as 'video' | 'photo' | 'document' : undefined,
          };
        }
        return null;
      })
      .filter((x): x is VerificationLessonConfig => x !== null);
  } catch {
    return [];
  }
}

export function getVerificationLessonIds(json: string | null | undefined): string[] {
  return parseVerificationLessons(json).map((c) => c.lessonId);
}
