import { tool, generateText } from "ai";
import { z } from "zod";
import { checkWallet } from "../wallet-mock";
import { getTripHistory } from "../trip-history-mock";
import { visionModel } from "../dashscope";

export const check_wallet = tool({
  description:
    "Kiểm tra số dư ví VETC. Dùng khi người dùng hỏi số dư ví, hoặc sau khi tính tổng chi phí chuyến đi để xem có đủ tiền không.",
  inputSchema: z.object({
    purpose: z
      .enum(["balance_check", "trip_affordability"])
      .optional()
      .default("balance_check")
      .describe("Mục đích kiểm tra"),
    trip_cost_vnd: z
      .number()
      .optional()
      .describe("Tổng chi phí chuyến đi (VND) để so sánh với số dư"),
  }),
  execute: async ({ trip_cost_vnd }) => {
    return checkWallet(trip_cost_vnd);
  },
});

export const analyze_image = tool({
  description:
    "Phân tích ảnh: biên lai thu phí, biển số xe, biển báo giao thông, hoặc bất kỳ ảnh liên quan đến lái xe. Dùng khi người dùng gửi ảnh trong chat.",
  inputSchema: z.object({
    image_url: z.string().describe("URL hoặc base64 data URI của ảnh"),
    context: z.string().optional().describe("Ngữ cảnh bổ sung từ cuộc hội thoại"),
  }),
  execute: async ({ image_url, context }) => {
    const prompt = context
      ? `Ngữ cảnh: ${context}\n\nPhân tích ảnh này. Nếu là biên lai thu phí đường bộ, trích xuất: tên trạm, số tiền, biển số xe, thời gian. Nếu là biển số xe, đọc số. Nếu là biển báo, mô tả ý nghĩa. Trả lời bằng tiếng Việt.`
      : "Phân tích ảnh này. Nếu là biên lai thu phí đường bộ, trích xuất: tên trạm, số tiền, biển số xe, thời gian. Nếu là biển số xe, đọc số. Nếu là biển báo, mô tả ý nghĩa. Trả lời bằng tiếng Việt.";

    try {
      const result = await generateText({
        model: visionModel,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image", image: image_url },
            ],
          },
        ],
      });

      // Try to detect the type of image from the response
      const text = result.text;
      let type: "toll_receipt" | "license_plate" | "road_sign" | "general" = "general";
      if (/trạm|thu phí|biên lai|toll/i.test(text)) type = "toll_receipt";
      else if (/biển số|license|plate/i.test(text)) type = "license_plate";
      else if (/biển báo|sign|cấm|tốc độ/i.test(text)) type = "road_sign";

      return { type, analysis: text };
    } catch {
      return {
        type: "general" as const,
        analysis: "Không thể phân tích ảnh lúc này. Vui lòng thử lại.",
        error: true,
      };
    }
  },
});

export const check_trip_history = tool({
  description:
    "Xem lịch sử chuyến đi gần đây. Dùng khi người dùng hỏi về các chuyến đi trước, chi phí đã chi, hoặc muốn so sánh với chuyến đi mới.",
  inputSchema: z.object({
    limit: z
      .number()
      .optional()
      .default(5)
      .describe("Số chuyến đi muốn xem (tối đa 6)"),
  }),
  execute: async ({ limit }) => {
    return getTripHistory(limit);
  },
});

export const web_search = tool({
  description:
    "Tìm kiếm thông tin trên web. Dùng khi các tool khác không đủ trả lời, ví dụ: tin tức giao thông, giá vé, luật mới, sự kiện, thông tin du lịch, hoặc bất kỳ câu hỏi nào ngoài khả năng của các tool hiện có.",
  inputSchema: z.object({
    query: z.string().describe("Từ khóa tìm kiếm, nên thêm 'Việt Nam' nếu liên quan đến VN"),
    lang: z.enum(["vi", "en"]).optional().default("vi").describe("Ngôn ngữ kết quả"),
  }),
  execute: async ({ query, lang }) => {
    try {
      // DuckDuckGo instant answer API (free, no key)
      const url = new URL("https://api.duckduckgo.com/");
      url.searchParams.set("q", query);
      url.searchParams.set("format", "json");
      url.searchParams.set("no_html", "1");
      url.searchParams.set("skip_disambig", "1");
      url.searchParams.set("kl", lang === "vi" ? "vn-vi" : "us-en");

      const res = await fetch(url, {
        headers: { "User-Agent": "VETCBuddy/1.0 (vetc-buddy hackathon)" },
        signal: AbortSignal.timeout(8_000),
      });
      const data = await res.json();

      const results: { title: string; snippet: string; url: string }[] = [];

      // Abstract (Wikipedia-style summary)
      if (data.AbstractText) {
        results.push({
          title: data.Heading ?? query,
          snippet: data.AbstractText,
          url: data.AbstractURL ?? "",
        });
      }

      // Answer (direct factual answer)
      if (data.Answer) {
        results.push({
          title: "Trả lời nhanh",
          snippet: String(data.Answer),
          url: "",
        });
      }

      // Related topics
      if (Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics.slice(0, 5)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(" - ")[0] ?? topic.Text,
              snippet: topic.Text,
              url: topic.FirstURL,
            });
          }
          // Handle subtopics
          if (Array.isArray(topic.Topics)) {
            for (const sub of topic.Topics.slice(0, 2)) {
              if (sub.Text && sub.FirstURL) {
                results.push({
                  title: sub.Text.split(" - ")[0] ?? sub.Text,
                  snippet: sub.Text,
                  url: sub.FirstURL,
                });
              }
            }
          }
        }
      }

      if (results.length === 0) {
        return {
          query,
          results: [],
          message: `Không tìm thấy kết quả cho "${query}". Thử dùng từ khóa khác.`,
        };
      }

      return {
        query,
        results: results.slice(0, 6),
      };
    } catch {
      return {
        query,
        results: [],
        error: true,
        message: "Không thể tìm kiếm lúc này. Vui lòng thử lại.",
      };
    }
  },
});
