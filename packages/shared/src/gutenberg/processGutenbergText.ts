// Pure-JS, deterministic processing of Project Gutenberg plain text into
// readable markdown. No AI in v1.
//
// Pipeline order matters. Each step assumes the input has been through the
// preceding steps:
//
//   1. Strip the legal header and footer (delimited by *** START / *** END markers).
//   2. Strip transcriber/producer notes that some books embed up front.
//   3. Strip [Illustration: ...] markers — text-only experience, no exceptions.
//   4. Tame Project Gutenberg's underscore italics:
//        short runs (a word or short phrase) → real markdown *italic*
//        long runs (whole paragraphs, multi-paragraph blocks) → underscores stripped
//   5. Detect a Table of Contents block and convert it to a clean editorial
//      list of links to chapter slugs.
//   6. Walk paragraphs:
//        - verse → preserved line breaks
//        - front-matter section names (PREFACE, DEDICATION, etc.) → ## heading
//        - chapter headings → ## heading with a centred ornament BEFORE it
//        - "FOOTNOTE:" / "Notes" sections → small-caps Notes label with rule
//        - everything else → reflowed prose paragraph
//   7. Normalize typography (smart quotes, em-dashes, ellipses).
//
// Optimized for prose novels. Poetry and plays may degrade because we
// can't tell verse from prose without ambiguity. That's acceptable for v1
// and the roadmap covers an AI-enhanced cleanup pass for the harder cases.

const HEADER_MARKER = /^\s*\*{3,}\s*START OF (?:THE |THIS )?PROJECT GUTENBERG (?:EBOOK|EBOOKS|E?-?BOOK)\b.*?\*{3,}\s*$/im;
const FOOTER_MARKER = /^\s*\*{3,}\s*END OF (?:THE |THIS )?PROJECT GUTENBERG (?:EBOOK|EBOOKS|E?-?BOOK)\b.*?\*{3,}\s*$/im;

// The break between chapters and around footnote sections is rendered as
// a markdown horizontal rule (`---`). The editor's CSS reads every <hr>
// inside the prose as the chapter ornament — three centred dots, set in
// generous vertical space. Using a real markdown construct keeps the
// document portable; if the reader exports the markdown later, the rule
// still parses correctly.
const CHAPTER_BREAK = '---';

// Front-matter section names that should be promoted to ## headings even
// if they don't match the chapter regex. These are the names that recur
// across the public-domain corpus; anything outside this list stays as
// prose unless it independently matches a chapter pattern.
const FRONT_MATTER_NAMES = [
  'PREFACE',
  'INTRODUCTION',
  'INTRODUCTORY',
  'DEDICATION',
  'FOREWORD',
  'PROLOGUE',
  'EPILOGUE',
  'AUTHOR\'S NOTE',
  'AUTHOR’S NOTE',
  'EDITOR\'S NOTE',
  'EDITOR’S NOTE',
  'TRANSLATOR\'S NOTE',
  'TRANSLATOR’S NOTE',
  'PUBLISHER\'S NOTE',
  'PUBLISHER’S NOTE',
  'NOTE',
  'NOTES',
  'PROEM',
  'ARGUMENT',
  'AFTERWORD',
  'APPENDIX',
  'POSTSCRIPT',
];

// After the keyword, the line is allowed to end (`PREFACE`), or carry a
// terminal punctuation mark (`PREFACE.`), or extend with em-dash/colon
// + words (`PREFACE — to the second edition`). Crucially, hyphens are
// NOT in the separator set: `note-book and pencil aside...` would
// otherwise match `NOTE` here and get promoted to a heading.
const FRONT_MATTER_RE = new RegExp(
  `^(?:${FRONT_MATTER_NAMES.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?:[\\s.:—].{0,80})?\\s*$`,
  'i',
);

// Chapter heading patterns. A line is a chapter heading if its trimmed
// text matches any of these.
//
// The CHAPTER pattern allows a title of up to ~250 characters after the
// keyword. This may sound generous, but Verne, Trollope, and other
// 19th-century serial novelists routinely write chapter titles like
// `CHAPTER XIV. IN WHICH PHILEAS FOGG DESCENDS THE WHOLE LENGTH OF THE
// BEAUTIFUL VALLEY OF THE GANGES WITHOUT EVER THINKING OF SEEING IT` —
// 110+ characters. An earlier 80-char cap caused half the Around the
// World contents block to flow as prose instead of TOC entries.
const CHAPTER_TITLE_LIMIT = 250;

// "Book the First", "Book the Second", "Volume the Third" — Dickens,
// Trollope, and other 19th-century novelists divided their works into
// books or volumes named with this decorated ordinal form. Each book
// has its own subtitle attached after a dash:
//
//   Book the First--Recalled to Life
//   Book the Second--the Golden Thread
//
// Match the whole construction, optionally with a trailing subtitle.
// Allow `--`, `—`, en-dash, or `:` as the divider; allow the subtitle
// to extend up to the chapter-title limit.
const BOOK_DIVIDER_PATTERN =
  /^(?:Book|Volume|Part)\s+the\s+(?:First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth|Eleventh|Twelfth|[IVXLCDM]+|\d+)(?:\s*[-—:]+\s*.{1,200})?\.?\s*$/i;

const CHAPTER_PATTERNS: RegExp[] = [
  // CHAPTER I, CHAPTER 1, PART ONE, BOOK II, VOLUME III — with optional title after
  /^(?:CHAPTER|PART|BOOK|VOLUME|SECTION|CANTO|LETTER)\s+(?:[IVXLCDM]+|\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY|FIFTY)(?:\.|:)?(?:\s+.{1,250})?$/i,
  // Book the First, Volume the Third — decorated ordinal book dividers.
  BOOK_DIVIDER_PATTERN,
  // Bare Roman numeral on its own line
  /^[IVXLCDM]+\.?$/,
  // Bare Arabic numeral on its own line
  /^\d{1,3}\.?$/,
];

// "FOOTNOTE:" or "FOOTNOTES:" headers, often used by translators. These
// blocks should be set apart with a small-caps "Notes" label and a rule.
const FOOTNOTE_HEADER_RE = /^\s*FOOTNOTES?\s*:?\s*$/i;
const NOTES_HEADER_RE = /^\s*NOTES\s*:?\s*$/i;

// -----------------------------------------------------------------------------
// Stage 3: Strip [Illustration: ...] markers
// -----------------------------------------------------------------------------

function stripIllustrations(text: string): string {
  // Find every `[Illustration` (case-insensitive) and remove the bracket
  // group it opens, walking the input one char at a time and counting
  // brackets so nested groups like `[Illustration: ...[Copyright...]]`
  // are stripped in their entirety.
  //
  // SUBTLETY: some 19th-century editions printed chapter titles on
  // decorative plates that Gutenberg transcribers recorded as
  // `[Illustration: Chapter I.]`. Stripping whole would silently lose the
  // chapter heading. So before discarding, we scan the illustration
  // content for a chapter-pattern line and re-emit just that line in
  // place of the illustration.
  let out = '';
  let i = 0;
  const re = /\[\s*Illustration\b/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    // Append everything up to the match.
    out += text.slice(lastIndex, match.index);
    // Walk forward from the match start, counting brackets.
    const startIdx = match.index + 1; // skip the opening `[`
    i = startIdx;
    let depth = 1;
    while (i < text.length && depth > 0) {
      const ch = text[i];
      if (ch === '[') depth++;
      else if (ch === ']') depth--;
      i++;
    }
    // i now points one past the closing `]` (or end-of-text).
    // Inspect the contents and decide how to handle them:
    //   - chapter-shaped line → re-emit as a heading
    //   - dedication-shaped block → re-emit as a centred italic paragraph
    //   - everything else → discard silently
    const inner = text.slice(startIdx, i - 1);
    const heading = extractHeadingFromIllustration(inner);
    if (heading) {
      out += `\n\n${heading}\n\n`;
    } else {
      const dedication = extractDedicationFromIllustration(inner);
      if (dedication) {
        out += `\n\n${dedication}\n\n`;
      }
    }
    lastIndex = i;
    re.lastIndex = i;
  }
  out += text.slice(lastIndex);
  return out;
}

// Inside an illustration body, look for a line that matches a chapter
// heading or front-matter heading pattern. Returns it if found, otherwise
// null. Used by stripIllustrations to preserve chapter titles that were
// transcribed inside decorative illustration tags.
function extractHeadingFromIllustration(inner: string): string | null {
  // Strip the leading "Illustration:" or "Illustration" prefix.
  let body = inner.replace(/^\s*Illustration\s*:?/i, '');
  // Drop underscores (italic marks) and decorative dots/middots.
  body = body.replace(/_+/g, ' ').replace(/[·•]/g, ' ');
  const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (CHAPTER_PATTERNS.some(p => p.test(line))) {
      return line;
    }
    if (FRONT_MATTER_RE.test(line)) {
      return line;
    }
  }
  return null;
}

// Some 19th-century editions printed dedications inside decorative
// plates that Project Gutenberg transcribers recorded as
// `[Illustration: _To So-and-So... in acknowledgement of... _Inscriber_ ]`.
// Preserve such dedications instead of stripping them — they are the
// author's words, not a piece of editorial chrome.
//
// Detection heuristics: the first non-prefix line begins with `To `,
// `For `, `Dedicated`, or `In Memoriam`, OR the inner block ends with
// a short italicised name on a line of its own. Either signal alone
// is enough; both together give us high confidence.
//
// Output: a single reflowed paragraph wrapped in a markdown blockquote,
// styled by the editor as a centred italic dedication block.
function extractDedicationFromIllustration(inner: string): string | null {
  // Strip the leading "Illustration:" prefix.
  let body = inner.replace(/^\s*Illustration\s*:?/i, '').trim();
  if (!body) return null;

  const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  const firstLine = lines[0].replace(/^_+|_+$/g, '');
  const startsLikeDedication =
    /^(?:To\s+\w|For\s+\w|Dedicated|In\s+Memoriam|In\s+Memory)/i.test(firstLine);

  const lastLine = lines[lines.length - 1];
  const endsWithSignature =
    /^_[^_]{2,40}_$/.test(lastLine) || // italic-wrapped short name on its own line
    /^[—–-]\s*\w+/.test(lastLine);     // em-dash + name (the "—Author" form)

  if (!startsLikeDedication && !endsWithSignature) return null;

  // Reflow the dedication into a single italic paragraph. Strip
  // surrounding underscores (Gutenberg's italic marks) and collapse
  // whitespace runs. The blockquote `> ` prefix gives the editor
  // a hook for centred dedication styling without inventing new
  // markdown extensions.
  const reflowed = body
    .replace(/_/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `> ${reflowed}`;
}

// -----------------------------------------------------------------------------
// Stage 4: Underscore italics handling
// -----------------------------------------------------------------------------

// Project Gutenberg uses _underscores_ to mark italics. Two failure modes
// in the source corpus:
//
//   (a) An entire preface or block is wrapped in one pair of underscores
//       across many paragraphs. This reads as "pages of italic text" on a
//       screen — not what the original printed book looked like.
//   (b) Even a single multi-line paragraph in italic gets tiring fast on
//       screen.
//
// Rule: short runs (≤ 240 chars and contained within a single paragraph)
// become real markdown italic. Longer runs are stripped — the underscores
// disappear and the prose reads roman.
function processUnderscores(text: string): string {
  // Collapse runs of underscored text. Match `_...content..._` where
  // content does not contain another underscore (we don't try to handle
  // nested italics — Gutenberg's plain-text format doesn't use them).
  // Multiline (s flag) lets the match span paragraph breaks, which is
  // the primary failure case we're catching.
  //
  // Key heuristic: if the matched span contains a blank line (paragraph
  // break) or is longer than 240 chars, strip the underscores. Otherwise,
  // convert to *italic*.
  return text.replace(/_([^_]+?)_/gs, (_match, inner) => {
    const containsParagraphBreak = /\n\s*\n/.test(inner);
    const tooLong = inner.length > 240;
    if (containsParagraphBreak || tooLong) {
      // Strip the underscores; let the prose read roman.
      return inner;
    }
    // Short, single-paragraph italic — promote to real markdown italic.
    // Trim newlines inside the run so it joins the surrounding paragraph
    // cleanly during reflow.
    return `*${inner.replace(/\s+/g, ' ').trim()}*`;
  });
}

// -----------------------------------------------------------------------------
// Per-paragraph: rescue paragraphs with too much italic alternation.
// -----------------------------------------------------------------------------

// Some 19th-century prefaces wrap LONG critical-analysis passages in
// italic, with roman book titles inside. After underscore processing
// these survive as multiple short *italic* runs interleaved with roman
// text — readable on a printed page but disorienting on screen.
//
// Rule: if a paragraph contains 3 or more italic runs and the combined
// italic span exceeds 200 chars or 30% of the paragraph length, strip
// all italics from that paragraph and let it read as roman prose.
//
// Limited to PARAGRAPH scope so a normal paragraph with two emphasised
// words is untouched.
function deAlternatingItalic(paragraph: string): string {
  const runs = paragraph.match(/\*[^*]+\*/g);
  if (!runs || runs.length < 3) return paragraph;
  const italicChars = runs.reduce((sum, r) => sum + r.length - 2, 0);
  const ratio = italicChars / paragraph.length;
  if (italicChars >= 200 || ratio >= 0.3) {
    // Strip all italic markers from this paragraph; let the prose read roman.
    return paragraph.replace(/\*([^*]+)\*/g, '$1');
  }
  return paragraph;
}

// -----------------------------------------------------------------------------
// Slug computation for headings (used by TOC and in-page anchors)
// -----------------------------------------------------------------------------

// Deterministic, stable slug from a heading's plain text. Stripped of
// markdown emphasis and punctuation; lower-cased; words joined with `-`.
// Collisions are disambiguated with a numeric suffix at use-site.
export function slugify(headingText: string): string {
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

// -----------------------------------------------------------------------------
// Heading detection helpers
// -----------------------------------------------------------------------------

function looksLikeChapterHeading(reflowed: string): boolean {
  const trimmed = reflowed.trim();
  // Use the same generous cap as the regex so verbose Victorian chapter
  // titles aren't rejected before the pattern even gets to look at them.
  if (!trimmed || trimmed.length > CHAPTER_TITLE_LIMIT) return false;

  // Pattern match — these are the strong signals.
  if (CHAPTER_PATTERNS.some(p => p.test(trimmed))) return true;

  return false;
}

function looksLikeFrontMatterHeading(reflowed: string): boolean {
  const trimmed = reflowed.trim();
  if (!trimmed || trimmed.length > 80) return false;
  return FRONT_MATTER_RE.test(trimmed);
}

function looksLikeAllCapsHeading(reflowed: string): boolean {
  const trimmed = reflowed.trim();
  if (!trimmed || trimmed.length > 60) return false;
  // All-caps and short, no terminal punctuation — almost certainly a
  // title-cased heading. Accept.
  return (
    trimmed === trimmed.toUpperCase() &&
    /[A-Z]/.test(trimmed) &&
    !/[.!?,]$/.test(trimmed)
  );
}

// Detects a line that looks like a chapter title that the source put on
// its own line directly under a bare `CHAPTER I.` label. We need this
// to fold the two together: the source `CHAPTER I.\nThe Period\nIt was
// the best of times...` should become `## CHAPTER I. The Period` plus
// a prose paragraph beginning `It was the best of times...`.
//
// Rules: short (≤ 80 chars), title-case-ish (first letter capitalised,
// no terminal sentence punctuation, not all-caps — that's its own
// heading shape — and contains at least one space-separated word). A
// line of pure prose like `It was the best of times, it was the worst`
// fails the no-terminal-comma rule.
function looksLikeOrphanedChapterTitle(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length > 80) return false;
  if (/[.!?,;:]$/.test(trimmed)) return false;
  // First character should be a capital letter (not a digit, not a
  // lowercase opener like a continuation of prose).
  if (!/^[A-Z]/.test(trimmed)) return false;
  // Reject all-caps — those are themselves heading-shaped and would
  // already match the other heading detectors.
  if (trimmed === trimmed.toUpperCase()) return false;
  return true;
}

// -----------------------------------------------------------------------------
// Paragraph reflow
// -----------------------------------------------------------------------------

function reflowParagraph(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// -----------------------------------------------------------------------------
// Smart typography
// -----------------------------------------------------------------------------

function smartQuotes(text: string): string {
  let out = text;
  // Apostrophes inside words first (don't, she's, '90s)
  out = out.replace(/(\w)'(\w)/g, '$1\u2019$2');
  out = out.replace(/'(\d{2}s)\b/g, '\u2019$1');
  out = out.replace(/(\w)'(?=[\s.,;:!?)\]"])/g, '$1\u2019');
  // Double quotes: walk and alternate
  out = out.replace(/"([^"]*)"/g, '\u201C$1\u201D');
  // Remaining straight singles → opening single (best effort)
  out = out.replace(/(^|[\s(\[{])'/g, '$1\u2018');
  out = out.replace(/'/g, '\u2019');
  return out;
}

function normalizeTypography(text: string): string {
  // Protect standalone `---` lines from the em-dash normalizer. They are
  // markdown horizontal rules, not punctuation. We swap them out to a
  // private-use sentinel before the regex runs and restore them after.
  const HR_SENTINEL = '\uE000HR\uE001';
  let out = text.replace(/\n---\n/g, `\n${HR_SENTINEL}\n`);
  // Em-dashes: " -- " → " — ". We deliberately DO NOT match three dashes
  // because some Gutenberg files use `---` for actual em-dashes too — we
  // narrow to two dashes here so horizontal rules survive cleanly. The
  // word-boundary case below covers the rare `word--word` form.
  out = out.replace(/\s--\s/g, ' \u2014 ');
  // Em-dash at word boundary without spaces ("word--word" → "word—word")
  out = out.replace(/([^\s-])--([^\s-])/g, '$1\u2014$2');
  // Ellipses: 3+ dots → …
  out = out.replace(/\.{3,}/g, '\u2026');
  out = smartQuotes(out);
  // Restore protected horizontal rules.
  out = out.replace(new RegExp(HR_SENTINEL, 'g'), '---');
  return out;
}

// -----------------------------------------------------------------------------
// TOC detection
// -----------------------------------------------------------------------------

// A TOC paragraph in Gutenberg plain text typically looks like:
//
//   CONTENTS
//
//   CHAPTER       PAGE
//
//   I. The Beginning .................. 1
//   II. The Adventure ................. 23
//   III. The End ...................... 102
//
// Returns null if the paragraph isn't a TOC; otherwise returns a list of
// the chapter labels in order. Page numbers and dot leaders are stripped.
function detectAndParseToc(rawParagraph: string): string[] | null {
  const lines = rawParagraph.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  // First line should be CONTENTS or TABLE OF CONTENTS.
  const first = lines[0];
  if (!/^(?:CONTENTS|TABLE OF CONTENTS)\.?\s*$/i.test(first)) return null;

  // Strip a "CHAPTER PAGE" header line if present.
  let entries = lines.slice(1);
  if (/^(?:CHAPTER|CHAPTERS|SECTION|PART)\b.*\b(?:PAGE|PAGES?)\b/i.test(entries[0])) {
    entries = entries.slice(1);
  }

  // Each remaining line should be an entry: number/roman + title +
  // (optional dot leaders) + optional page number. Strip the dots and the
  // trailing page number; keep the rest.
  const parsed: string[] = [];
  for (const line of entries) {
    // Drop trailing page number and dot leaders.
    const cleaned = line
      .replace(/\.{2,}\s*\d+\s*$/, '')   // "...... 23"
      .replace(/\s*\d+\s*$/, '')         // "  23"
      .replace(/\.{2,}\s*$/, '')         // trailing dots only
      .trim();
    if (cleaned.length < 2) continue;
    // Skip if the line is so short it's probably noise.
    if (cleaned.length > 200) return null; // probably not a TOC after all
    parsed.push(cleaned);
  }

  if (parsed.length < 2) return null;
  return parsed;
}

// Render a parsed TOC as a clean editorial block: a "Contents" heading
// followed by one entry per line as plain text. Earlier versions emitted
// markdown links pointing at chapter slugs, but inline link clickability
// inside ProseMirror's contenteditable surface proved fragile across
// hosts — clicks were variously swallowed, redirected to new tabs, or
// turned into cursor placements. The Chapter Navigation drawer (built
// outside the editor) provides the same jumping behaviour reliably.
function renderToc(entries: string[]): { markdown: string; slugs: string[] } {
  const slugs: string[] = [];
  const lines: string[] = [];
  for (const entry of entries) {
    slugs.push(slugify(entry));
    lines.push(`- ${entry}`);
  }
  return {
    markdown: `## Contents\n\n${lines.join('\n')}`,
    slugs,
  };
}

// -----------------------------------------------------------------------------
// Footnote section formatting
// -----------------------------------------------------------------------------

function isFootnoteHeader(reflowed: string): boolean {
  return FOOTNOTE_HEADER_RE.test(reflowed) || NOTES_HEADER_RE.test(reflowed);
}

// Locate a `FOOTNOTE:` or `FOOTNOTES:` marker anywhere inside a reflowed
// paragraph and split there. Project Gutenberg often runs notes inline
// without blank lines (`...consideration.[1] FOOTNOTE: [1] ...`), or
// flows the entire `FOOTNOTES:` section as one paragraph (the Steel
// Flea pattern). A simple "is this paragraph exactly the marker?"
// check misses both cases.
//
// Returns null if no marker is present. Otherwise returns:
//   - bodyBefore: the prose preceding the marker, if any (left untouched
//     so things like the body reference `[1]` survive in place);
//   - notesAfter: the trailing portion containing the actual notes,
//     which we then split into individual entries on `[N]` boundaries.
function detectInlineFootnoteMarker(
  reflowed: string,
): { bodyBefore: string; notesAfter: string } | null {
  // Match `FOOTNOTE:` / `FOOTNOTES:` exactly (uppercase only) followed
  // shortly by a bracketed numeral `[N]`. The all-caps + colon + `[N]`
  // combination is the strong signal of a Gutenberg footnote section
  // marker — case-sensitive matching avoids false positives from regular
  // prose containing the word "footnote".
  const m = /\bFOOTNOTES?\s*:\s+(?=\[\d{1,3}\])/.exec(reflowed);
  if (!m) return null;
  return {
    bodyBefore: reflowed.slice(0, m.index).trim(),
    notesAfter: reflowed.slice(m.index + m[0].length).trim(),
  };
}

// Split a chunk of run-on footnote text into individual entries. Each
// entry begins with a bracketed numeral like `[1]`, `[2]`, `[10]`. The
// marker stays attached to the entry that follows it, so `[1] First note
// text. [2] Second note text.` becomes two paragraphs:
//   `[1] First note text.`
//   `[2] Second note text.`
//
// If the input contains no `[N]` markers (an unusual but possible case),
// returns the input as a single entry.
function splitFootnoteEntries(text: string): string[] {
  if (!text) return [];
  // Split before each [N] marker, preserving the marker on the right
  // side of the split. The leading whitespace before the marker is the
  // boundary.
  const parts = text.split(/\s+(?=\[\d{1,3}\])/);
  return parts.map(p => p.trim()).filter(Boolean);
}

// Emit a framed Notes section into the output array. Always preceded by
// a horizontal rule and a `### Notes` subhead so the reader sees a clean
// editorial division. Each entry from `entries` is pushed as its own
// paragraph; the editor styles `[N]` runs at the start of paragraphs as
// numerated note entries via standard prose CSS.
function emitNotesSection(out: string[], entries: string[]) {
  if (entries.length === 0) return;
  out.push(CHAPTER_BREAK);
  out.push('### Notes');
  for (const entry of entries) {
    out.push(entry);
  }
}

// Emit a prose paragraph into the output array, with two transforms
// applied first:
//   1. `deAlternatingItalic` — rescue paragraphs with too much italic
//      alternation (the multi-emphasis preface case).
//   2. Inline footnote-marker splitting — if the paragraph contains a
//      `FOOTNOTE:` / `FOOTNOTES:` marker followed by `[N]` entries,
//      split there and emit a framed Notes section.
//
// Used both by the main paragraph loop and by the mixed-block splitter
// (which previously emitted prose directly and so missed the inline
// footnote case in books like The Steel Flea, where the footnote runs
// inside a paragraph that also contains a front-matter heading).
function emitProseParagraph(out: string[], paragraph: string): boolean {
  const inlineFn = detectInlineFootnoteMarker(paragraph);
  if (inlineFn) {
    if (inlineFn.bodyBefore) {
      out.push(deAlternatingItalic(inlineFn.bodyBefore));
    }
    const entries = splitFootnoteEntries(inlineFn.notesAfter);
    emitNotesSection(out, entries);
    return true;
  }
  out.push(deAlternatingItalic(paragraph));
  return false;
}

// -----------------------------------------------------------------------------
// Main entry point
// -----------------------------------------------------------------------------

export function processGutenbergText(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('processGutenbergText: rawText must be a non-empty string.');
  }

  // 1. Strip header and footer.
  let body = rawText;
  const startMatch = HEADER_MARKER.exec(body);
  if (startMatch) body = body.slice(startMatch.index + startMatch[0].length);
  const endMatch = FOOTER_MARKER.exec(body);
  if (endMatch) body = body.slice(0, endMatch.index);

  if (!startMatch || !endMatch) {
    console.warn(
      'processGutenbergText: did not find both START/END markers, using full text.',
      { hadStart: !!startMatch, hadEnd: !!endMatch },
    );
  }

  // 2. Strip producer notes that some books embed at the very top.
  body = body.replace(
    /^(?:[^\n]*\b(?:Produced by|Transcriber's Note|Transcribers' Note|E-text prepared by|E-text produced by)\b[\s\S]*?\n\n)+/i,
    '',
  );

  // Normalize line endings.
  body = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 3. Strip illustration markers everywhere (body, captions, plates).
  body = stripIllustrations(body);

  // 4. Tame underscore italics. Done before paragraph splitting because
  // long-form italic blocks span paragraph breaks.
  body = processUnderscores(body);

  // 5. Split into paragraphs on blank lines.
  const rawParagraphs = body.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);

  // 6. Walk paragraphs.
  // We track whether we're inside a footnote/notes section so subsequent
  // numbered items are formatted as footnote entries rather than headings.
  const out: string[] = [];
  let lastWasChapterBreak = false;
  let inFootnoteSection = false;
  let chapterCount = 0;

  for (let i = 0; i < rawParagraphs.length; i++) {
    const raw = rawParagraphs[i];

    // ---- Try to detect a TOC at the current position ----
    const toc = detectAndParseToc(raw);
    if (toc) {
      const { markdown } = renderToc(toc);
      // The TOC sits in a quiet block of its own. Add a chapter break-style
      // breath above and below so it doesn't crowd into surrounding prose.
      if (out.length > 0) out.push('');
      out.push(markdown);
      out.push('');
      // Reset footnote state if we'd been in one.
      inFootnoteSection = false;
      continue;
    }

    // ---- Short-line block (title page, dedication block, TOC, address) ----
    // Many Gutenberg paragraphs have no blank lines internally because
    // their layout was visual on the printed page. When we hit such a
    // block, walk its lines and classify each:
    //
    //   - "Contents" / "CONTENTS"  → start of inline TOC; subsequent
    //     chapter-shaped lines become TOC entries until a non-chapter
    //     line appears.
    //   - PREFACE / DEDICATION etc. → emit as ## heading.
    //   - chapter-shaped line       → emit as ## heading (unless we're
    //     in a TOC run).
    //   - everything else           → reflowed prose paragraph.
    {
      const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
      const hasInternalHeading = lines.some(
        (l) => looksLikeFrontMatterHeading(l) || looksLikeChapterHeading(l) || /^(?:CONTENTS|Contents|TABLE OF CONTENTS)\.?\s*$/i.test(l),
      );
      if (lines.length > 1 && hasInternalHeading) {
        type Seg =
          | { kind: 'prose'; lines: string[] }
          | { kind: 'heading'; line: string }
          | { kind: 'toc'; entries: string[] };
        const segments: Seg[] = [];
        let buffer: string[] = [];
        let tocEntries: string[] | null = null;
        const flushBuffer = () => {
          if (buffer.length > 0) {
            segments.push({ kind: 'prose', lines: buffer });
            buffer = [];
          }
        };
        const flushToc = () => {
          if (tocEntries && tocEntries.length > 0) {
            segments.push({ kind: 'toc', entries: tocEntries });
          }
          tocEntries = null;
        };

        // Index-based walk so we can peek at the next line when we
        // need to (e.g. orphaned chapter titles on the line below
        // a bare `CHAPTER I.`).
        for (let li = 0; li < lines.length; li++) {
          const line = lines[li];
          if (/^(?:CONTENTS|Contents|TABLE OF CONTENTS)\.?\s*$/i.test(line)) {
            flushBuffer();
            flushToc();
            tocEntries = [];
            continue;
          }
          if (tocEntries !== null) {
            // We're inside a TOC run — chapter and book-divider lines
            // are entries; an unrecognized line ends the TOC. (The
            // book-divider pattern is part of CHAPTER_PATTERNS, so
            // lines like `Book the Second--the Golden Thread` stay
            // inside the TOC run instead of ending it prematurely.)
            const cleaned = line.replace(/\.{2,}\s*\d+\s*$/, '').replace(/\s*\d+\s*$/, '').trim();
            if (looksLikeChapterHeading(cleaned)) {
              // Disambiguate "this is still TOC" from "this is the
              // first real chapter heading after the TOC". When the
              // same label has already been recorded in the current
              // TOC (e.g. CHAPTER I appearing once per Book section
              // earlier in the TOC), interpret the repeat as the
              // start of the actual book — flush the TOC and let the
              // line be re-handled as a real chapter heading below.
              const alreadySeen = tocEntries.some(
                (entry) => entry.toUpperCase() === cleaned.toUpperCase(),
              );
              if (!alreadySeen) {
                tocEntries.push(cleaned);
                continue;
              }
              flushToc();
              // Fall through with `line` still pointing at this
              // chapter — the heading branch below will pick it up.
            } else {
              flushToc();
              // Fall through to normal handling.
            }
          }
          if (looksLikeFrontMatterHeading(line) || looksLikeChapterHeading(line)) {
            flushBuffer();
            // Orphaned chapter titles: when a bare `CHAPTER I.` is
            // followed by a short title-cased line that isn't itself
            // a heading, fold it onto the heading so we get
            // `CHAPTER I. The Period` instead of a heading + a
            // run-on prose paragraph that swallows the title.
            //
            // The "bare" check is a length proxy — a heading that's
            // already 30+ characters likely already has its title.
            const next = lines[li + 1];
            const isBareLabel = line.length <= 30;
            if (
              isBareLabel &&
              next &&
              looksLikeOrphanedChapterTitle(next) &&
              !looksLikeChapterHeading(next) &&
              !looksLikeFrontMatterHeading(next)
            ) {
              segments.push({ kind: 'heading', line: `${line} ${next}` });
              li++; // skip the title line we just absorbed
            } else {
              segments.push({ kind: 'heading', line });
            }
          } else {
            buffer.push(line);
          }
        }
        flushBuffer();
        flushToc();

        for (const seg of segments) {
          if (seg.kind === 'heading') {
            out.push(`## ${seg.line}`);
          } else if (seg.kind === 'toc') {
            const { markdown } = renderToc(seg.entries);
            out.push(markdown);
          } else if (seg.lines.length > 0) {
            // Use the shared prose emitter so inline `FOOTNOTE: [N]`
            // markers inside a mixed-block paragraph are split here too.
            const isFootnote = emitProseParagraph(out, seg.lines.join(' '));
            if (isFootnote) inFootnoteSection = true;
          }
        }
        lastWasChapterBreak = false;
        continue;
      }
    }

    // ---- Reflow the paragraph for heading detection ----
    const reflowed = reflowParagraph(raw);
    if (!reflowed) continue;

    // ---- Footnote section header on its own ("FOOTNOTES:" / "NOTES") ----
    // Bare-marker case: just emit the framing; the next paragraphs will
    // arrive as individual entries on subsequent iterations.
    if (isFootnoteHeader(reflowed)) {
      out.push(CHAPTER_BREAK);
      out.push('### Notes');
      inFootnoteSection = true;
      lastWasChapterBreak = true;
      continue;
    }

    // ---- (Inline footnote markers are handled inside emitProseParagraph,
    //      called below from the default prose branch and from the
    //      mixed-block segment loop above.) ----

    // ---- Chapter heading ----
    // Slugs are NOT emitted into the markdown — the renderer computes
    // them client-side from heading text so the markdown stays clean and
    // portable. TOC links use the same slug formula and resolve to the
    // computed ids via standard anchor navigation.
    if (looksLikeChapterHeading(reflowed) && !inFootnoteSection) {
      chapterCount++;
      // Insert a centred ornament before the chapter heading — but skip
      // it for the very first chapter (no preceding prose to break from)
      // and skip if we just emitted a break (TOC).
      if (chapterCount > 1 && !lastWasChapterBreak) {
        out.push(CHAPTER_BREAK);
      }
      out.push(`## ${reflowed}`);
      lastWasChapterBreak = false;
      continue;
    }

    // ---- Front-matter section heading (PREFACE, DEDICATION, etc.) ----
    if (looksLikeFrontMatterHeading(reflowed)) {
      out.push(`## ${reflowed}`);
      // Front matter never starts a footnote section.
      inFootnoteSection = false;
      lastWasChapterBreak = false;
      continue;
    }

    // ---- Generic short ALL-CAPS line: still likely a heading ----
    if (looksLikeAllCapsHeading(reflowed)) {
      out.push(`## ${reflowed}`);
      inFootnoteSection = false;
      lastWasChapterBreak = false;
      continue;
    }

    // ---- Default: prose paragraph ----
    const becameFootnotes = emitProseParagraph(out, reflowed);
    if (becameFootnotes) {
      inFootnoteSection = true;
      lastWasChapterBreak = true;
    } else {
      lastWasChapterBreak = false;
    }
  }

  // 7. Drop redundant front-of-book bibliographic metadata.
  // The very first paragraphs of a Gutenberg edition are typically the
  // title page: book title, author, publisher imprint, year. The app
  // already shows the title and author in its own header so re-rendering
  // them is redundant. Drop any consecutive non-heading paragraphs at
  // the top of `out` until we encounter a heading OR a dedication
  // blockquote (extracted from an illustration plate) — those are
  // the author's words and belong in the reading copy.
  while (
    out.length > 0 &&
    !out[0].startsWith('## ') &&
    !out[0].startsWith('### ') &&
    !out[0].startsWith('> ')
  ) {
    out.shift();
  }

  // 8. Join with blank lines, normalize typography across the whole thing.
  const joined = out.join('\n\n');
  // Collapse 3+ blank lines back down to 2 (we may have emitted extra
  // breaks around the TOC and footnote section).
  const tightened = joined.replace(/\n{3,}/g, '\n\n');
  return normalizeTypography(tightened).trim() + '\n';
}
