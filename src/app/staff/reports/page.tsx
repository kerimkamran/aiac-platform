import { redirect } from "next/navigation";

// The Reports overview (KPI cards, charts, analytics workbook) was removed in
// plan v2, Phase 1. The candidate list is the report until the report builder
// lands in Phase 4.
export default function ReportsPage() {
  redirect("/staff/reports/candidates");
}
