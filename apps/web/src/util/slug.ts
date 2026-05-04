// Deterministic slug from heading text. Mirrors the backend's `slugify`
// in `dist/methods/src/common/processGutenbergText.ts`. The two must
// agree so that links emitted by the import pipeline (e.g. `## Contents`
// links pointing to `#chapter-i`) resolve to ids assigned at render time.
export function computeSlug(headingText: string): string {
  return headingText
    .replace(/\*+/g, '')        // strip italic/bold markers
    .replace(/[\u2018\u2019]/g, '') // smart single quotes
    .replace(/[\u201C\u201D]/g, '') // smart double quotes
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
