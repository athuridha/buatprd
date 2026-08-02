import { streamChatCompletion } from "@/lib/ai-client";
import { GENERATE_INSTRUCTION_SYSTEM_PROMPT } from "@/lib/prompts";

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
- Masalah Utama: ${summary.mainProblem}
- Solusi Utama: ${summary.mainSolution}
- Framework/Stack Pilihan: ${summary.frameworkPreference || "Terbaik"}
- Catatan Teknis: ${summary.technicalNotes}`
    : ""
}

Buatlah dokumen INSTRUCTIONS.md (panduan agen AI coding) secara sangat spesifik dan detail untuk project ini.`;

    const stream = await streamChatCompletion(
      GENERATE_INSTRUCTION_SYSTEM_PROMPT,
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
    console.error("Generate INSTRUCTIONS API error:", error);
    return Response.json(
      { error: "Gagal generate INSTRUCTIONS.md. Coba lagi." },
      { status: 500 }
    );
  }
}
