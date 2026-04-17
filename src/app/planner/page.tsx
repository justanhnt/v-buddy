import type { Metadata } from "next";
import Planner from "@/components/planner/planner";

export const metadata: Metadata = {
  title: "Trip Planner · VETC Buddy",
  description:
    "Lên kế hoạch di chuyển, tìm quán ăn và trạm xăng cùng VETC Buddy.",
};

export default function Page() {
  return <Planner />;
}
