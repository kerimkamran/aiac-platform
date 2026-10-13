// Brand colours for places that cannot read CSS custom properties: the PDF
// report, Excel exports and email templates (plan v2, section 4.1). These are
// the same Node Grid values as the tokens in src/app/globals.css. This is the
// only file in the app that may spell colours out as hex; a test enforces it.
export const BRAND = {
  navy: "#133E72",
  navyDeep: "#0A2444",
  navyTint: "#D9E5F5",
  green: "#356D1B",
  greenTint: "#E3F0D9",
  ink: "#0D1B2E",
  muted: "#526070",
  line: "#D5DCE6",
  cream: "#FBF9F4",
  warning: "#8A5A00",
  warningTint: "#FCF1D9",
  critical: "#B42318",
  criticalTint: "#FDE7E4",
  white: "#FFFFFF",
} as const;
