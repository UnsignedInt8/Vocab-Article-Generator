function env(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `缺少必要的环境变量 ${name}。请在 .env 文件中设置（参考 .env.example）。`
    );
  }
  return value;
}

export type ArticleLevel = "simple" | "intermediate" | "advanced";

export interface Config {
  apiKey: string;
  baseURL: string;
  model: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max";

  dataJsonPath: string;
  usedWordsDbPath: string;
  epubOutputDir: string;
  audioOutputDir: string;

  batchSize: number;
  articleWordCount: number;
  articleLevel: ArticleLevel;

  voice: string;
  audiblezBin: string;
}

export function loadConfig(): Config {
  const apiKey = requireEnv("ANTHROPIC_API_KEY");

  return {
    apiKey,
    baseURL: env("ANTHROPIC_BASE_URL", "https://api.anthropic.com")!,
    model: env("CLAUDE_MODEL", "claude-opus-5")!,
    effort: (env("CLAUDE_EFFORT", "medium") as Config["effort"]) ?? "medium",

    dataJsonPath: env("DATA_JSON_PATH", "./data.json")!,
    usedWordsDbPath: env("USED_WORDS_DB_PATH", "./used-words.json")!,
    epubOutputDir: env("EPUB_OUTPUT_DIR", "./epub")!,
    audioOutputDir: env("AUDIO_OUTPUT_DIR", "./mp3")!,

    batchSize: Number(env("BATCH_SIZE", "30")),
    articleWordCount: Number(env("ARTICLE_WORD_COUNT", "400")),
    articleLevel: (env("ARTICLE_LEVEL", "simple") as ArticleLevel) ?? "simple",

    voice: env("VOICE", "af_heart")!,
    audiblezBin: env("AUDIBLEZ_BIN", "audiblez")!,
  };
}
