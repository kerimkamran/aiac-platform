"use client";

// A "select all" checkbox for a set of row checkboxes that live outside its
// own <form> (associated via the HTML `form` attribute instead, since rows
// sit inside per-row forms of their own for single actions). No app state —
// just toggles the matching checkboxes' `checked` property directly.

export function SelectAllCheckbox({ formId, name }: { formId: string; name: string }) {
  // Design-execution-plan Phase 4 / T4.2: the checkbox itself is only 14px,
  // and it sits bare in a <th> with no <label> around it, so the padding
  // that <th> has doesn't count toward the clickable area -- WCAG 2.5.8. A
  // wrapping label gives it a real 24x24 hit target without changing how
  // the checkbox itself looks.
  return (
    <label className="grid place-items-center w-6 h-6 -m-1 cursor-pointer">
      <input
        type="checkbox"
        aria-label="Select all"
        className="w-3.5 h-3.5 rounded border-line accent-brand"
        onChange={(e) => {
          const checked = e.currentTarget.checked;
          const boxes = document.querySelectorAll<HTMLInputElement>(
            `input[type="checkbox"][form="${formId}"][name="${name}"]`
          );
          boxes.forEach((b) => {
            b.checked = checked;
          });
        }}
      />
    </label>
  );
}
