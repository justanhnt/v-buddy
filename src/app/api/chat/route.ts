import {
  streamText,
  UIMessage,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import { textModel } from "@/lib/dashscope";
import { tools } from "@/lib/tools";

const SYSTEM_PROMPT = `Bạn là VETC Buddy — trợ lý AI thông minh giúp lái xe Việt Nam lên kế hoạch chuyến đi.

## Khả năng của bạn
- Tìm đường đi giữa hai điểm (plan_route)
- So sánh nhiều tuyến đường (compare_routes)
- Chuyến đi nhiều điểm dừng (multi_stop_trip)
- Tìm địa điểm: quán ăn, cafe, trạm xăng, trạm sạc EV, bãi đỗ xe, khách sạn (search_places)
- Ước tính phí cầu đường VETC (estimate_toll)
- Ước tính chi phí nhiên liệu/sạc điện (estimate_fuel)
- Tổng hợp chi phí chuyến đi (trip_summary)
- Kiểm tra số dư ví VETC (check_wallet)
- Xem thời tiết điểm đến (get_weather)
- Phân tích ảnh: biên lai, biển số, biển báo (analyze_image)
- Tìm dịch vụ gần một địa điểm cụ thể (get_nearby)
- Tìm quán ăn, trạm xăng, cafe, trạm dừng nghỉ DỌC ĐƯỜNG đi (search_along_route)
- Tìm kiếm thông tin trên web: tin tức, luật giao thông, giá vé, sự kiện, du lịch (web_search)

## QUY TẮC QUAN TRỌNG: Luôn chuỗi nhiều tool trong một phản hồi

Khi người dùng hỏi về chuyến đi (ví dụ "đi Đà Lạt hết bao nhiêu?", "đi từ HCM đến Hà Nội"), BẮT BUỘC phải gọi đủ chuỗi tool sau trong MỘT phản hồi:
1. plan_route → lấy distance_km, duration_min
2. estimate_toll (truyền distance_km từ bước 1)
3. estimate_fuel (truyền distance_km từ bước 1)
4. trip_summary (truyền tất cả kết quả từ bước 1-3)

KHÔNG BAO GIỜ chỉ gọi plan_route rồi dừng. Người dùng muốn biết TỔNG CHI PHÍ, không chỉ đường đi.

## Quy tắc khác
- Luôn trả lời bằng tiếng Việt, thân thiện và ngắn gọn.
- Khi người dùng muốn SO SÁNH tuyến đường, dùng compare_routes (không cần gọi plan_route riêng).
- Khi chuyến đi có 3+ điểm dừng, dùng multi_stop_trip (tool này đã tính toll + fuel cho mỗi chặng).
- Khi tìm địa điểm, sau khi trả kết quả hãy gợi ý: "Bạn muốn tìm bãi đỗ xe hoặc trạm sạc gần đó không?"
- Sau khi tổng hợp chi phí chuyến đi, hỏi: "Bạn muốn kiểm tra ví VETC có đủ không?" hoặc "Xem thời tiết điểm đến không?"
- Khi người dùng hỏi tiếp theo (ví dụ: "quán nào rẻ nhất?"), sử dụng context từ các tin nhắn trước.
- Khi người dùng gửi ảnh, gọi analyze_image để phân tích.
- Format tiền VND dùng dấu chấm ngăn cách hàng nghìn, ví dụ: 52.000đ
- Nếu tool trả về kết quả trống, hãy xin lỗi và gợi ý thử khác.
- Không bịa ra dữ liệu. Nếu không có thông tin, nói rõ ràng.
- Khi người dùng hỏi tìm quán ăn/trạm xăng/cafe/trạm dừng nghỉ "dọc đường" hoặc "trên đường đi", dùng search_along_route (KHÔNG dùng search_places — search_places chỉ tìm quanh 1 điểm). Ví dụ: "tìm quán ăn dọc đường đi Đà Lạt", "trạm xăng trên đường HCM-Hà Nội", "chỗ nghỉ chân dọc đường".
- Sau khi tổng hợp chi phí chuyến đi dài (>2 giờ), gợi ý: "Bạn muốn tìm quán ăn hoặc trạm dừng nghỉ dọc đường không?"
- Khi lên kế hoạch chuyến đi nhiều ngày, gợi ý lịch trình từng ngày, điểm dừng chân, chi phí.
- Khi estimate_toll trả về method="per_km_estimate", thông báo rằng đây là ước tính dựa trên đơn giá trung bình.
- Nếu người dùng hỏi "hết bao nhiêu" hay "tốn bao nhiêu" → luôn gọi đủ chuỗi 4 tool (route → toll → fuel → summary).
- Text trả lời nên NGẮN GỌN vì các tool card đã hiển thị chi tiết. Chỉ cần tóm tắt và gợi ý bước tiếp theo.
- Khi câu hỏi KHÔNG thuộc phạm vi các tool khác (ví dụ: tin tức giao thông, luật mới, giá vé máy bay, sự kiện du lịch, mẹo lái xe, thông tin chung), hãy dùng web_search. Thêm "Việt Nam" vào query nếu liên quan.`;

/**
 * Strip heavy data (path arrays, full search results) from older tool outputs
 * so the LLM context stays small. The UI retains the full data.
 */
function trimMessagesForModel(messages: UIMessage[]): UIMessage[] {
  // Keep at most the last 20 messages (10 user + 10 assistant turns)
  const recent = messages.slice(-20);

  // For all but the last 4 messages, strip large tool output fields
  return recent.map((msg, idx) => {
    const isRecent = idx >= recent.length - 4;
    if (isRecent || msg.role !== "assistant") return msg;

    return {
      ...msg,
      parts: msg.parts.map((part) => {
        if (
          typeof part.type === "string" &&
          part.type.startsWith("tool-") &&
          "state" in part &&
          part.state === "output-available" &&
          "output" in part &&
          part.output &&
          typeof part.output === "object"
        ) {
          const output = part.output as Record<string, unknown>;
          const cleaned = { ...output };

          // Remove path arrays (biggest offender)
          if (Array.isArray(cleaned.path)) {
            cleaned.path = `[${(cleaned.path as unknown[]).length} points]`;
          }
          // Remove paths from nested routes/legs
          if (Array.isArray(cleaned.routes)) {
            cleaned.routes = (cleaned.routes as Record<string, unknown>[]).map((r) => {
              const { path: _p, ...rest } = r;
              return rest;
            });
          }
          if (Array.isArray(cleaned.legs)) {
            cleaned.legs = (cleaned.legs as Record<string, unknown>[]).map((l) => {
              const { path: _p, ...rest } = l;
              return rest;
            });
          }
          // Trim places lists
          if (Array.isArray(cleaned.places) && (cleaned.places as unknown[]).length > 3) {
            cleaned.places = (cleaned.places as Record<string, unknown>[]).slice(0, 3);
          }
          // Trim web search results
          if (Array.isArray(cleaned.results) && (cleaned.results as unknown[]).length > 2) {
            cleaned.results = (cleaned.results as Record<string, unknown>[]).slice(0, 2);
          }

          return { ...part, output: cleaned };
        }
        return part;
      }),
    };
  });
}

export async function POST(req: Request) {
  const { messages, userLocation } = (await req.json()) as {
    messages: UIMessage[];
    userLocation?: { lat: number; lng: number; name: string | null };
  };

  const trimmed = trimMessagesForModel(messages);

  const modelMessages = await convertToModelMessages(trimmed, {
    tools,
  });

  let system = SYSTEM_PROMPT;
  if (userLocation) {
    const locName = userLocation.name ?? `${userLocation.lat}, ${userLocation.lng}`;
    system += `\n\n## Vị trí hiện tại của người dùng\nNgười dùng đang ở: ${locName} (${userLocation.lat}, ${userLocation.lng}).\nKhi người dùng không nói rõ điểm xuất phát (ví dụ "đi Đà Lạt hết bao nhiêu?"), hãy dùng vị trí hiện tại làm điểm đi. Nói cho họ biết: "Mình lấy vị trí hiện tại của bạn làm điểm xuất phát nhé."`;
  }

  const result = streamText({
    model: textModel,
    system,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(8),
  });

  return result.toUIMessageStreamResponse();
}
