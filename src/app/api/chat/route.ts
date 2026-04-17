import {
  streamText,
  UIMessage,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import { textModel } from "@/lib/dashscope";
import { tools } from "@/lib/tools";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import { trimMessagesForModel } from "@/lib/chat/trim-messages";

export async function POST(req: Request) {
  const { messages, userLocation } = (await req.json()) as {
    messages: UIMessage[];
    userLocation?: { lat: number; lng: number; name: string | null };
  };

  const trimmed = trimMessagesForModel(messages);

  const modelMessages = await convertToModelMessages(trimmed, {
    tools,
  });

  const system = buildSystemPrompt(userLocation);

  const result = streamText({
    model: textModel,
    system,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(12),
  });

  return result.toUIMessageStreamResponse();
}
