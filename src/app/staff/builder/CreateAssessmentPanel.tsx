"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Icon } from "@/components/ui";
import { generateDefaultAssessment, generateCustomAssessment, createAssessment } from "./actions";

// Generation is a real, multi-step LLM call — it can legitimately take
// 20-90+ seconds. Without this, the button just sits there with no
// feedback, which reads as "broken" or "stuck" long before it's actually
// done. useFormStatus reports the *enclosing* form's pending state, so this
// must be rendered as a descendant of the <form>, not the form itself.
function GenerateSubmitButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={disabled || pending}
      className="w-full inline-flex items-center justify-center gap-2 bg-accent text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-accent-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? (
        <>
          <Icon name="clock" className="w-4 h-4 animate-spin" />
          Generating — this can take up to a minute…
        </>
      ) : (
        label
      )}
    </button>
  );
}

type Engine = { key: string; display_name: string; enabled: boolean; configured: boolean };
type Competency = { id: string; name: string; category: string };

const ENGINE_INFO: Record<string, { tagline: string; cost: string; quality: string }> = {
  claude: {
    tagline: "Premium reasoning — the most nuanced, human-feeling situational judgment cases.",
    cost: "~$3 / $15 per 1M tokens (in/out)",
    quality: "Highest",
  },
  fugu: {
    tagline: "Sakana AI's multi-agent orchestrator — routes each request to whichever underlying model performs best on it.",
    cost: "Pay-as-you-go at the routed model's own rate (no markup)",
    quality: "Very high — benchmarks at/above frontier models",
  },
  kimi: {
    tagline: "Moonshot AI's K2 model — strong quality at a fraction of the cost. Best value.",
    cost: "~$0.60 / $2.50 per 1M tokens (in/out)",
    quality: "Good · most economical",
  },
};

const SCOPES = [
  { key: "Core", label: "Core", icon: "layers", blurb: "One assessment covering every Core competency in the library." },
  { key: "Leadership", label: "Leadership", icon: "award", blurb: "One assessment covering every Leadership competency." },
  { key: "Mix", label: "Mix of them", icon: "sparkles", blurb: "A single assessment blending Core + Leadership competencies." },
  { key: "Custom", label: "Manual", icon: "target", blurb: "Hand-pick the exact competencies to generate from." },
] as const;

const PURPOSES = [
  {
    key: "hiring",
    label: "Hiring",
    icon: "users",
    blurb: "External or internal candidates being evaluated for an open role.",
  },
  {
    key: "promotion",
    label: "Promotion",
    icon: "trending",
    blurb: "Existing employees being evaluated for advancement into a higher role.",
  },
  {
    key: "development",
    label: "Development",
    icon: "sparkles",
    blurb: "Existing employees building a growth plan — no hire/promote decision attached.",
  },
] as const;

type PurposeKey = (typeof PURPOSES)[number]["key"];

type ScopeKey = (typeof SCOPES)[number]["key"];

export function CreateAssessmentPanel({
  compGroups,
  engines,
}: {
  compGroups: { cat: string; items: Competency[] }[];
  engines: Engine[];
}) {
  const [scope, setScope] = useState<ScopeKey>("Core");
  const [purpose, setPurpose] = useState<PurposeKey>("hiring");
  const [engine, setEngine] = useState<string>(() => engines.find((e) => e.enabled && e.configured)?.key || "");
  const [showBlank, setShowBlank] = useState(false);
  const [language, setLanguage] = useState<"en" | "az" | "ru">("en");

  const anyConfigured = engines.some((e) => e.enabled && e.configured);
  const activeScope = SCOPES.find((s) => s.key === scope)!;
  const activePurpose = PURPOSES.find((p) => p.key === purpose)!;


  const engineByKey = (key: string) => engines.find((e) => e.key === key);
  const engineReady = (key: string) => {
    const e = engineByKey(key);
    return !!(e && e.enabled && e.configured);
  };

  const boundDefaultAction =
    scope !== "Custom" ? generateDefaultAssessment.bind(null, scope as "Core" | "Leadership" | "Mix") : null;

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-line rounded-2xl shadow-[0_1px_2px_rgba(16,28,44,0.04)] p-6">
        <p className="font-bold text-foreground text-sm flex items-center gap-2 mb-1">
          <Icon name="target" className="w-4 h-4 text-accent-dark" />
          What is this assessment for?
        </p>
        <p className="text-xs text-muted mb-4">
          This shapes the language candidates see, the decision options reviewers get, and the default proctoring
          settings — throughout the whole assessment lifecycle.
        </p>
        <div className="grid grid-cols-3 gap-2 mb-1.5">
          {PURPOSES.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPurpose(p.key)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-[12.5px] font-semibold transition-colors text-center ${
                purpose === p.key
                  ? "border-brand bg-brand/5 text-brand"
                  : "border-line text-muted hover:border-brand/40 hover:text-foreground"
              }`}
            >
              <Icon name={p.icon} className={`w-4 h-4 ${purpose === p.key ? "text-brand" : "text-faint"}`} />
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-[11.5px] text-faint">{activePurpose.blurb}</p>
      </div>

      <div className="bg-surface border border-line rounded-2xl shadow-[0_1px_2px_rgba(16,28,44,0.04)] p-6">
        <p className="font-bold text-foreground text-sm flex items-center gap-2 mb-1">
          <Icon name="wand" className="w-4 h-4 text-accent-dark" />
          Create assessment
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-accent-dark bg-accent-soft px-2 py-0.5 rounded-full ml-auto">
            AI-generated
          </span>
        </p>
        <p className="text-xs text-muted mb-4">
          Korn Ferry / Mercer / WTW / Thomas-caliber situational judgment cases, generated straight from the governed
          competency library — at least 10 mid-to-high difficulty questions per assessment.
        </p>

        {!anyConfigured && (
          <p className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 mb-4">
            No generation engine configured yet — add a Claude, Sakana Fugu, or Kimi API key in{" "}
            <Link href="/staff/settings" className="underline font-semibold">
              Settings
            </Link>{" "}
            to activate generation. You can still explore this panel in the meantime.
          </p>
        )}

        {/* Step 1: scope */}
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint mb-2">1. Auto-generate</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {SCOPES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setScope(s.key)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                scope === s.key
                  ? "border-brand bg-brand/5 text-brand"
                  : "border-line text-muted hover:border-brand/40 hover:text-foreground"
              }`}
            >
              <Icon name={s.icon} className={`w-4 h-4 ${scope === s.key ? "text-brand" : "text-faint"}`} />
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-[11.5px] text-faint mb-4 -mt-2">{activeScope.blurb}</p>

        {/* Step 2: engine, with cost/quality info */}
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint mb-2">2. Choose an engine</p>
        <div className="space-y-1.5 mb-3">
          {(["claude", "fugu", "kimi"] as const).map((key) => {
            const info = ENGINE_INFO[key];
            const meta = engineByKey(key);
            const ready = engineReady(key);
            return (
              <label
                key={key}
                className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                  engine === key ? "border-brand bg-brand/5" : "border-line"
                } ${!ready ? "opacity-50" : ""}`}
              >
                <input
                  type="radio"
                  name="engine-picker"
                  className="mt-1 accent-[color:var(--brand)]"
                  checked={engine === key}
                  disabled={!ready}
                  onChange={() => setEngine(key)}
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-[12.5px] font-bold text-foreground">
                    {meta?.display_name || key}
                    <span className="text-[9.5px] font-semibold uppercase tracking-wide text-faint">{info.quality}</span>
                    {!ready && <span className="text-[9.5px] font-semibold text-amber-600">(not configured)</span>}
                  </span>
                  <span className="block text-[11.5px] text-muted">{info.tagline}</span>
                  <span className="block text-[10.5px] text-faint mt-0.5">{info.cost}</span>
                </span>
              </label>
            );
          })}
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-faint mb-2">Case language</p>
          <div className="flex gap-2">
            {([["en", "English"], ["az", "Azərbaycanca"], ["ru", "Русский"]] as const).map(([code, label]) => (
              <button
                key={code}
                type="button"
                onClick={() => setLanguage(code)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                  language === code ? "border-brand bg-brand/5 text-foreground" : "border-line text-muted hover:border-faint"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[10.5px] text-faint mt-1.5">All generated cases, questions, and options are written in this language.</p>
        </div>

        {/* Step 3: details + submit, per scope */}
        {scope === "Custom" ? (
          <form action={generateCustomAssessment} className="space-y-3">
            <input type="hidden" name="engine" value={engine} />
            <input type="hidden" name="purpose" value={purpose} />
            <input type="hidden" name="language" value={language} />
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint">3. Title &amp; competencies</p>
            <input
              name="title"
              required
              placeholder="Assessment title"
              disabled={!anyConfigured}
              className="w-full bg-background border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
            />
            {compGroups.length === 0 ? (
              <p className="text-xs text-faint">No competencies found in the library yet.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto border border-line rounded-xl p-3 space-y-3 bg-background">
                {compGroups.map((g) => (
                  <div key={g.cat}>
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint mb-1.5">{g.cat}</p>
                    <div className="space-y-1">
                      {g.items.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-[13px] cursor-pointer">
                          <input
                            type="checkbox"
                            name="competency_ids"
                            value={c.id}
                            disabled={!anyConfigured}
                            className="w-3.5 h-3.5 accent-[color:var(--brand)]"
                          />
                          {c.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <GenerateSubmitButton label="Generate assessment" disabled={!anyConfigured || !engine} />
          </form>
        ) : (
          <form action={boundDefaultAction!} className="space-y-3">
            <input type="hidden" name="engine" value={engine} />
            <input type="hidden" name="purpose" value={purpose} />
            <input type="hidden" name="language" value={language} />
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint">3. Optional title</p>
            <input
              name="title"
              placeholder={`${activeScope.label} Competency Assessment (Default)`}
              disabled={!anyConfigured}
              className="w-full bg-background border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
            />
            <GenerateSubmitButton label={`Generate ${activeScope.label} assessment`} disabled={!anyConfigured || !engine} />
          </form>
        )}
      </div>

      <div className="bg-surface border border-line rounded-2xl p-4">
        <button
          type="button"
          onClick={() => setShowBlank((v) => !v)}
          className="w-full flex items-center justify-between text-[12.5px] font-semibold text-muted hover:text-foreground"
        >
          Prefer to start from a blank draft instead?
          <Icon name={showBlank ? "x" : "plus"} className="w-4 h-4" />
        </button>
        {showBlank && (
          <form action={createAssessment} className="space-y-3 mt-4">
            <input type="hidden" name="purpose" value={purpose} />
            <input
              name="title"
              required
              placeholder="e.g. Graduate Trainee — Core Assessment"
              className="w-full bg-background border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <textarea
              name="description"
              placeholder="What this assessment measures and who it's for…"
              rows={2}
              className="w-full bg-background border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <div>
              <label className="text-xs font-semibold text-muted block mb-1.5">Time limit (minutes)</label>
              <input
                name="time_limit_minutes"
                type="number"
                min={5}
                defaultValue={60}
                className="w-full bg-background border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <button className="w-full bg-brand text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-brand-light transition-colors">
              Create empty draft
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
