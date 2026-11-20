import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fillNodes } from "./fill-nodes";

describe("fillNodes", () => {
  it("puts nodes where the sentence has their markers, in any order", () => {
    const html = renderToStaticMarkup(<p>{fillNodes("Siz baxarkən {name} artıq «{decision}» qərarı verib.", { name: <b>Leyla</b>, decision: "Gözlət" })}</p>);
    expect(html).toBe("<p>Siz baxarkən <b>Leyla</b> artıq «Gözlət» qərarı verib.</p>");
  });
  it("leaves unknown markers as written", () => {
    expect(renderToStaticMarkup(<p>{fillNodes("a {x} b", {})}</p>)).toBe("<p>a {x} b</p>");
  });
});
