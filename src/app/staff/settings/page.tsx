import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Icon } from "@/components/ui";
import { updateEmailTemplate, uploadEmailImage, removeEmailImage } from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
  const supabase = await createClient();

  const { data: template } = await supabase
    .from("email_templates")
    .select("subject, body_html, image_url, updated_at")
    .eq("template_key", "candidate_invite")
    .maybeSingle();

  return (
    <div className="p-6 lg:p-10 max-w-4xl">
      <PageHeader
        title="Settings"
        subtitle="Manage the invite email candidates and decision makers receive when they're added to the system."
      />

      {error && (
        <div className="mb-6 text-sm text-critical bg-red-50 border border-red-200 rounded-xl px-4 py-3">{decodeURIComponent(error)}</div>
      )}
      {saved && (
        <div className="mb-6 text-sm text-accent-dark bg-accent-soft border border-accent/20 rounded-xl px-4 py-3">
          Template saved.
        </div>
      )}

      <Card className="p-6 mb-6">
        <p className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
          <Icon name="mail" className="w-4 h-4 text-brand" />
          Candidate invite email
        </p>
        <p className="text-xs text-muted mb-5">
          Available merge fields: <code className="bg-surface px-1 rounded">{"{{full_name}}"}</code> and{" "}
          <code className="bg-surface px-1 rounded">{"{{assessment_title}}"}</code>. This content is stored and shown
          in-app (e.g. on the invite confirmation) and used as the source for the transactional invite email.
        </p>
        <form action={updateEmailTemplate} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5">Subject</label>
            <input
              name="subject"
              defaultValue={template?.subject || ""}
              required
              className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5">Body (HTML)</label>
            <textarea
              name="body_html"
              defaultValue={template?.body_html || ""}
              required
              rows={8}
              className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <button className="bg-brand text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand-light transition-colors">
            Save template
          </button>
        </form>
      </Card>

      <Card className="p-6 mb-6">
        <p className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
          <Icon name="image" className="w-4 h-4 text-brand" />
          Header image
        </p>
        <p className="text-xs text-muted mb-4">PNG or JPG, shown at the top of the invite email.</p>

        {template?.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={template.image_url} alt="Email header" className="max-h-32 rounded-lg border border-line mb-4" />
        )}

        <form action={uploadEmailImage} className="flex items-center gap-3 mb-2">
          <input
            name="image"
            type="file"
            accept="image/png,image/jpeg"
            required
            className="text-sm text-muted file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:bg-brand file:text-white file:text-sm file:font-semibold file:cursor-pointer"
          />
          <button className="bg-foreground text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity shrink-0">
            Upload
          </button>
        </form>
        {template?.image_url && (
          <form action={removeEmailImage}>
            <button className="text-xs text-critical hover:underline">Remove image</button>
          </form>
        )}
      </Card>

      <Card className="p-6 bg-surface/60 border-dashed">
        <p className="text-xs text-muted leading-relaxed">
          <strong className="text-foreground">How delivery works:</strong> invite emails are sent through Supabase
          Auth&apos;s built-in transactional email (no extra service required). The subject, body, and image saved
          here are used for in-app previews and confirmations. To have Supabase&apos;s actual outgoing email use this
          exact HTML/image per send, connect a transactional email provider (e.g. Resend) and a Supabase SMTP/webhook
          integration — that requires an API key we don&apos;t have in this environment. Ask your engineering contact
          to add one if fully custom, dynamic email content is required.
        </p>
      </Card>
    </div>
  );
}
