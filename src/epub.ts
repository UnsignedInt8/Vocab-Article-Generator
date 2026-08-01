import epub from "epub-gen-memory";
import { mkdir } from "node:fs/promises";
import path from "node:path";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function paragraphsToHtml(article: string): string {
  return article
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
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
