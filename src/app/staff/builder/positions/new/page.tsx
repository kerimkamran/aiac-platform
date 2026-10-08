import Link from "next/link";
import { PageHeader, Icon, Card } from "@/components/ui";
import { ToastFromParams, type ToastSpec } from "@/components/Toaster";
import { createPosition } from "../actions";
import { PositionForm } from "../PositionForm";

const TOAST_SPECS: ToastSpec[] = [{ param: "error", variant: "error" }];

export default async function NewPositionPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await searchParams;
  return (
    <div className="p-6 lg:p-10 max-w-3xl">
      <Link href="/staff/builder/positions" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-5 font-medium">
        <Icon name="arrowLeft" className="w-4 h-4" />
        All positions
      </Link>
      <PageHeader title="New position" subtitle="A position keeps its job description, notes and reference files, so the next assessment for it starts ready." />
      <ToastFromParams specs={TOAST_SPECS} />
      <Card className="p-6">
        <PositionForm
          action={createPosition}
          initial={{ title: "", department: "", defaultLevel: "manager", jobDescription: "", notes: "" }}
          submitLabel="Create position"
        />
      </Card>
    </div>
  );
}
