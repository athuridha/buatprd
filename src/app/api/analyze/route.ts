import { streamChatCompletion } from "@/lib/ai-client";
import { ANALYZE_SYSTEM_PROMPT } from "@/lib/prompts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { brief } = await request.json();

    if (!brief || typeof brief !== "string" || brief.trim().length < 10) {
      return Response.json(
        { error: "Brief terlalu pendek. Minimal 10 karakter." },
        { status: 400 }
      );
    }

    const stream = await streamChatCompletion(
      ANALYZE_SYSTEM_PROMPT,
      `Berikut brief project dari user:\n\n"${brief.trim()}"\n\nAnalisis brief ini dan buat pertanyaan klarifikasi yang spesifik.`,
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
    console.error("Analyze API error:", error);
    return Response.json(
      { error: "Gagal menganalisis brief. Coba lagi." },
      { status: 500 }
    );
  }
}
