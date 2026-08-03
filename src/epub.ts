import epub from "epub-gen-memory";
import { mkdir } from "node:fs/promises";
import path from "node:path";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Honorifics/titles whose trailing "." audiblez's sentence splitter misreads
// as an end-of-sentence period (e.g. "Mr. Smith" gets split mid-name).
//
// Deliberately excludes words that also commonly stand alone as an ordinary
// sentence-final word (e.g. "St", "Gen", "Sen", "Rep", "Gov", "Fr", "Hon") -
// stripping their period would merge two real sentences into one. The
// lookahead below additionally requires the period to be followed by a
// name-like continuation, so a genuine end-of-paragraph period (which can
// never be a title - a title is always followed by a name) is left alone.
const TITLE_ABBREVIATIONS = [
  "Mr",
  "Mrs",
  "Ms",
  "Dr",
  "Prof",
  "Jr",
  "Sr",
  "Messrs",
  "Mme",
  "Mmes",
  "Rev",
  "Col",
  "Lt",
  "Sgt",
  "Capt",
];
const TITLE_PERIOD_PATTERN = new RegExp(
  `\\b(${TITLE_ABBREVIATIONS.join("|")})\\.(?=\\s+[A-Z])`,
  "g"
);

function stripTitlePeriods(text: string): string {
  return text.replace(TITLE_PERIOD_PATTERN, "$1");
}

function paragraphsToHtml(article: string): string {
  return article
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => `<p>${escapeHtml(stripTitlePeriods(p))}</p>`)
    .join("\n");
}

/** Strip characters that are invalid (or awkward) in filenames on common filesystems. */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : "Untitled Article";
}

export async function buildEpub(
  title: string,
  article: string,
  outputDir: string
): Promise<string> {
  await mkdir(outputDir, { recursive: true });

  const buffer = await epub(
    {
      title,
      author: "Claude",
      lang: "en",
      tocInTOC: false,
      numberChaptersInTOC: false,
      verbose: false,
    },
    [
      {
        title,
        // epub-gen-memory always emits a toc.xhtml nav document alongside
        // the chapter, and audiblez's chapter-detection can't tell it apart
        // from real content unless the filename looks like a chapter (it
        // matches on /chapter|part_?\d+|split_?\d+|ch_?\d+|chap_?\d+/ in the
        // filename). Naming the chapter file explicitly makes audiblez pick
        // only this document and skip the generated toc page.
        filename: "chapter_1.xhtml",
        content: paragraphsToHtml(article),
      },
    ]
  );

  const filename = `${sanitizeFilename(title)}.epub`;
  const filePath = path.join(outputDir, filename);
  await Bun.write(filePath, buffer);
  return filePath;
}
