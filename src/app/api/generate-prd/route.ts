import { streamChatCompletion } from "@/lib/ai-client";
import { GENERATE_PRD_SYSTEM_PROMPT } from "@/lib/prompts";

export const dynamic = "force-dynamic";

interface SummaryData {
  projectType: string;
  targetUser: string;
  mainProblem: string;
  mainSolution: string;
  platform: string;
  frameworkPreference?: string;
  userRoles: string[];
  mvpFeatures: string[];
  mainData: string[];
  technicalNotes: string;
}

export async function POST(request: Request) {
  try {
    const { brief, summary, skipQuestions } = (await request.json()) as {
      brief: string;
      summary?: SummaryData;
      skipQuestions?: boolean;
    };

    if (!brief) {
      return Response.json({ error: "Brief diperlukan." }, { status: 400 });
    }

    let userMessage: string;

    if (skipQuestions) {
      userMessage = `User meminta PRD langsung tanpa menjawab pertanyaan klarifikasi.

Brief user:
"${brief}"

Buat PRD lengkap berdasarkan brief ini. Karena beberapa detail belum dijelaskan, buat asumsi yang masuk akal dan tulis di bagian ## Assumptions di awal PRD.`;
    } else if (summary) {
      userMessage = `Berikut ringkasan project yang sudah dikonfirmasi user:

- Jenis Project: ${summary.projectType}
- Target User: ${summary.targetUser}
- Masalah Utama: ${summary.mainProblem}
- Solusi Utama: ${summary.mainSolution}
- Platform: ${summary.platform}
- Framework / Tech Stack Pilihan User: ${summary.frameworkPreference || "Sesuai rekomendasi terbaik"}
- User Role: ${summary.userRoles.join(", ")}
- Fitur MVP: ${summary.mvpFeatures.join(", ")}
- Data Utama: ${summary.mainData.join(", ")}
- Catatan Teknis: ${summary.technicalNotes}

Brief awal user:
"${brief}"

Buat PRD final lengkap berdasarkan informasi di atas. Ikuti format PRD yang sudah ditentukan dengan semua 11 section termasuk Mermaid diagram.`;
    } else {
      return Response.json(
        { error: "Summary atau skipQuestions diperlukan." },
        { status: 400 }
      );
    }

    const stream = await streamChatCompletion(
      GENERATE_PRD_SYSTEM_PROMPT,
      userMessage,
      { temperature: 0.6, maxTokens: 8192 }
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
    console.error("Generate PRD API error:", error);
    return Response.json(
      { error: "Gagal generate PRD. Coba lagi." },
      { status: 500 }
    );
  }
}
