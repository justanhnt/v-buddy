// Mock VETC wallet for hackathon demo.
// Generates a session-consistent balance on first call.

let cachedBalance: number | null = null;

const MOCK_TRANSACTIONS = [
  { type: "toll", amount_vnd: -52_000, location: "Trạm Long Phước", timestamp: "2025-04-16 08:30" },
  { type: "toll", amount_vnd: -28_000, location: "Trạm Dầu Giây", timestamp: "2025-04-15 17:45" },
  { type: "topup", amount_vnd: 200_000, location: "VietcomBank", timestamp: "2025-04-14 10:00" },
  { type: "toll", amount_vnd: -40_000, location: "Trạm Chợ Đệm", timestamp: "2025-04-12 07:15" },
];

function getBalance(): number {
  if (cachedBalance === null) {
    // Random balance between 150,000 and 500,000 VND
    cachedBalance = Math.round((150_000 + Math.random() * 350_000) / 10_000) * 10_000;
  }
  return cachedBalance;
}

export function checkWallet(tripCostVnd?: number) {
  const balance = getBalance();
  const lastTx = MOCK_TRANSACTIONS[0];

  const result: {
    balance_vnd: number;
    auto_topup: boolean;
    last_transaction: typeof lastTx;
    can_afford_trip: boolean | null;
    shortfall_vnd: number | null;
    top_up_suggestion: string | null;
  } = {
    balance_vnd: balance,
    auto_topup: false,
    last_transaction: lastTx,
    can_afford_trip: null,
    shortfall_vnd: null,
    top_up_suggestion: null,
  };

  if (tripCostVnd != null && tripCostVnd > 0) {
    result.can_afford_trip = balance >= tripCostVnd;
    if (!result.can_afford_trip) {
      result.shortfall_vnd = tripCostVnd - balance;
      const rounded = Math.ceil(result.shortfall_vnd / 50_000) * 50_000;
      result.top_up_suggestion = `Nạp thêm ${rounded.toLocaleString("vi-VN")}đ để đủ cho chuyến đi.`;
    }
  }

  return result;
}
