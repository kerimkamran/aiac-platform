import { BRAND } from "@/lib/brand";

// Excel header rows use the Vantage navy (brand.ts is the only place the hex
// lives). ExcelJS wants ARGB, so the alpha byte is prepended here.
const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;

export const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" } };
export const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: argb(BRAND.navy) } };
