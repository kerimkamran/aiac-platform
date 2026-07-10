import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Icon } from "@/components/ui";
import { updateEmailTemplate, uploadEmailImage, removeEmailImage, updateEngineSettings, clearEngineKey } from "./actions";
import { ToastFromParams, type ToastSpec } from "@/components/Toaster";

const TOAST_SPECS: ToastSpec[] = [
  { param: "error", variant: "error" },
  { param: "saved", variant: "success", text: "Template saved." },
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await searchParams;
  const supabase = await createClient();

  const { data: template } = await supabase
    .from("email_templates")
    .select("subject, body_html, image_url, updated_at")
    .eq("template_key", "candidate_invite")
    .maybeSingle();

  const { data: engines } = await supabase
    .from("generation_engines")
    .select("key, display_name, api_key_secret_id, enabled, updated_at")
    .order("key");

  return (
    <div className="p-6 lg:p-10 max-w-4xl">
      <PageHeader
        title="Settings"
        subtitle="Manage the invite email candidates and decision makers receive when they're added to the system."
      />

      <ToastFromParams specs={TOAST_SPECS} />

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

      <Card className="p-6 mb-6">
        <p className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
          <Icon name="wand" className="w-4 h-4 text-brand" />
          AI generation engines
        </p>
        <p className="text-xs text-muted mb-5">
          Connect Claude, Sakana Fugu, and/or Kimi to generate Korn Ferry / Mercer / WTW / Thomas-caliber situational
          judgment cases and questions from the competency library. Admin-only — keys are never shown to other
          staff or candidates.
        </p>
        <div className="space-y-5">
          {(engines || []).map((e) => (
            <div key={e.key} className="border border-line rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-sm font-bold text-foreground">{e.display_name}</p>
                <span
                  className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${
                    e.enabled && e.api_key_secret_id
                      ? "bg-green-50 text-green-700 ring-green-600/20"
                      : "bg-gray-100 text-gray-600 ring-gray-500/20"
                  }`}
                >
                  {e.enabled && e.api_key_secret_id ? "Active" : "Not configured"}
                </span>
              </div>
              <form action={updateEngineSettings.bind(null, e.key as "claude" | "fugu" | "kimi")} className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input type="checkbox" name="enabled" defaultChecked={e.enabled} className="w-4 h-4 accent-[color:var(--brand)]" />
                  Enabled
                </label>
                <input
                  name="api_key"
                  type="password"
                  placeholder={e.api_key_secret_id ? "•••••••••••• (set — leave blank to keep)" : "Paste API key"}
                  className="flex-1 min-w-48 bg-surface border border-line rounded-xl px-3.5 py-2 text-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button className="bg-brand text-white text-xs font-semibold px-3.5 py-2 rounded-xl hover:bg-brand-light transition-colors">
                  Save
                </button>
              </form>
              {e.api_key_secret_id && (
                <form action={clearEngineKey.bind(null, e.key as "claude" | "fugu" | "kimi")} className="mt-2">
                  <button className="text-[11px] text-critical hover:underline">Remove key & disable</button>
                </form>
              )}
            </div>
          ))}
        </div>
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
