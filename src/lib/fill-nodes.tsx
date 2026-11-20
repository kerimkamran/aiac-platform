import { Fragment, type ReactNode } from "react";

/**
 * Like fillText, but a value can be a React node, so a translated sentence can
 * carry a bold name or a link wherever that language puts it:
 * fillNodes("{name} already decided {decision}.", { name: <b>Leyla</b>, decision: "Hold" }).
 */
export function fillNodes(text: string, values: Record<string, ReactNode>): ReactNode {
  const parts = text.split(/(\{\w+\})/g);
  return parts.map((part, i) => {
    const key = part.match(/^\{(\w+)\}$/)?.[1];
    return <Fragment key={i}>{key && key in values ? values[key] : part}</Fragment>;
  });
}
