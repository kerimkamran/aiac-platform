import { Card } from "@/components/ui/Surfaces";
import { Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { fillText } from "@/lib/dates";

const CHOICES = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120];

// Staff give one candidate extra minutes on a timed assessment (an
// accommodation, or a technical problem). The deadline becomes the time limit
// plus these minutes; the timer and the automatic submit follow it.
type ExtraTimeText = {
  extraTitle: string;
  extraLimit: string;
  extraHas: string;
  extraNone: string;
  extraLabel: string;
  extraNoneOption: string;
  extraMinutes: string;
  save: string;
  saving: string;
};
const EXTRA_EN: ExtraTimeText = {
  extraTitle: "Extra time",
  extraLimit: "The time limit is {n} minutes.",
  extraHas: "This candidate has {n} extra, so {total} in total.",
  extraNone: "Give this candidate extra minutes if they need them.",
  extraLabel: "Extra minutes",
  extraNoneOption: "None",
  extraMinutes: "{n} minutes",
  save: "Save",
  saving: "Saving…",
};

export function ExtraTimeCard({
  action,
  current,
  limitMinutes,
  text: t = EXTRA_EN,
}: {
  action: (formData: FormData) => Promise<void>;
  current: number;
  limitMinutes: number;
  text?: ExtraTimeText;
}) {
  const options = CHOICES.includes(current) ? CHOICES : [...CHOICES, current].sort((a, b) => a - b);
  return (
    <Card className="p-6 mb-6 no-print">
      <h2 className="text-title text-foreground">{t.extraTitle}</h2>
      <p className="mt-1 text-sm text-muted">
        {fillText(t.extraLimit, { n: limitMinutes })}{" "}
        {current > 0 ? fillText(t.extraHas, { n: current, total: limitMinutes + current }) : t.extraNone}
      </p>
      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-40">
          <label htmlFor="extra_minutes" className="mb-1.5 block text-sm font-semibold text-foreground">
            {t.extraLabel}
          </label>
          <Select id="extra_minutes" name="extra_minutes" defaultValue={String(current)}>
            {options.map((m) => (
              <option key={m} value={m}>
                {m === 0 ? t.extraNoneOption : fillText(t.extraMinutes, { n: m })}
              </option>
            ))}
          </Select>
        </div>
        <SubmitButton pendingLabel={t.saving}>{t.save}</SubmitButton>
      </form>
    </Card>
  );
}
