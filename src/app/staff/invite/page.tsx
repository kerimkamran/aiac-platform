import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui";
import { ToastFromParams, type ToastSpec } from "@/components/Toaster";
import { addCandidate } from "../people/actions";
import { Input, Select, FieldLabel } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Callout } from "@/components/ui/Callout";

const TOAST_SPECS: ToastSpec[] = [
  { param: "error", variant: "error" },
  { param: "added", variant: "success" },
];

// Every active staff member (recruiters and hiring managers included) can
// invite candidates here. It only ever creates candidate accounts.
export default async function InviteCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; added?: string }>;
}) {
  const { error, added } = await searchParams;
  const supabase = await createClient();
  const { data: tests } = await supabase
    .from("assessments")
    .select("id, title")
    .eq("status", "published")
    .order("title");

  return (
    <div className="p-6 lg:p-10 max-w-xl">
      <PageHeader title="Invite a candidate" subtitle="They get an email with a link to set a password and start their assessment." />
      <ToastFromParams specs={TOAST_SPECS} />
      {error ? <Callout tone="critical" role="alert" className="mb-4">{error}</Callout> : null}
      {added ? <Callout tone="good" role="status" className="mb-4">{added}</Callout> : null}

      <Card className="p-6">
        <form action={addCandidate} className="space-y-4">
          <input type="hidden" name="return_to" value="invite" />
          <div>
            <FieldLabel htmlFor="invite-name">Full name</FieldLabel>
            <Input id="invite-name" name="full_name" required autoComplete="off" />
          </div>
          <div>
            <FieldLabel htmlFor="invite-email">Email address</FieldLabel>
            <Input id="invite-email" name="email" type="email" required autoComplete="off" />
          </div>
          <div>
            <FieldLabel htmlFor="invite-test">Assessment</FieldLabel>
            <Select id="invite-test" name="assessment_id" defaultValue="">
              <option value="">Choose later</option>
              {(tests || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
            {(tests || []).length === 0 ? (
              <p className="mt-1 text-sm text-muted">No published assessments yet. Publish one in Assessments first.</p>
            ) : null}
          </div>
          <div>
            <FieldLabel htmlFor="invite-due" hint="Optional. The candidate can't start after this date.">
              Deadline
            </FieldLabel>
            <Input id="invite-due" name="due_date" type="date" />
          </div>
          <SubmitButton>Send invitation</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
