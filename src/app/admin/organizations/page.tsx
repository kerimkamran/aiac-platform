import { createClient } from "@/lib/supabase/server";
import { Card, Icon, PageHeader } from "@/components/ui";
import { addOrgUnit, deleteOrgUnit } from "../actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

type Unit = { id: string; parent_id: string | null; unit_type: string; name: string };

const TYPE_LABEL: Record<string, string> = {
  business_unit: "Business unit",
  department: "Department",
  team: "Team",
  location: "Location",
};

function UnitTree({ units, parentId, depth }: { units: Unit[]; parentId: string | null; depth: number }) {
  const children = units.filter((u) => u.parent_id === parentId);
  if (children.length === 0) return null;
  return (
    <ul className={depth > 0 ? "ml-6 border-l border-line pl-4 space-y-1.5" : "space-y-1.5"}>
      {children.map((u) => (
        <li key={u.id}>
          <div className="flex items-center gap-3 text-sm py-1">
            <Icon name={u.unit_type === "location" ? "building" : u.unit_type === "team" ? "users" : "layers"} className="w-4 h-4 text-accent-dark shrink-0" />
            <span className="font-semibold text-foreground">{u.name}</span>
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-faint bg-line/50 px-2 py-0.5 rounded-full">
              {TYPE_LABEL[u.unit_type] || u.unit_type}
            </span>
            <form action={deleteOrgUnit.bind(null, u.id)} className="ml-auto">
              <ConfirmSubmitButton
                confirmMessage={`Delete "${u.name}" and all units beneath it? Users keep their accounts but lose this assignment.`}
                icon="trash"
                className="p-1 rounded text-faint hover:text-critical"
              />
            </form>
          </div>
          <UnitTree units={units} parentId={u.id} depth={depth + 1} />
        </li>
      ))}
    </ul>
  );
}

export default async function AdminOrganizationsPage() {
  const supabase = await createClient();
  const [{ data: org }, { data: units }, { data: counts }] = await Promise.all([
    supabase.from("organizations").select("id, name, business_unit").limit(1).maybeSingle(),
    supabase.from("org_units").select("id, parent_id, unit_type, name").order("name"),
    supabase.from("profiles").select("org_unit_id"),
  ]);

  const memberCount = new Map<string, number>();
  for (const p of counts || []) {
    if (p.org_unit_id) memberCount.set(p.org_unit_id, (memberCount.get(p.org_unit_id) || 0) + 1);
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <PageHeader
        title="Organizations"
        subtitle={`${org?.name || "Organization"} — business units, departments, teams, and locations as a reporting tree. Assign users to units on their profile page.`}
      />

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
        <Card className="p-6">
          <p className="text-sm font-bold text-foreground mb-5 flex items-center gap-2">
            <Icon name="building" className="w-4 h-4 text-brand" />
            {org?.name || "Organization"}
            <span className="text-faint font-medium text-xs">· {(units || []).length} unit(s) · {[...memberCount.values()].reduce((a, b) => a + b, 0)} assigned member(s)</span>
          </p>
          {(units || []).length > 0 ? (
            <UnitTree units={(units || []) as Unit[]} parentId={null} depth={0} />
          ) : (
            <p className="text-sm text-faint">No units yet — create the first one on the right.</p>
          )}
        </Card>

        <Card className="p-6 sticky top-6">
          <form action={addOrgUnit} className="space-y-4">
            <p className="text-sm font-bold text-foreground flex items-center gap-2">
              <Icon name="plus" className="w-4 h-4 text-accent-dark" />
              Add unit
            </p>
            <input name="name" required placeholder="e.g. Network Operations" className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" aria-label="Unit name" />
            <select name="unit_type" required className="w-full bg-surface border border-line rounded-xl px-3 py-2.5 text-sm" aria-label="Unit type">
              <option value="business_unit">Business unit</option>
              <option value="department">Department</option>
              <option value="team">Team</option>
              <option value="location">Location</option>
            </select>
            <select name="parent_id" className="w-full bg-surface border border-line rounded-xl px-3 py-2.5 text-sm" aria-label="Parent unit">
              <option value="">— top level —</option>
              {(units || []).map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <button className="w-full bg-brand text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-brand-light transition-colors">Create unit</button>
          </form>
        </Card>
      </div>
    </div>
  );
}
