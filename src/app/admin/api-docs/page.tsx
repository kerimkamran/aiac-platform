import { promises as fs } from "fs";
import path from "path";
import { Card, Icon, PageHeader } from "@/components/ui";

type Operation = { summary?: string };
type Spec = { info: { title: string; version: string; description: string }; paths: Record<string, Record<string, Operation>> };

const METHOD_TONE: Record<string, string> = {
  get: "bg-brand-50 text-brand",
  post: "bg-accent-soft text-accent-dark",
  patch: "bg-amber-50 text-warning",
  delete: "bg-red-50 text-critical",
};

export default async function ApiDocsPage() {
  const raw = await fs.readFile(path.join(process.cwd(), "public", "openapi.json"), "utf8");
  const spec = JSON.parse(raw) as Spec;

  return (
    <div className="p-6 lg:p-10 max-w-4xl">
      <PageHeader title={spec.info.title} subtitle={spec.info.description}>
        <a
          href="/openapi.json"
          className="inline-flex items-center gap-2 border border-line bg-surface text-foreground text-sm font-semibold px-4 py-2.5 rounded-xl hover:border-brand transition-colors"
        >
          <Icon name="download" className="w-4 h-4" />
          openapi.json
        </a>
      </PageHeader>

      <div className="space-y-3">
        {Object.entries(spec.paths).map(([route, ops]) => (
          <Card key={route} className="p-5">
            <p className="font-mono text-[13.5px] font-bold text-foreground mb-3">{route}</p>
            <div className="space-y-2">
              {Object.entries(ops).map(([method, op]) => (
                <div key={method} className="flex items-start gap-3 text-sm">
                  <span className={`text-[10.5px] font-bold uppercase px-2 py-1 rounded-md w-14 text-center shrink-0 ${METHOD_TONE[method] || "bg-line/60 text-muted"}`}>
                    {method}
                  </span>
                  <span className="text-muted">{op.summary}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <p className="text-xs text-faint mt-6 max-w-xl">
        Authentication: send requests with the web app&apos;s session cookies (same origin). Rate limit: 60 requests/minute per IP.
        Every mutating call and every PII read is written to the audit log.
      </p>
    </div>
  );
}
