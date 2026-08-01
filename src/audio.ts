import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

export async function generateAudio(
  epubPath: string,
  voice: string,
  outputDir: string,
  audiblezBin: string
): Promise<string> {
  await mkdir(outputDir, { recursive: true });

  console.log(`🎙️  正在调用 ${audiblezBin} 生成音频（voice=${voice}）...`);

  // audiblez writes intermediate ffmpeg-concat file lists using this path
  // verbatim; if it's relative, ffmpeg's concat demuxer re-resolves the
  // entries relative to the list file's own directory and doubles the path,
  // breaking the final .m4b assembly. Always pass an absolute path.
  const absoluteOutputDir = path.resolve(outputDir);
  const absoluteEpubPath = path.resolve(epubPath);

  const proc = Bun.spawn(
    [audiblezBin, absoluteEpubPath, "-v", voice, "-o", absoluteOutputDir],
    {
      stdout: "inherit",
      stderr: "inherit",
    }
  );

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`audiblez 退出码非 0 (${exitCode})，音频生成可能失败。`);
  }

  const epubBaseName = path.basename(absoluteEpubPath, ".epub");
  const m4bPath = path.join(absoluteOutputDir, `${epubBaseName}.m4b`);

  await cleanupIntermediateFiles(absoluteOutputDir, epubBaseName);

  return m4bPath;
}

/** Remove the per-chapter .wav files and chapters.txt that audiblez leaves behind, keeping only the final .m4b. */
async function cleanupIntermediateFiles(
  outputDir: string,
  epubBaseName: string
): Promise<void> {
  const entries = await readdir(outputDir);
  const toRemove = entries.filter(
    (name) =>
      (name.startsWith(`${epubBaseName}_chapter_`) && name.endsWith(".wav")) ||
      name === "chapters.txt"
  );
  await Promise.all(
    toRemove.map((name) => rm(path.join(outputDir, name), { force: true }))
  );
}
