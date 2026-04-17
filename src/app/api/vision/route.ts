import { generateText } from "ai";
import { visionModel } from "@/lib/dashscope";

const DEFAULT_PROMPT =
  "Phân tích ảnh này. Nếu là biên lai thu phí đường bộ, trích xuất: tên trạm, số tiền, biển số xe, thời gian. Nếu là ảnh khác, mô tả nội dung liên quan đến giao thông/lái xe.";

export async function POST(req: Request) {
  const { image, prompt } = (await req.json()) as {
    image: string; // base64 data URI or URL
    prompt?: string;
  };

  if (!image) {
    return Response.json({ error: "Thiếu ảnh" }, { status: 400 });
  }

  const result = await generateText({
    model: visionModel,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt ?? DEFAULT_PROMPT },
          { type: "image", image },
        ],
      },
    ],
  });

  return Response.json({ text: result.text });
}
