"use client";

import type { UIMessage } from "ai";
import type { ComponentPropsWithoutRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/cn";

import type { LngLat } from "../types";
import { ToolResult } from "./ToolResult";

const mdComponents = {
  table: (props: ComponentPropsWithoutRef<"table">) => (
    <div className="table-wrap">
      <table {...props} />
    </div>
  ),
};

interface MessageBubbleProps {
  message: UIMessage;
  onPickPlace: (c: LngLat) => void;
  onSelectRoute: (idx: number) => void;
  selectedRouteIdx: number;
}

export function MessageBubble({
  message,
  onPickPlace,
  onSelectRoute,
  selectedRouteIdx,
}: MessageBubbleProps) {
  if (message.role === "user") {
    const text = message.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
    return (
      <li className="self-end max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm text-primary-foreground shadow-sm">
        {text}
      </li>
    );
  }

  return (
    <li className="flex max-w-[92%] flex-col gap-2">
      {message.parts.map((part, idx) => {
        if (part.type === "text" && part.text) {
          return (
            <div
              key={idx}
              className={cn(
                "prose-chat self-start overflow-hidden rounded-2xl rounded-bl-md bg-card px-3.5 py-2.5 text-sm text-card-foreground border border-border shadow-sm",
              )}
            >
              <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>{part.text}</Markdown>
            </div>
          );
        }

        if (part.type === "step-start" || part.type === "reasoning") {
          return null;
        }

        if (
          typeof part.type === "string" &&
          part.type.startsWith("tool-") &&
          "state" in part
        ) {
          return (
            <ToolResult
              key={idx}
              part={part}
              onPickPlace={onPickPlace}
              onSelectRoute={onSelectRoute}
              selectedRouteIdx={selectedRouteIdx}
            />
          );
        }

        return null;
      })}
    </li>
  );
}
