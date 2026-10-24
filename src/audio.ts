import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

export async function generateAudio(
  epubPath: string,
  voice: string,
  voiceSpeed: number,
  outputDir: string,
  audiblezBin: string
): Promise<string> {
  await mkdir(outputDir, { recursive: true });

  console.log(
    `🎙️  正在调用 ${audiblezBin} 生成音频（voice=${voice}, speed=${voiceSpeed}）...`
  );

  // audiblez writes intermediate ffmpeg-concat file lists using this path
  // verbatim; if it's relative, ffmpeg's concat demuxer re-resolves the
  // entries relative to the list file's own directory and doubles the path,
  // breaking the final .m4b assembly. Always pass an absolute path.
  const absoluteOutputDir = path.resolve(outputDir);
  const absoluteEpubPath = path.resolve(epubPath);

  const startedAt = Date.now();
  const proc = Bun.spawn(
    [
      audiblezBin,
      absoluteEpubPath,
      "-v",
      voice,
      "-s",
      String(voiceSpeed),
      "-o",
      absoluteOutputDir,
    ],
    {
      stdout: "ignore",
      stderr: "ignore",
    }
  );

  const exitCode = await proc.exited;
  const epubBaseName = path.basename(absoluteEpubPath, ".epub");

  if (exitCode !== 0) {
    // audiblez may fail during the final .m4b assembly after the .wav files
    // were already written; those wavs are still usable output.
    const wavs = await findFreshWavs(absoluteOutputDir, epubBaseName, startedAt);
    if (wavs.length === 0) {
      throw new Error(`audiblez 退出码非 0 (${exitCode})，音频生成可能失败。`);
    }
    console.warn(
      `⚠️  audiblez 退出码非 0 (${exitCode})，但已生成 ${wavs.length} 个 wav 文件，视为成功（保留 wav 文件）。`
    );
    return wavs[0]!;
  }

  const m4bPath = path.join(absoluteOutputDir, `${epubBaseName}.m4b`);

  await cleanupIntermediateFiles(absoluteOutputDir, epubBaseName);

  return m4bPath;
}

/** Chapter .wav files for this epub written since `since` (ms epoch), sorted by name. */
async function findFreshWavs(
  outputDir: string,
  epubBaseName: string,
  since: number
): Promise<string[]> {
  const entries = await readdir(outputDir);
  const candidates = entries
    .filter((name) => name.startsWith(`${epubBaseName}_`) && name.endsWith(".wav"))
    .sort()
    .map((name) => path.join(outputDir, name));
  const fresh: string[] = [];
  for (const file of candidates) {
    if ((await stat(file)).mtimeMs >= since - 1000) fresh.push(file);
  }
  return fresh;
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
