import { loadConfig } from "./config";
import { loadAllWords, loadUsedWords, saveUsedWords } from "./words";
import { generateArticle } from "./claude";
import { buildEpub } from "./epub";
import { generateAudio } from "./audio";

const processAll = process.argv.includes("--all");

async function processBatch(
  words: string[],
  config: ReturnType<typeof loadConfig>
): Promise<string[]> {
  console.log(`\n📚 使用 ${words.length} 个单词生成文章: ${words.join(", ")}`);

  const { title, article, usedWords } = await generateArticle(words, config);
  console.log(`\n✅ 文章生成完成: 《${title}》`);
  console.log(`   字数约 ${article.split(/\s+/).filter(Boolean).length} 词`);

  if (usedWords.length < words.length) {
    const notUsed = words.filter((w) => !usedWords.includes(w));
    console.log(`⚠️  以下 ${notUsed.length} 个单词未在文章中使用: ${notUsed.join(", ")}`);
  }

  const epubPath = await buildEpub(title, article, config.epubOutputDir);
  console.log(`📖 EPUB 已生成: ${epubPath}`);

  const audioPath = await generateAudio(
    epubPath,
    config.voice,
    config.audioOutputDir,
    config.audiblezBin
  );
  console.log(`🔊 音频生成完成: ${audioPath}`);

  return usedWords;
}

async function main() {
  const config = loadConfig();

  const allWords = await loadAllWords(config.dataJsonPath);
  const usedWords = await loadUsedWords(config.usedWordsDbPath);

  let remaining = allWords.filter((w) => !usedWords.has(w));
  console.log(
    `共 ${allWords.length} 个单词，已使用 ${usedWords.size} 个，剩余 ${remaining.length} 个可用于生成新文章。`
  );

  if (remaining.length === 0) {
    console.log("没有新的单词可用，所有单词都已经生成过文章。");
    return;
  }

  do {
    const batch = remaining.slice(0, config.batchSize);
    const actuallyUsedWords = await processBatch(batch, config);

    for (const w of actuallyUsedWords) usedWords.add(w);
    await saveUsedWords(config.usedWordsDbPath, usedWords);
    console.log(`💾 已记录 ${actuallyUsedWords.length} 个已使用单词到 ${config.usedWordsDbPath}`);

    remaining = remaining.slice(config.batchSize);
  } while (processAll && remaining.length > 0);

  if (processAll && remaining.length === 0) {
    console.log("\n🎉 所有单词均已处理完毕。");
  } else if (!processAll && remaining.length > 0) {
    console.log(
      `\n还有 ${remaining.length} 个单词未处理，再次运行本程序继续生成（或使用 --all 一次性处理全部剩余批次）。`
    );
  }
}

main().catch((err) => {
  console.error("\n❌ 出错了:", err instanceof Error ? err.message : err);
  process.exit(1);
});
