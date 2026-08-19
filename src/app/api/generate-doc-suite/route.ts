import { streamChatCompletion, chatCompletion } from "@/lib/ai-client";
import { getDocPrompt, DOC_SUITE_FILES } from "@/lib/doc-suite-prompts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { prdContent, projectBrief, targetFile, model } = body as {
      prdContent: string;
      projectBrief?: string;
      targetFile: string;
      model?: string;
    };

    if (!prdContent || typeof prdContent !== "string") {
      return Response.json(
        { error: "Konten PRD diperlukan untuk membuat dokumentasi suite." },
        { status: 400 }
      );
    }

    const fileSpec = DOC_SUITE_FILES.find((f) => f.filename === targetFile);
    if (!fileSpec) {
      return Response.json(
        { error: `File dokumentasi ${targetFile} tidak valid.` },
        { status: 400 }
      );
    }

    const systemPrompt = getDocPrompt(targetFile, prdContent, projectBrief);
    const userMsg = `Tolong buatkan dokumen ${targetFile} secara sangat detail, profesional, lengkap, dan berstruktur rapi sesuai instruksi di atas.`;

    const stream = await streamChatCompletion(systemPrompt, userMsg, {
      temperature: 0.4,
      maxTokens: 8192,
      model: model || "deepseek-v4-flash",
    });

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
  } catch (err) {
    console.error("Generate Doc Suite error:", err);
    return Response.json(
      { error: "Gagal membuat dokumen suite. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
