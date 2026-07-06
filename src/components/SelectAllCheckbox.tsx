"use client";

// A "select all" checkbox for a set of row checkboxes that live outside its
// own <form> (associated via the HTML `form` attribute instead, since rows
// sit inside per-row forms of their own for single actions). No app state —
// just toggles the matching checkboxes' `checked` property directly.

export function SelectAllCheckbox({ formId, name }: { formId: string; name: string }) {
  return (
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
  );
}
