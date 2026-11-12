import { Card } from "@/components/ui/Surfaces";
import { Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

const CHOICES = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120];

// Staff give one candidate extra minutes on a timed assessment (an
// accommodation, or a technical problem). The deadline becomes the time limit
// plus these minutes; the timer and the automatic submit follow it.
export function ExtraTimeCard({ action, current, limitMinutes }: { action: (formData: FormData) => Promise<void>; current: number; limitMinutes: number }) {
  const options = CHOICES.includes(current) ? CHOICES : [...CHOICES, current].sort((a, b) => a - b);
  return (
    <Card className="p-6 mb-6 no-print">
      <h2 className="text-title text-foreground">Extra time</h2>
      <p className="mt-1 text-sm text-muted">
        The time limit is {limitMinutes} minutes.{" "}
        {current > 0 ? `This candidate has ${current} extra, so ${limitMinutes + current} in total.` : "Give this candidate extra minutes if they need them."}
      </p>
      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-40">
          <label htmlFor="extra_minutes" className="mb-1.5 block text-sm font-semibold text-foreground">
            Extra minutes
          </label>
          <Select id="extra_minutes" name="extra_minutes" defaultValue={String(current)}>
            {options.map((m) => (
              <option key={m} value={m}>
                {m === 0 ? "None" : `${m} minutes`}
              </option>
            ))}
          </Select>
        </div>
        <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
      </form>
    </Card>
  );
}
