// Mock VETC wallet for hackathon demo.
// Generates a session-consistent balance on first call.

let cachedBalance: number | null = null;

const MOCK_TRANSACTIONS = [
  { type: "toll", amount_vnd: -52_000, location: "Trạm Long Phước", timestamp: "2026-04-16 08:30" },
  { type: "parking", amount_vnd: -25_000, location: "Bãi xe sân bay Tân Sơn Nhất", timestamp: "2026-04-15 19:10" },
  { type: "toll", amount_vnd: -28_000, location: "Trạm Dầu Giây", timestamp: "2026-04-14 17:45" },
  { type: "topup", amount_vnd: 500_000, location: "MoMo", timestamp: "2026-04-13 09:00" },
  { type: "toll", amount_vnd: -140_000, location: "Trạm Liên Khương", timestamp: "2026-04-12 14:20" },
  { type: "toll", amount_vnd: -28_000, location: "Trạm Dầu Giây", timestamp: "2026-04-12 10:15" },
  { type: "toll", amount_vnd: -52_000, location: "Trạm Long Phước", timestamp: "2026-04-12 09:30" },
  { type: "topup", amount_vnd: 200_000, location: "VietcomBank", timestamp: "2026-04-10 10:00" },
  { type: "toll", amount_vnd: -25_000, location: "Trạm Phú Mỹ", timestamp: "2026-04-05 16:30" },
  { type: "toll", amount_vnd: -52_000, location: "Trạm Long Phước", timestamp: "2026-04-05 08:45" },
  { type: "parking", amount_vnd: -15_000, location: "Bãi xe Vincom Đồng Khởi", timestamp: "2026-04-03 12:00" },
  { type: "topup", amount_vnd: 100_000, location: "ZaloPay", timestamp: "2026-04-01 08:30" },
  { type: "toll", amount_vnd: -40_000, location: "Trạm Chợ Đệm", timestamp: "2026-03-29 07:15" },
  { type: "topup", amount_vnd: 300_000, location: "VNPay", timestamp: "2026-03-25 14:00" },
  { type: "toll", amount_vnd: -120_000, location: "Trạm Ninh An", timestamp: "2026-03-22 15:30" },
  { type: "toll", amount_vnd: -50_000, location: "Trạm La Sơn – Túy Loan", timestamp: "2026-03-18 11:00" },
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
    recent_transactions: typeof MOCK_TRANSACTIONS;
    can_afford_trip: boolean | null;
    shortfall_vnd: number | null;
    top_up_suggestion: string | null;
  } = {
    balance_vnd: balance,
    auto_topup: false,
    last_transaction: lastTx,
    recent_transactions: MOCK_TRANSACTIONS.slice(0, 5),
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
