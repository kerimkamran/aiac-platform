import { describe, expect, it } from "vitest";
import { nameFromEmail, parsePeopleList } from "./invite-paste";

describe("parsePeopleList", () => {
  it("reads names with commas, angle brackets and bare emails", () => {
    const { people, unreadable } = parsePeopleList(
      "Aysel Mammadova, aysel@example.com\nLeyla Aliyeva <Leyla.Aliyeva@Example.com>\n\nrauf.hasanov@example.com\nnot an email"
    );
    expect(people).toEqual([
      { name: "Aysel Mammadova", email: "aysel@example.com" },
      { name: "Leyla Aliyeva", email: "leyla.aliyeva@example.com" },
      { name: "Rauf Hasanov", email: "rauf.hasanov@example.com" },
    ]);
    expect(unreadable).toEqual(["not an email"]);
  });

  it("guesses a readable name from the address", () => {
    expect(nameFromEmail("nigar_guliyeva+x@example.com")).toBe("Nigar Guliyeva X");
    expect(nameFromEmail("123@example.com")).toBe("");
  });
});
