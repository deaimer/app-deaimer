/**
 * Merges <p> elements that are visual line continuations rather than real
 * paragraph breaks. This is common when content is pasted from Google Docs,
 * Word, PDFs, or job boards into a rich-text editor.
 *
 * Pure string implementation — works identically in SSR and on the client,
 * avoiding hydration mismatches from the previous DOM-based version.
 */
const commonShortWords = new Set([
  "a", "an", "in", "on", "at", "of", "to", "do", "so", "go", "no",
  "up", "or", "if", "is", "it", "be", "by", "as", "am", "we", "us",
  "he", "me", "my", "its", "the", "and", "but", "for", "nor", "yet",
  "i", "s",
]);

function extractText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeInnerHtml(inner: string): string {
  return inner.replace(/\s*\n+\s*/g, " ");
}

function isHeadingLikeParagraph(text: string): boolean {
  if (!text || text.length > 80) return false;
  if (text.split(/\s+/).length > 8) return false;
  if (/[.!?,;:]$/.test(text)) return false;
  if (text.endsWith("-")) return false;
  const firstLetter = text.match(/[A-Za-z]/)?.[0] ?? "";
  return Boolean(firstLetter && firstLetter === firstLetter.toUpperCase());
}

function shouldJoinWordFragments(prevText: string, nextText: string): boolean {
  if (/[;:,.!?)]$/.test(prevText)) return false;

  const prevLastFrag = (prevText.split(/[\s;:,.!?()[\]{}]/).pop() ?? "").trim();
  const nextFirstFrag = (nextText.split(/[\s;:,.!?()[\]{}]/)[0] ?? "").trim();
  const prevIsWordFrag =
    prevLastFrag.length >= 1 &&
    prevLastFrag.length <= 3 &&
    /^[a-z]+$/.test(prevLastFrag) &&
    !commonShortWords.has(prevLastFrag);
  const nextIsWordFrag =
    nextFirstFrag.length >= 1 &&
    nextFirstFrag.length <= 2 &&
    /^[a-z]+$/.test(nextFirstFrag) &&
    !commonShortWords.has(nextFirstFrag);

  return prevIsWordFrag || nextIsWordFrag;
}

function paragraphJoiner(prevText: string, nextText: string): string {
  if (prevText.endsWith("-")) return "";
  return shouldJoinWordFragments(prevText, nextText) ? "" : " ";
}

type Segment = { kind: "p"; inner: string } | { kind: "other"; raw: string };

function parseSegments(html: string): Segment[] {
  const segments: Segment[] = [];
  let pos = 0;
  const pPattern = /<p>([\s\S]*?)<\/p>/g;
  let m: RegExpExecArray | null;

  while ((m = pPattern.exec(html)) !== null) {
    if (m.index > pos) {
      segments.push({ kind: "other", raw: html.slice(pos, m.index) });
    }
    segments.push({ kind: "p", inner: normalizeInnerHtml(m[1]) });
    pos = m.index + m[0].length;
  }

  if (pos < html.length) {
    segments.push({ kind: "other", raw: html.slice(pos) });
  }

  return segments;
}

export function mergeHtmlContinuationParagraphs(html: string): string {
  if (!html) return html;

  const segments = parseSegments(html);
  const result: string[] = [];
  let i = 0;

  while (i < segments.length) {
    const seg = segments[i];

    if (seg.kind !== "p") {
      result.push(seg.raw);
      i++;
      continue;
    }

    const text = extractText(seg.inner);

    if (isHeadingLikeParagraph(text)) {
      result.push(`<p>${seg.inner}</p>`);
      i++;
      continue;
    }

    let mergedInner = seg.inner;
    i++;

    while (i < segments.length) {
      const next = segments[i];
      if (next.kind !== "p") break;

      const nextText = extractText(next.inner);

      if (!nextText) {
        i++;
        break;
      }

      if (isHeadingLikeParagraph(nextText)) break;

      const prevText = extractText(mergedInner);
      const sep = paragraphJoiner(prevText, nextText);
      mergedInner = mergedInner.trimEnd() + sep + next.inner;
      i++;
    }

    result.push(`<p>${mergedInner}</p>`);
  }

  return result.join("");
}
