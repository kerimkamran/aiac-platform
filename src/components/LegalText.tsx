import { splitLegal } from "@/i18n/dictionaries";

// Renders a dictionary string, turning ⟦LEGAL:…⟧ tokens into a visible
// "to be confirmed by Legal" marker, so a placeholder is never mistaken for a
// real fact. A release test blocks launch while any token remains.
export function LegalText({ text, pending }: { text: string; pending: string }) {
  const parts = splitLegal(text);
  return (
    <>
      {parts.map((p, i) =>
        p.type === "text" ? (
          <span key={i}>{p.value}</span>
        ) : (
          <span key={i} data-legal={p.key} className="inline-block align-baseline rounded-sm bg-warning-soft px-1.5 text-xs font-semibold text-warning">
            {pending}
          </span>
        )
      )}
    </>
  );
}
