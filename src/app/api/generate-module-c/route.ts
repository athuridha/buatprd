import { streamChatCompletion } from "@/lib/ai-client";
import { GENERATE_MODULE_C_SYSTEM_PROMPT } from "@/lib/prompts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { brief, summary } = await request.json();

    if (!brief) {
      return Response.json({ error: "Brief diperlukan." }, { status: 400 });
    }

    const userMessage = `Berikut informasi project dari user:

Brief User:
"${brief}"

${
  summary
    ? `Ringkasan Project:
- Jenis Project: ${summary.projectType}
- Target User: ${summary.targetUser}
- Framework/Stack Pilihan: ${summary.frameworkPreference || "Terbaik"}
- Fitur MVP: ${summary.mvpFeatures?.join(", ")}`
    : ""
}

Buatlah Modul C: Vibe Coding Master Prompts dengan 4 master prompt terpisah (Prompt 1 Setup, Prompt 2 Backend, Prompt 3 Frontend UI, Prompt 4 Polish & Test).`;

    const stream = await streamChatCompletion(
      GENERATE_MODULE_C_SYSTEM_PROMPT,
      userMessage,
      { temperature: 0.6, maxTokens: 4096 }
    );

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Generate Module C API error:", error);
    return Response.json(
      { error: "Gagal generate Modul C. Coba lagi." },
      { status: 500 }
    );
  }
}
