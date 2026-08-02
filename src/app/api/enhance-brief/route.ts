import { streamChatCompletion } from "@/lib/ai-client";
import { ENHANCE_BRIEF_SYSTEM_PROMPT } from "@/lib/prompts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { brief } = await request.json();

    if (!brief || typeof brief !== "string" || brief.trim().length === 0) {
      return Response.json(
        { error: "Brief awal diperlukan untuk diperkaya." },
        { status: 400 }
      );
    }

    const stream = await streamChatCompletion(
      ENHANCE_BRIEF_SYSTEM_PROMPT,
      `Berikut brief singkat dari user:\n"${brief.trim()}"\n\nSempurnakan dan perkaya brief ini.`,
      { temperature: 0.7, maxTokens: 1024 }
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
    console.error("Enhance brief API error:", error);
    return Response.json(
      { error: "Gagal memperkaya brief. Coba lagi." },
      { status: 500 }
    );
  }
}
