import Anthropic from "@anthropic-ai/sdk";
import type { Config } from "./config";

export interface GeneratedArticle {
  title: string;
  article: string;
}

const ARTICLE_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "A short, engaging English title for the article.",
    },
    article: {
      type: "string",
      description:
        "The full English article body, written in paragraphs separated by blank lines.",
    },
  },
  required: ["title", "article"],
  additionalProperties: false,
} as const;

function buildPrompt(words: string[], targetWordCount: number): string {
  return `Write an engaging, coherent English article of approximately ${targetWordCount} words for an intermediate-to-advanced English learner.

The article MUST naturally use every one of the following ${words.length} vocabulary words at least once (any grammatical form is fine — e.g. plural, past tense, etc.):

${words.map((w) => `- ${w}`).join("\n")}

Requirements:
- The article should read naturally, as if written for a general-interest publication (not a list of vocabulary example sentences).
- Pick a single clear topic/story that lets all the words fit naturally.
- Do not explicitly point out or define the vocabulary words in the text.
- Give the article a short, engaging title.
- Target length: about ${targetWordCount} words (some flexibility is fine, but stay reasonably close).`;
}

function findMissingWords(article: string, words: string[]): string[] {
  const lowerArticle = article.toLowerCase();
  return words.filter((w) => !lowerArticle.includes(w.toLowerCase()));
}

async function requestArticle(
  client: Anthropic,
  config: Config,
  prompt: string
): Promise<GeneratedArticle> {
  const response = await client.messages.create({
    model: config.model,
    max_tokens: 4096,
    output_config: {
      effort: config.effort,
      format: {
        type: "json_schema",
        schema: ARTICLE_SCHEMA,
      },
    },
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Claude 拒绝生成该文章（refusal）。请检查单词列表或稍后重试。");
  }

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );
  if (!textBlock) {
    throw new Error("Claude 的响应中没有找到文本内容。");
  }

  const parsed = JSON.parse(textBlock.text) as GeneratedArticle;
  if (!parsed.title || !parsed.article) {
    throw new Error("Claude 返回的 JSON 缺少 title 或 article 字段。");
  }
  return parsed;
}

export async function generateArticle(
  words: string[],
  config: Config
): Promise<GeneratedArticle> {
  const client = new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  const prompt = buildPrompt(words, config.articleWordCount);
  let result = await requestArticle(client, config, prompt);

  const missing = findMissingWords(result.article, words);
  if (missing.length > 0) {
    console.warn(
      `⚠️  文章缺少以下单词，正在重试一次: ${missing.join(", ")}`
    );
    const retryPrompt = `${prompt}\n\nYour previous draft was missing these required words — make sure this version includes ALL of them naturally: ${missing.join(
      ", "
    )}.`;
    result = await requestArticle(client, config, retryPrompt);

    const stillMissing = findMissingWords(result.article, words);
    if (stillMissing.length > 0) {
      console.warn(
        `⚠️  重试后仍缺少以下单词（将继续，不阻塞流程）: ${stillMissing.join(", ")}`
      );
    }
  }

  return result;
}
