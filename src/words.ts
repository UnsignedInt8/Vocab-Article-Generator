import { existsSync } from "node:fs";

/**
 * data.json is a large, frequently-changing export from the Type Words app.
 * The word list lives at val.dict.val.fsrsData (keys of that object are the
 * words). The exact nesting has shifted before, so fall back to a recursive
 * search for a key named "fsrsData" if the known path doesn't resolve.
 */
function findFsrsData(node: unknown): Record<string, unknown> | undefined {
  if (node === null || typeof node !== "object") return undefined;

  if (!Array.isArray(node)) {
    const obj = node as Record<string, unknown>;
    if (
      "fsrsData" in obj &&
      obj.fsrsData !== null &&
      typeof obj.fsrsData === "object" &&
      !Array.isArray(obj.fsrsData)
    ) {
      return obj.fsrsData as Record<string, unknown>;
    }
    for (const value of Object.values(obj)) {
      const found = findFsrsData(value);
      if (found) return found;
    }
  } else {
    for (const item of node) {
      const found = findFsrsData(item);
      if (found) return found;
    }
  }

  return undefined;
}

export async function loadAllWords(dataJsonPath: string): Promise<string[]> {
  const file = Bun.file(dataJsonPath);
  if (!(await file.exists())) {
    throw new Error(`找不到 data.json 文件: ${dataJsonPath}`);
  }

  const data = await file.json();

  const direct = (data as any)?.val?.dict?.val?.fsrsData;
  const fsrsData =
    direct && typeof direct === "object" && !Array.isArray(direct)
      ? (direct as Record<string, unknown>)
      : findFsrsData(data);

  if (!fsrsData) {
    throw new Error(
      "在 data.json 中没有找到 fsrsData 字段，数据结构可能已变化。"
    );
  }

  const words = Object.keys(fsrsData)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);

  // Dedupe while preserving order.
  return Array.from(new Set(words));
}

export async function loadUsedWords(dbPath: string): Promise<Set<string>> {
  if (!existsSync(dbPath)) {
    return new Set();
  }
  const file = Bun.file(dbPath);
  const content = (await file.json()) as unknown;
  if (!Array.isArray(content)) {
    throw new Error(`${dbPath} 内容格式不正确，应为字符串数组。`);
  }
  return new Set(content.filter((w): w is string => typeof w === "string"));
}

export async function saveUsedWords(
  dbPath: string,
  usedWords: Set<string>
): Promise<void> {
  const sorted = Array.from(usedWords).sort((a, b) => a.localeCompare(b));
  await Bun.write(dbPath, JSON.stringify(sorted, null, 2) + "\n");
}
