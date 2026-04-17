import { Camera, ExternalLink, Globe } from "lucide-react";

import { Card } from "@/components/ui/card";

export function AnalyzeImageResult({
  output,
}: {
  output: Record<string, unknown>;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5">
        <Camera className="h-4 w-4 text-[var(--cat-insurance)]" aria-hidden />
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--cat-insurance)]">
          Phân tích ảnh
          {output.type !== "general" &&
            ` · ${
              output.type === "toll_receipt"
                ? "Biên lai"
                : output.type === "license_plate"
                  ? "Biển số"
                  : "Biển báo"
            }`}
        </p>
      </div>
      <p className="mt-1.5 text-xs text-foreground/80">
        {output.analysis as string}
      </p>
    </Card>
  );
}

export function WebSearchResult({
  output,
}: {
  output: Record<string, unknown>;
}) {
  const results = output.results as {
    title: string;
    snippet: string;
    url: string;
  }[];
  if (results.length === 0) {
    return (
      <Card className="p-3 text-xs text-muted-foreground">
        {(output.message as string) ?? "Không tìm thấy kết quả."}
      </Card>
    );
  }
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5">
        <Globe className="h-4 w-4 text-info" aria-hidden />
        <p className="text-xs font-medium uppercase tracking-wide text-info">
          Kết quả tìm kiếm · {output.query as string}
        </p>
      </div>
      <ul className="mt-2 space-y-2">
        {results.slice(0, 4).map((r, i) => (
          <li key={i} className="text-xs">
            <p className="font-medium text-foreground/90 leading-snug">
              {r.title}
            </p>
            <p className="mt-0.5 text-muted-foreground line-clamp-2 leading-relaxed">
              {r.snippet}
            </p>
            {r.url && (
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 text-info hover:underline"
              >
                <ExternalLink className="h-3 w-3" aria-hidden />
                Xem thêm
              </a>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
