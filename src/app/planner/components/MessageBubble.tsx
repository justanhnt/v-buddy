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

  // Deduplicate: for tools that can appear multiple times (search_places,
  // get_nearby), only show the LAST completed result to avoid duplicate cards.
  const DEDUP_TOOLS = new Set(["search_places", "get_nearby", "search_along_route", "weather_along_route"]);
  const lastToolIdx = new Map<string, number>();
  message.parts.forEach((part, idx) => {
    if (
      typeof part.type === "string" &&
      part.type.startsWith("tool-") &&
      "state" in part &&
      part.state === "output-available"
    ) {
      const toolName = part.type.replace("tool-", "");
      if (DEDUP_TOOLS.has(toolName)) {
        lastToolIdx.set(toolName, idx);
      }
    }
  });

  return (
    <li className="flex min-w-0 max-w-[92%] flex-col gap-2">
      {message.parts.map((part, idx) => {
        if (part.type === "text" && part.text) {
          return (
            <div
              key={idx}
              className={cn(
                "prose-chat min-w-0 max-w-full self-start overflow-hidden rounded-2xl rounded-bl-md bg-card px-3.5 py-2.5 text-sm text-card-foreground border border-border shadow-sm",
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
          // Skip earlier duplicate tool results
          const toolName = part.type.replace("tool-", "");
          if (
            DEDUP_TOOLS.has(toolName) &&
            part.state === "output-available" &&
            lastToolIdx.get(toolName) !== idx
          ) {
            return null;
          }

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
