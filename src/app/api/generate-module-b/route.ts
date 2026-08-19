import { streamChatCompletion } from "@/lib/ai-client";
import { GENERATE_MODULE_B_SYSTEM_PROMPT } from "@/lib/prompts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { brief, summary, prdContent, model } = await request.json();

    if (!brief && !prdContent) {
      return Response.json({ error: "Brief atau PRD diperlukan." }, { status: 400 });
    }

    let userMessage = `Berikut informasi project dari user:\n\n`;
    if (brief) userMessage += `Brief User:\n"${brief}"\n\n`;
    if (summary) {
      userMessage += `Ringkasan Project:
- Jenis Project: ${summary.projectType}
- User Role: ${summary.userRoles?.join(", ")}
- Fitur MVP: ${summary.mvpFeatures?.join(", ")}
- Data Utama: ${summary.mainData?.join(", ")}\n\n`;
    }
    if (prdContent) {
      userMessage += `PRD Context:\n${prdContent.slice(0, 3000)}\n\n`;
    }

    userMessage += `Buatlah Modul B: API Route & Endpoint Specifications secara sangat detail mencakup tabel endpoint, sample JSON request body, dan sample JSON response body.`;

    const stream = await streamChatCompletion(
      GENERATE_MODULE_B_SYSTEM_PROMPT,
      userMessage,
      { temperature: 0.6, maxTokens: 4096, model }
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
    console.error("Generate Module B API error:", error);
    return Response.json(
      { error: "Gagal generate Modul B. Coba lagi." },
      { status: 500 }
    );
  }
}
