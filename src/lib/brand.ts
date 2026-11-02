// Brand colours for places that cannot read CSS custom properties: the PDF
// report, Excel exports and email templates (Clear Horizon design plan,
// section 5). These are the same values as the tokens in src/app/globals.css.
// This is the only file in the app that may spell colours out as hex; a test
// enforces it.
export const BRAND = {
  navy: "#133E72",
  navyDeep: "#0C2A4F",
  navyTint: "#EEF3FA",
  green: "#356D1B",
  greenTint: "#E3F0D9",
  signal: "#1D5AA6",
  ink: "#0B1A2E",
  muted: "#4D5B6E",
  line: "#D6DDE6",
  cream: "#FCFAF5",
  warning: "#8A5A00",
  warningTint: "#FCF1D9",
  critical: "#B42318",
  criticalTint: "#FDE7E4",
  white: "#FFFFFF",
  // The mark: tile, V gradient and the centre node.
  markTile: "#0C2A4F",
  markFrom: "#5A90D4",
  markTo: "#8FD16E",
  markNode: "#8FD16E",
} as const;
