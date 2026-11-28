/**
 * Converts an exercise display name into a URL-safe folder slug.
 * Example: "Forward Arm Raises" -> "forward-arm-raises"
 */
export function toExerciseSlug(exerciseName: string): string {
  return exerciseName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Resolves ordered candidate video URLs for an assigned exercise.
 * Supports both `public/exercisesvideo/<slug>/demo.mp4` and `public/exercises/<slug>/demo.mp4`
 * using Vite's BASE_URL so production builds resolve properly.
 */
export function getExerciseVideoCandidates(exerciseName: string): string[] {
  const slug = toExerciseSlug(exerciseName);
  if (!slug) return [];
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");
  return [
    `${base}/exercisesvideo/${slug}/demo.mp4`,
    `${base}/exercises/${slug}/demo.mp4`,
  ];
}

export function getExerciseVideoPath(exerciseName: string): string {
  return getExerciseVideoCandidates(exerciseName)[0] ?? "";
}
