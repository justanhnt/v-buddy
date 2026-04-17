import { createOpenAI } from "@ai-sdk/openai";

const dashscope = createOpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY!,
  baseURL:
    process.env.DASHSCOPE_BASE_URL ??
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
});

export const textModel = dashscope(
  process.env.DASHSCOPE_MODEL ?? "qwen3.5-flash",
);

export const visionModel = dashscope(
  process.env.DASHSCOPE_VISION_MODEL ?? "qwen-vl-max",
);
