import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, Icon, PageHeader } from "@/components/ui";
import { ToastFromParams, type ToastSpec } from "@/components/Toaster";
import { broadcastNotification } from "../actions";

const TOASTS: ToastSpec[] = [
  { param: "ok", variant: "success" },
  { param: "error", variant: "error" },
];

export default async function AdminNotificationsPage() {
  const supabase = await createClient();
  const [{ data: templates }, { count: sentCount }] = await Promise.all([
    supabase.from("email_templates").select("template_key, subject, updated_at").order("template_key"),
    supabase.from("notifications").select("id", { count: "exact", head: true }),
  ]);

  const input = "w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <PageHeader
        title="Notifications"
        subtitle={`${sentCount ?? 0} in-app notification(s) delivered so far. Emails go out via the configurable templates; in-app messages appear in every user's bell.`}
      />
      <ToastFromParams specs={TOASTS} />

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <Card className="p-6">
          <form action={broadcastNotification} className="space-y-4">
            <p className="text-sm font-bold text-foreground flex items-center gap-2">
              <Icon name="send" className="w-4 h-4 text-accent-dark" />
              In-app broadcast
            </p>
            <select name="audience" className={input} aria-label="Audience">
              <option value="all">Everyone (active users)</option>
              <option value="staff">Staff only</option>
              <option value="candidates">Candidates only</option>
            </select>
            <input name="title" required placeholder="Title" className={input} aria-label="Title" />
            <textarea name="body" rows={3} placeholder="Message…" className={input} aria-label="Message" />
            <button className="bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-light transition-colors">Send broadcast</button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <p className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <Icon name="mail" className="w-4 h-4 text-brand" />
              Email templates
            </p>
            <div className="space-y-2.5 mb-4">
              {(templates || []).map((t) => (
                <div key={t.template_key} className="flex items-center justify-between text-sm border border-line rounded-xl px-3.5 py-2.5">
                  <div>
                    <p className="font-semibold text-foreground">{t.template_key.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted truncate max-w-56">{t.subject}</p>
                  </div>
                  <span className="text-[11px] text-faint">{t.updated_at ? new Date(t.updated_at).toLocaleDateString() : ""}</span>
                </div>
              ))}
              {(!templates || templates.length === 0) && <p className="text-xs text-faint">No templates yet.</p>}
            </div>
            <Link href="/staff/settings" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent-dark hover:underline">
              Edit templates in Settings
              <Icon name="arrowRight" className="w-3.5 h-3.5" />
            </Link>
          </Card>

          <Card className="p-6">
            <p className="text-sm font-bold text-foreground mb-2">Scheduled reminders</p>
            <p className="text-xs text-muted leading-relaxed">
              Reminder scheduling (e.g. “nudge invited candidates after 3 days”) runs as a <code className="text-brand">pg_cron</code> job in
              Supabase. A ready-to-run job template is documented in <code className="text-brand">supabase/migrations/0004_admin.sql</code>;
              enable the pg_cron extension in your project to activate it.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
