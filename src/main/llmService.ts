export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const sampleThoughts = [
  "ちょっと考えています…",
  "手元のメモを整理しています…",
  "ツールの設定を確認しています…",
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function* streamResponse(userMessage: string, options: { model: string }) {
  const base = `モデル ${options.model} での回答です。`;
  const details = `${userMessage}`;
  const outro = "必要に応じて MCP ツールも呼び出せます。";
  const chunks = [base, sampleThoughts[Math.floor(Math.random() * sampleThoughts.length)], details, outro];

  for (const chunk of chunks) {
    await sleep(350);
    yield `${chunk} `;
  }
}
