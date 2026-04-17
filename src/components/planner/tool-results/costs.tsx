import { Receipt, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { VND } from "@/lib/format";

export function EstimateTollResult({
  output,
}: {
  output: Record<string, unknown>;
}) {
  if (!output.estimated) {
    return (
      <Card className="p-3">
        <div className="flex items-center gap-1.5">
          <Receipt className="h-3.5 w-3.5 text-warning" aria-hidden />
          <p className="text-xs font-medium uppercase tracking-wide text-warning-foreground dark:text-warning">
            Phí cầu đường VETC
          </p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {(output.message as string) ??
            "Chưa có dữ liệu phí cho tuyến này."}
        </p>
      </Card>
    );
  }
  const gates = output.gates as { name: string; fee: number }[];
  const isEstimate = output.method === "per_km_estimate";
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5">
        <Receipt className="h-3.5 w-3.5 text-warning" aria-hidden />
        <p className="text-xs font-medium uppercase tracking-wide text-warning-foreground dark:text-warning">
          Phí cầu đường VETC
          {isEstimate ? " (ước tính)" : ""}
        </p>
      </div>
      <div className="mt-1.5 space-y-1">
        {gates.map((g, i) => (
          <div
            key={i}
            className="flex justify-between text-xs text-foreground/80"
          >
            <span>{g.name}</span>
            <span className="font-medium">{VND(g.fee)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-border pt-1 text-sm font-semibold">
          <span>Tổng</span>
          <span>{VND(output.toll_vnd as number)}</span>
        </div>
        {isEstimate && typeof output.note === "string" && (
          <p className="text-xs text-muted-foreground">{output.note}</p>
        )}
      </div>
    </Card>
  );
}

export function EstimateFuelResult({
  output,
}: {
  output: Record<string, unknown>;
}) {
  return (
    <Card className="p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--cat-charge)]">
        Chi phí nhiên liệu
      </p>
      <div className="mt-1 text-xs text-foreground/80">
        <p>
          {output.distance_km as number} km · {output.fuel_type as string} ·{" "}
          {output.consumption_per_100km as number}
          {(output.fuel_type as string) === "electric" ? " kWh" : "L"}/100km
        </p>
        <p className="mt-0.5">
          {output.total_units as number} {output.unit as string} ×{" "}
          {VND(output.price_per_unit as number)}/{output.unit as string}
        </p>
        <p className="mt-1 text-sm font-semibold">
          = {VND(output.cost_vnd as number)}
        </p>
      </div>
    </Card>
  );
}

export function TripSummaryResult({
  output,
}: {
  output: Record<string, unknown>;
}) {
  const breakdown = output.breakdown as {
    label: string;
    amount_vnd: number;
  }[];
  const total = output.total_vnd as number;
  return (
    <Card className="p-4 bg-gradient-to-br from-[color-mix(in_oklch,var(--primary)_12%,var(--card))] to-[color-mix(in_oklch,var(--cat-parking)_12%,var(--card))]">
      <div className="flex items-center gap-1.5">
        <Receipt className="h-4 w-4 text-primary" aria-hidden />
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          Tổng chi phí chuyến đi
        </p>
      </div>
      <p className="mt-1 text-sm font-medium">
        {output.from as string} → {output.to as string}
      </p>
      <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
        <span>{output.distance_km as number} km</span>
        <span>{output.duration_min as number} phút</span>
      </div>
      <div className="mt-2 space-y-1">
        {breakdown.map((b, i) => (
          <div
            key={i}
            className="flex justify-between text-xs text-foreground/80"
          >
            <span>{b.label}</span>
            <span className="font-medium">{VND(b.amount_vnd)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-border pt-1.5 text-base font-bold text-primary">
          <span>Tổng cộng</span>
          <span>{VND(total)}</span>
        </div>
      </div>
      {typeof output.tip === "string" && (
        <p className="mt-2 text-xs text-muted-foreground">{output.tip}</p>
      )}
    </Card>
  );
}

export function CheckWalletResult({
  output,
}: {
  output: Record<string, unknown>;
}) {
  const canAfford = output.can_afford_trip as boolean | null;
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5">
        <Wallet className="h-4 w-4 text-info" aria-hidden />
        <p className="text-xs font-medium uppercase tracking-wide text-info">
          Ví VETC
        </p>
      </div>
      <p className="mt-1 text-lg font-bold text-info">
        {VND(output.balance_vnd as number)}
      </p>
      {canAfford != null && (
        <Badge
          variant={canAfford ? "success" : "danger"}
          className="mt-1.5"
        >
          {canAfford ? "\u2713" : "\u2717"}
          <span>
            {canAfford
              ? "Đủ tiền cho chuyến đi"
              : ((output.top_up_suggestion as string) ??
                `Thiếu ${VND(output.shortfall_vnd as number)}`)}
          </span>
        </Badge>
      )}
      {Array.isArray(output.recent_transactions) &&
      (output.recent_transactions as Record<string, unknown>[]).length > 0 ? (
        <div className="mt-2">
          <p className="text-xs font-medium text-muted-foreground">
            Giao dịch gần đây
          </p>
          <ul className="mt-1 space-y-1">
            {(
              output.recent_transactions as {
                type: string;
                amount_vnd: number;
                location: string;
                timestamp: string;
              }[]
            ).map((tx, i) => (
              <li
                key={i}
                className="flex justify-between text-xs text-foreground/80"
              >
                <span className="truncate mr-2">
                  {tx.timestamp.slice(5)} · {tx.location}
                </span>
                <span
                  className={
                    tx.amount_vnd > 0
                      ? "font-medium text-success shrink-0"
                      : "font-medium shrink-0"
                  }
                >
                  {tx.amount_vnd > 0 ? "+" : ""}
                  {VND(tx.amount_vnd)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : output.last_transaction != null ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Giao dịch gần nhất:{" "}
          {String(
            (output.last_transaction as Record<string, unknown>)?.location ??
              "",
          )}
        </p>
      ) : null}
    </Card>
  );
}
