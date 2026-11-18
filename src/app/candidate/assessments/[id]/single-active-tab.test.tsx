// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

// The server action file reaches server-only code; this test only needs the name.
vi.mock("./actions", () => ({ getExamDeadline: async () => null }));
import { useSingleActiveTab } from "./runner";

// No testing-library here, just raw react-dom; tell React this environment
// drives act() itself so it doesn't warn on every state update.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// CAN-B-33: two tabs open on the same exam must not both think they're the
// active one. BroadcastChannel is scoped per origin, not per window, so two
// independent instances of the hook mounted in this one jsdom document (each
// with its own tabId/openedAt, exactly as two real tabs would have) exercise
// the real leader-election handshake end to end -- nothing here is mocked.
const CA_ID = "11111111-2222-3333-4444-555555555555";

function mountTab(container: HTMLDivElement) {
  const locked: { current: boolean } = { current: false };
  function Probe() {
    locked.current = useSingleActiveTab(CA_ID);
    return null;
  }
  const root = createRoot(container);
  act(() => {
    root.render(<Probe />);
  });
  return { root, locked };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("useSingleActiveTab (CAN-B-33)", () => {
  it("locks the earlier tab once a second tab opens, and leaves the newer tab unlocked", async () => {
    const containerA = document.createElement("div");
    const tabA = mountTab(containerA);
    await act(async () => wait(20));
    expect(tabA.locked.current).toBe(false); // alone so far

    // A newer tab opens a moment later.
    await act(async () => wait(5));
    const containerB = document.createElement("div");
    const tabB = mountTab(containerB);
    await act(async () => wait(50));

    expect(tabA.locked.current).toBe(true); // older tab defers
    expect(tabB.locked.current).toBe(false); // newer tab stays active

    act(() => {
      tabA.root.unmount();
      tabB.root.unmount();
    });
  });

  it("lets the remaining tab take back over once the active tab closes", async () => {
    const containerA = document.createElement("div");
    const tabA = mountTab(containerA);
    await act(async () => wait(5));
    const containerB = document.createElement("div");
    const tabB = mountTab(containerB);
    await act(async () => wait(50));
    expect(tabA.locked.current).toBe(true);

    // The active (newer) tab closes.
    await act(async () => {
      tabB.root.unmount();
      await wait(400); // past the 250ms recheck window
    });

    expect(tabA.locked.current).toBe(false);

    act(() => {
      tabA.root.unmount();
    });
  });

  it("does not lock two tabs for two different assessments", async () => {
    function ProbeOther() {
      return useSingleActiveTab("other-assessment-id") ? <span data-locked /> : null;
    }
    const containerA = document.createElement("div");
    const lockedA: { current: boolean } = { current: false };
    function ProbeA() {
      lockedA.current = useSingleActiveTab(CA_ID);
      return null;
    }
    const rootA = createRoot(containerA);
    act(() => {
      rootA.render(<ProbeA />);
    });

    const containerOther = document.createElement("div");
    const rootOther = createRoot(containerOther);
    act(() => {
      rootOther.render(<ProbeOther />);
    });
    await act(async () => wait(50));

    expect(lockedA.current).toBe(false);

    act(() => {
      rootA.unmount();
      rootOther.unmount();
    });
  });
});
