# Vocab Article Generator

从 Type Words 的 `data.json` 中读取尚未使用过的生词，每次取一批（默认 30 个），
调用 Claude API 生成一篇包含这些单词的英语文章，打包成 epub，再用
[`audiblez`](https://github.com/santinic/audiblez) 生成对应的有声书音频。

## 工作流程

```
data.json (fsrsData)
   │  提取全部单词，排除 used-words.json 中已用过的
   ▼
取一批（默认 30 个）
   │
   ▼
Claude API 生成文章（结构化输出 {title, article}）
   │
   ▼
打包成 epub：epub/<标题>.epub
   │
   ▼
调用本地 audiblez 生成有声书：mp3/<标题>.m4b
   │
   ▼
把这批单词写入 used-words.json，下次运行自动跳过
```

## 环境要求

- [Bun](https://bun.com)（已用 1.3.x 测试）
- 本地已安装 [`audiblez`](https://github.com/santinic/audiblez) 命令行工具（需要 `ffmpeg`）
- 一个可用的 Claude API key（Anthropic 官方或兼容的自建 endpoint）

## 安装

```bash
bun install
```

## 配置

复制示例配置文件并填写：

```bash
cp .env.example .env
```

`.env` 中的常用变量（其余见 `.env.example` 完整列表）：

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | — | Claude API key |
| `ANTHROPIC_BASE_URL` | | `https://api.anthropic.com` | 自定义 endpoint（比如自建代理/网关） |
| `CLAUDE_MODEL` | | `claude-opus-5` | 使用的模型，可改成更便宜的模型（如 `claude-sonnet-5`） |
| `CLAUDE_EFFORT` | | `medium` | 生成时的 effort 级别：`low`/`medium`/`high`/`xhigh`/`max` |
| `DATA_JSON_PATH` | | `./data.json` | Type Words 导出的数据库文件路径 |
| `USED_WORDS_DB_PATH` | | `./used-words.json` | 已使用单词记录文件（纯 JSON 字符串数组） |
| `EPUB_OUTPUT_DIR` | | `./epub` | epub 文件输出目录 |
| `AUDIO_OUTPUT_DIR` | | `./mp3` | 音频文件输出目录 |
| `BATCH_SIZE` | | `30` | 每篇文章使用的单词数 |
| `ARTICLE_WORD_COUNT` | | `400` | 文章目标字数 |
| `ARTICLE_LEVEL` | | `simple` | 文章难度：`simple`（简单，短句+常用词，默认）/ `intermediate`（中等）/ `advanced`（较难，接近原版文章） |
| `VOICE` | | `af_heart` | audiblez 朗读音色 |
| `AUDIBLEZ_BIN` | | `audiblez` | audiblez 可执行文件路径/名称，如果不在 PATH 里可写绝对路径 |

## 使用方法

生成一批（默认 30 个单词，处理完一次即结束）：

```bash
bun run src/index.ts
# 或
bun run generate
```

一次性把所有剩余单词都处理完（会循环生成多篇文章/多个 epub/多段音频）：

```bash
bun run src/index.ts --all
```

## 输出

- **文章 epub**：`epub/<文章标题>.epub`
- **有声书音频**：`mp3/<文章标题>.m4b`（audiblez 生成的中间 `.wav` 章节文件会在成功后自动清理，只保留最终的 `.m4b`）
- **已用单词记录**：`used-words.json`，每次生成成功后追加，下次运行会自动跳过这些单词

如果 `data.json` 中的单词已经全部生成过文章，程序会提示「没有新的单词可用」并退出，不会调用 API。

## 常见问题

- **想重新生成某些已经用过的单词？** 直接编辑 `used-words.json`，删掉对应的单词字符串即可，下次运行就会把它们重新纳入候选池。
- **文章里漏了某个要求的单词？** 程序会自动检测并重试一次（把缺失的单词明确告诉 Claude 再生成一遍）；如果重试后仍有遗漏，会打印警告但不会中断流程。
- **audiblez 报错 / 找不到命令？** 确认已经 `pip install audiblez`（或对应安装方式）并且能在终端直接运行 `audiblez -h`；如果不在 PATH 中，设置 `.env` 里的 `AUDIBLEZ_BIN` 为其绝对路径。
