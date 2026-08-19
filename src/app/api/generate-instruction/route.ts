import { streamChatCompletion } from "@/lib/ai-client";
import { GENERATE_INSTRUCTION_SYSTEM_PROMPT } from "@/lib/prompts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { brief, summary, prdContent, model } = await request.json();

    if (!brief && !prdContent) {
      return Response.json({ error: "Brief atau konten PRD diperlukan." }, { status: 400 });
    }

    let userMessage = `Berikut informasi lengkap project untuk penyusunan INSTRUCTIONS.md (Panduan Eksekusi & Runbook Implementasi Proyek):\n\n`;
    if (brief) {
      userMessage += `### Brief Awal User:\n"${brief}"\n\n`;
    }
    if (summary) {
      userMessage += `### Ringkasan Konfirmasi Project:
- Jenis Project: ${summary.projectType}
- Target User: ${summary.targetUser}
- Masalah Utama: ${summary.mainProblem}
- Solusi Utama: ${summary.mainSolution}
- Framework/Stack Pilihan: ${summary.frameworkPreference || "Terbaik"}
- Catatan Teknis: ${summary.technicalNotes}\n\n`;
    }
    if (prdContent) {
      userMessage += `### Dokumen PRD Lengkap:\n\`\`\`markdown\n${prdContent}\n\`\`\`\n\n`;
    }

    userMessage += `Berdasarkan seluruh informasi arsitektur dan spesifikasi PRD di atas, susunlah dokumen **INSTRUCTIONS.md** (panduan langkah-demi-langkah implementasi proyek untuk developer dan tim) secara sangat terstruktur, jelas, dan siap pakai.`;

    const stream = await streamChatCompletion(
      GENERATE_INSTRUCTION_SYSTEM_PROMPT,
      userMessage,
      { temperature: 0.6, maxTokens: 8192, model }
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
