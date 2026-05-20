import { streamChatCompletion } from "@/lib/ai-client";
import { SUMMARIZE_SYSTEM_PROMPT } from "@/lib/prompts";

export const dynamic = "force-dynamic";

interface QuestionAnswer {
  question: string;
  answer: string;
}

export async function POST(request: Request) {
  try {
    const { brief, answers } = (await request.json()) as {
      brief: string;
      answers: QuestionAnswer[];
    };

    if (!brief) {
      return Response.json({ error: "Brief diperlukan." }, { status: 400 });
    }

    const answersText = answers
      .map((qa, i) => `${i + 1}. ${qa.question}\n   Jawaban: ${qa.answer}`)
      .join("\n\n");

    const userMessage = `Brief awal user:\n"${brief}"\n\nJawaban atas pertanyaan klarifikasi:\n${answersText}\n\nBuat ringkasan pemahaman project berdasarkan informasi di atas.`;

    const stream = await streamChatCompletion(
      SUMMARIZE_SYSTEM_PROMPT,
      userMessage,
      { temperature: 0.5, maxTokens: 4096 }
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
    console.error("Summarize API error:", error);
    return Response.json(
      { error: "Gagal membuat ringkasan. Coba lagi." },
      { status: 500 }
    );
  }
}
