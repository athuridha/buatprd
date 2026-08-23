import OpenAI from "openai";

// Alibaba Cloud DashScope Client (Official Primary: Qwen 3.7 Max, Qwen Plus, etc.)
const alibabaClient = new OpenAI({
  apiKey:
    process.env.ALIBABA_API_KEY ||
    "sk-918dc763adf4467ea34667c38a41f1bc",
  baseURL:
    process.env.ALIBABA_BASE_URL ||
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
});

// NVIDIA NIM Client (z-ai/glm-5.2, minimaxai/minimax-m3, etc.)
const nvidiaClient = new OpenAI({
  apiKey:
    process.env.NVIDIA_API_KEY ||
    "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",
  baseURL:
    process.env.NVIDIA_BASE_URL ||
    "https://integrate.api.nvidia.com/v1",
});

// TokenRouter Client (DeepSeek V4 Pro, Qwen Free, etc.)
const tokenRouterClient = new OpenAI({
  apiKey:
    process.env.TOKENROUTER_API_KEY ||
    "sk-tztQk8PKYVFtIlMY73H4kIqI0HZmzVbCFBVNFpGSjVPVGOs8",
  baseURL:
    process.env.TOKENROUTER_BASE_URL ||
    "https://api.tokenrouter.com/v1",
});

// TokenHarbor Client (MiMo V2.5, DeepSeek V4 Flash, etc.)
const tokenHarborClient = new OpenAI({
  apiKey:
    process.env.TOKENHARBOR_API_KEY ||
    "thk_live_9dxa4tB_Y1fcJLfn-lE9WxbpwBat02jnE9WMMnh-tgLKn9q1HjzXoXNRaRUQOZCU",
  baseURL:
    process.env.TOKENHARBOR_BASE_URL ||
    "https://tokenharbor.ai/v1",
});

// B.AI Client (DeepSeek V4 Flash, etc.)
const baiClient = new OpenAI({
  apiKey:
    process.env.BAI_API_KEY ||
    "sk-14libr9isbqplmbh610p9n8dudgkhcjc",
  baseURL:
    process.env.BAI_BASE_URL ||
    "https://api.b.ai/v1",
});

const DEFAULT_MODEL =
  process.env.ALIBABA_MODEL ||
  "qwen3.7-max-2026-05-20";

// Ordered list of active Qwen 3.7 Max snapshot versions
export const ACTIVE_QWEN_SNAPSHOTS = [
  "qwen3.7-max-2026-05-20",
  "qwen3.7-max-2026-06-08",
  "qwen3.7-max-2026-05-17",
];

export function getClientAndModel(requestedModel?: string): {
  client: OpenAI;
  model: string;
  provider: "alibaba" | "nvidia" | "tokenrouter" | "tokenharbor" | "bai";
} {
  let model = requestedModel || DEFAULT_MODEL;

  // Auto-map generic "qwen3.7-max" or "qwen-max" to the active working snapshot
  if (model === "qwen3.7-max" || model === "qwen-max" || model === "qwen/qwen3.7-max") {
    model = "qwen3.7-max-2026-05-20";
  }

  // Auto-map legacy deepseek pro or generic deepseek to fast deepseek-v4-flash
  if (
    model === "deepseek/deepseek-v4-pro-0813-free" ||
    model === "deepseek" ||
    model === "deepseek-v4" ||
    model === "deepseek-pro"
  ) {
    model = "deepseek-v4-flash";
  }

  // Route to B.AI for deepseek-v4-flash
  if (model === "deepseek-v4-flash" || model.startsWith("bai/")) {
    const actualModel = model.replace("bai/", "");
    return { client: baiClient, model: actualModel, provider: "bai" };
  }

  // Route to TokenHarbor for MiMo or TokenHarbor DeepSeek Flash
  if (
    model.startsWith("mimo") ||
    model === "mimo-v2.5:free" ||
    model === "deepseek-v4-flash:free" ||
    model.startsWith("tokenharbor/")
  ) {
    const actualModel = model.replace("tokenharbor/", "");
    return { client: tokenHarborClient, model: actualModel, provider: "tokenharbor" };
  }

  // Route to NVIDIA NIM for GLM, MiniMax, or NVIDIA models
  if (
    model.includes("glm") ||
    model.includes("minimax") ||
    model.startsWith("z-ai/") ||
    model.startsWith("minimaxai/") ||
    model.startsWith("nvidia/")
  ) {
    const actualModel = model === "glm-5.2" ? "z-ai/glm-5.2" : model;
    return { client: nvidiaClient, model: actualModel, provider: "nvidia" };
  }

  // Route to TokenRouter if explicitly requested with slash or free
  if (
    model.startsWith("deepseek/") ||
    model.startsWith("qwen/qwen3.8") ||
    model.includes("free")
  ) {
    return { client: tokenRouterClient, model, provider: "tokenrouter" };
  }

  // Default: Alibaba Cloud DashScope (qwen3.7-max snapshots, qwen-plus, etc.)
  return { client: alibabaClient, model, provider: "alibaba" };
}

function isRetryableError(err: unknown): boolean {
  if (!err) return true;
  const anyErr = err as { status?: number; code?: string; message?: string };
  const msg = typeof anyErr.message === "string" ? anyErr.message.toLowerCase() : "";
  return (
    anyErr.status === 503 ||
    anyErr.status === 502 ||
    anyErr.status === 504 ||
    anyErr.status === 429 ||
    anyErr.status === 400 ||
    anyErr.code === "cache_admission_unavailable" ||
    anyErr.code === "AllocationQuotaExhausted" ||
    msg.includes("timeout") ||
    msg.includes("non-responsive") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("overloaded") ||
    msg.includes("admission is unavailable") ||
    msg.includes("rate limit") ||
    msg.includes("quota") ||
    msg.includes("exhausted") ||
    msg.includes("balance") ||
    msg.includes("503")
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 15000): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timeout ${timeoutMs}ms (Provider non-responsive)`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

async function executeWithFailover<T>(
  requestedModel: string | undefined,
  operation: (client: OpenAI, model: string) => Promise<T>
): Promise<T> {
  const primary = getClientAndModel(requestedModel);

  try {
    return await withTimeout(operation(primary.client, primary.model), 15000);
  } catch (err) {
    if (isRetryableError(err)) {
      console.warn(
        `[AI Client] Model ${primary.model} (${primary.provider}) failed/timed out: ${(err as Error)?.message || err}. Auto-switching immediately...`
      );

      // 1. If TokenRouter failed -> B.AI ➔ TokenHarbor ➔ MiMo ➔ Alibaba
      if (primary.provider === "tokenrouter") {
        try {
          console.info("[AI Client] Auto-Switch -> B.AI (deepseek-v4-flash)");
          return await withTimeout(operation(baiClient, "deepseek-v4-flash"), 15000);
        } catch {
          try {
            console.info("[AI Client] Auto-Switch -> TokenHarbor (deepseek-v4-flash:free)");
            return await withTimeout(operation(tokenHarborClient, "deepseek-v4-flash:free"), 15000);
          } catch {
            try {
              console.info("[AI Client] Auto-Switch -> TokenHarbor MiMo (mimo-v2.5:free)");
              return await withTimeout(operation(tokenHarborClient, "mimo-v2.5:free"), 15000);
            } catch {
              console.info("[AI Client] Auto-Switch -> Alibaba Qwen (qwen3.7-max-2026-05-20)");
              return await operation(alibabaClient, "qwen3.7-max-2026-05-20");
            }
          }
        }
      }

      // 2. If B.AI failed -> TokenHarbor DeepSeek ➔ MiMo ➔ Alibaba
      if (primary.provider === "bai") {
        try {
          console.info("[AI Client] Auto-Switch -> TokenHarbor (deepseek-v4-flash:free)");
          return await withTimeout(operation(tokenHarborClient, "deepseek-v4-flash:free"), 15000);
        } catch {
          try {
            console.info("[AI Client] Auto-Switch -> TokenHarbor MiMo (mimo-v2.5:free)");
            return await withTimeout(operation(tokenHarborClient, "mimo-v2.5:free"), 15000);
          } catch {
            console.info("[AI Client] Auto-Switch -> Alibaba Qwen (qwen3.7-max-2026-05-20)");
            return await operation(alibabaClient, "qwen3.7-max-2026-05-20");
          }
        }
      }

      // 3. If TokenHarbor failed -> B.AI ➔ Alibaba Qwen
      if (primary.provider === "tokenharbor") {
        try {
          console.info("[AI Client] Auto-Switch -> B.AI (deepseek-v4-flash)");
          return await withTimeout(operation(baiClient, "deepseek-v4-flash"), 15000);
        } catch {
          console.info("[AI Client] Auto-Switch -> Alibaba Qwen (qwen3.7-max-2026-05-20)");
          return await operation(alibabaClient, "qwen3.7-max-2026-05-20");
        }
      }

      // 4. If Alibaba Qwen failed -> try other snapshots ➔ B.AI ➔ TokenHarbor
      if (primary.provider === "alibaba") {
        for (const snapshot of ACTIVE_QWEN_SNAPSHOTS) {
          if (snapshot !== primary.model) {
            try {
              console.info(`[AI Client] Auto-Switch -> Alibaba Snapshot (${snapshot})`);
              return await withTimeout(operation(alibabaClient, snapshot), 15000);
            } catch {}
          }
        }

        try {
          console.info("[AI Client] Auto-Switch -> B.AI (deepseek-v4-flash)");
          return await withTimeout(operation(baiClient, "deepseek-v4-flash"), 15000);
        } catch {
          console.info("[AI Client] Auto-Switch -> TokenHarbor MiMo (mimo-v2.5:free)");
          return await operation(tokenHarborClient, "mimo-v2.5:free");
        }
      }

      // 5. Final fallback
      try {
        console.info("[AI Client] Final Auto-Switch -> B.AI (deepseek-v4-flash)");
        return await withTimeout(operation(baiClient, "deepseek-v4-flash"), 15000);
      } catch {
        return await operation(alibabaClient, "qwen3.7-max-2026-05-20");
      }
    }
    throw err;
  }
}

export async function streamChatCompletion(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number; model?: string }
) {
  return executeWithFailover(options?.model, async (client, model) => {
    return await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 8192,
      stream: true,
    });
  });
}

export async function chatCompletion(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number; model?: string }
) {
  return executeWithFailover(options?.model, async (client, model) => {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
      stream: false,
    });

    return response.choices[0]?.message?.content || "";
  });
}

export async function streamMultiTurnCompletion(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  options?: { temperature?: number; maxTokens?: number; model?: string }
) {
  return executeWithFailover(options?.model, async (client, model) => {
    return await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 8192,
      stream: true,
    });
  });
}
