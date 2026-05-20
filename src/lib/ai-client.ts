import OpenAI from "openai";

const alibabaClient = new OpenAI({
  apiKey: process.env.ALIBABA_API_KEY || "",
  baseURL: process.env.ALIBABA_BASE_URL || "",
});

export async function streamChatCompletion(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number }
) {
  const stream = await alibabaClient.chat.completions.create({
    model: "qwen-plus",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 8192,
    stream: true,
  });

  return stream;
}

export async function chatCompletion(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number }
) {
  const response = await alibabaClient.chat.completions.create({
    model: "qwen-plus",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 4096,
    stream: false,
  });

  return response.choices[0]?.message?.content || "";
}

export async function streamMultiTurnCompletion(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  options?: { temperature?: number; maxTokens?: number }
) {
  const stream = await alibabaClient.chat.completions.create({
    model: "qwen-plus",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 8192,
    stream: true,
  });

  return stream;
}
