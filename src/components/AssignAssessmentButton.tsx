"use client";

import { useState } from "react";

/**
 * Per-assessment "Assign" control in the Assessment Builder list. Lets
 * staff attach a published assessment directly to any existing active
 * account (candidate, decision maker, staff, admin) without going
 * through the "Add a candidate" flow in People & Access -- for accounts
 * that already exist and just need this assessment.
 */
export function AssignAssessmentButton({
  action,
  users,
}: {
  action: (formData: FormData) => void;
  users: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="text-[11px] font-semibold text-accent-dark hover:underline"
      >
        Assign
      </button>
    );
  }

  return (
    <form
      action={action}
      onClick={(e) => e.stopPropagation()}
      className="flex items-center gap-1.5"
    >
      <select
        name="user_id"
        required
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="bg-surface border border-line rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-accent max-w-[180px]"
      >
        <option value="" disabled>
          Choose someone…
        </option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.label}
          </option>
        ))}
      </select>
      <input
        type="date"
        name="due_date"
        title="Optional deadline — candidate is reminded 3 days before and can't start after it passes"
        className="bg-surface border border-line rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <button
        type="submit"
        disabled={!userId}
        className="text-[11px] font-semibold text-accent-dark hover:underline disabled:opacity-40"
      >
        Confirm
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
          setUserId("");
        }}
        className="text-[11px] font-semibold text-faint hover:underline"
      >
        Cancel
      </button>
    </form>
  );
}
