"use client";

import { useState } from "react";
import { LEVELS, LEVEL_KEYS, type LevelKey } from "@/lib/levels";
import { JD_MAX_CHARS, NOTES_MAX_CHARS } from "@/lib/ai-context";
import { readDocxText, readTextFile } from "../new/files";

export function PositionForm({
  action,
  initial,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  initial: { title: string; department: string; defaultLevel: LevelKey; jobDescription: string; notes: string };
  submitLabel: string;
}) {
  const [title, setTitle] = useState(initial.title);
  const [department, setDepartment] = useState(initial.department);
  const [defaultLevel, setDefaultLevel] = useState<LevelKey>(initial.defaultLevel);
  const [jobDescription, setJobDescription] = useState(initial.jobDescription);
  const [notes, setNotes] = useState(initial.notes);
  const [notice, setNotice] = useState<string | null>(null);

  async function onJdFile(file: File | undefined) {
    if (!file) return;
    setNotice(null);
    const r = file.name.toLowerCase().endsWith(".docx") ? await readDocxText(file) : await readTextFile(file);
    if (!r.ok) return setNotice(r.error);
    setJobDescription(r.text);
  }

  return (
    <form action={action} className="space-y-5">
      {notice && (
        <p role="alert" className="text-xs text-critical bg-red-50 rounded-lg px-3 py-2">
          {notice}
        </p>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="title" className="text-xs font-semibold text-muted block">
            Position title
          </label>
          <input
            id="title"
            name="title"
            required
            minLength={2}
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Key Account Manager"
            className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="department" className="text-xs font-semibold text-muted block">
            Department (optional)
          </label>
          <input
            id="department"
            name="department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="default_level" className="text-xs font-semibold text-muted block">
          Usual level
        </label>
        <select
          id="default_level"
          name="default_level"
          value={defaultLevel}
          onChange={(e) => setDefaultLevel(e.target.value as LevelKey)}
          className="w-full sm:w-72 bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {LEVEL_KEYS.map((l) => (
            <option key={l} value={l}>
              {LEVELS[l].label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="job_description" className="text-xs font-semibold text-muted">
            Job description
          </label>
          <label className="text-xs font-semibold text-accent-dark cursor-pointer hover:underline">
            Upload .docx / .md / .txt
            <input type="file" accept=".docx,.md,.txt,text/markdown,text/plain" className="sr-only" onChange={(e) => void onJdFile(e.target.files?.[0])} />
          </label>
        </div>
        <textarea
          id="job_description"
          name="job_description"
          rows={10}
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the job description. It is used to write realistic scenarios for this role."
          className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <p className="text-2xs text-muted">
          {jobDescription.length.toLocaleString()} / {JD_MAX_CHARS.toLocaleString()} characters · sent to AI engines only if they are approved for context
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="notes" className="text-xs font-semibold text-muted block">
          Notes for this position
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Must handle the top-10 accounts; quarterly targets."
          className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <p className="text-2xs text-muted">
          {notes.length.toLocaleString()} / {NOTES_MAX_CHARS.toLocaleString()} characters
        </p>
      </div>

      <div className="flex justify-end">
        <button className="bg-brand-deep text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-brand transition-colors">{submitLabel}</button>
      </div>
    </form>
  );
}
