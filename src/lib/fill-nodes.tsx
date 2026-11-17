import { Fragment, type ReactNode } from "react";

// Fills {name} markers in a dictionary string with React nodes (for example a
// bold span), so a translated sentence keeps its emphasis wherever the
// language puts the word.
export function fillNodes(text: string, nodes: Record<string, ReactNode>): ReactNode {
  const parts = text.split(/(\{\w+\})/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = /^\{(\w+)\}$/.exec(part);
        if (m && m[1] in nodes) return <Fragment key={i}>{nodes[m[1]]}</Fragment>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
