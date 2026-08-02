import { streamMultiTurnCompletion } from "@/lib/ai-client";

export const dynamic = "force-dynamic";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: Request) {
  try {
    const { prdContent, projectBrief, summary, messages, model } = (await request.json()) as {
      prdContent?: string;
      projectBrief?: string;
      summary?: any;
      messages: ChatMessage[];
      model?: string;
    };

    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        { error: "Array pesan diperlukan." },
        { status: 400 }
      );
    }

    // Filter valid messages to maintain clean multi-turn context
    const validMessages = messages
      .filter((m) => m && typeof m.content === "string" && m.content.trim().length > 0)
      .map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content.trim(),
      }));

    if (validMessages.length === 0) {
      return Response.json(
        { error: "Pesan tidak boleh kosong." },
        { status: 400 }
      );
    }

    const systemPrompt = `Anda adalah AI Technical Product Manager, System Architect, dan Senior Lead Engineer yang sangat berpengalaman.
Tugas utama Anda adalah menjawab pertanyaan, memberikan penjelasan mendalam, menyarankan peningkatan teknis, serta membantu pengguna memahami dan merancang dokumen PRD (Project Requirements Document).

${prdContent ? `--- KONTEKS DOKUMEN PRD AKTIF ---\n${prdContent}\n` : "--- PERHATIAN: DOKUMEN PRD BELUM DIGENERATE/MASIH DALAM TAHAP IDEASI ---"}

${projectBrief ? `--- BRIEF AWAL PROYEK ---\n${projectBrief}\n` : ""}
${summary ? `--- RINGKASAN DISKUSI ---\n${JSON.stringify(summary, null, 2)}\n` : ""}

PANDUAN UTAMA DALAM MENJAWAB:
1. PERHATIKAN SELURUH RIWAYAT PERCAKAPAN: Anda HARUS mengingat dan merujuk pada riwayat percakapan sebelumnya. Jika pengguna mengajukan pertanyaan lanjutan (misalnya: "jelaskan lebih detail", "bagaimana alur database-nya?", "apa alternatifnya?", "apa maksud dari poin 2?"), Anda WAJIB menjawab dengan mengaitkan secara kontekstual pada percakapan yang sudah terjadi.
2. Jika dokumen PRD sudah ada di atas, selalu jadikan PRD tersebut sebagai acuan utama untuk menjaga konsistensi arsitektur dan spesifikasi produk.
3. Jawablah menggunakan bahasa Indonesia yang profesional, ramah, dan solutif.
4. Gunakan format Markdown yang rapi (list, bold, code block \`\`\`, tabel) jika menjelaskan struktur data, alur teknis, atau alur aplikasi.
5. Berikan jawaban yang relevan, mendalam, dan langsung menjawab kebutuhan pengguna.`;

    const stream = await streamMultiTurnCompletion(
      systemPrompt,
      validMessages,
      { temperature: 0.7, maxTokens: 4096, model }
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
    console.error("Chat PRD API error:", error);
    return Response.json(
      { error: "Gagal memproses pesan AI. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
