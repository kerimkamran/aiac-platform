import type { Worksheet } from "exceljs";
import { BRAND } from "@/lib/brand";

// Excel header rows use the Vantage navy (brand.ts is the only place the hex
// lives). ExcelJS wants ARGB, so the alpha byte is prepended here.
const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;

export const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" } };
export const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: argb(BRAND.navy) } };

// Shared look for every export: navy tab, a frozen header row, and a header
// row that is tall enough to read. Call once per worksheet, after adding rows.
export function brandWorksheet(ws: Worksheet) {
  ws.properties.tabColor = { argb: argb(BRAND.navy) };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const header = ws.getRow(1);
  header.height = 22;
  header.alignment = { vertical: "middle" };
}
