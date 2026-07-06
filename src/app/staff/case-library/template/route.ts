import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const TEMPLATE = `## Handling a missed deadline

**Competency:** CF-F09
**Difficulty:** mid
**Methodology:** Mettl-style SJT

**Scenario:**
A tenured team member on your project has missed the second deadline this month, and the client is starting to ask questions. You have a 1:1 scheduled with them tomorrow.

**Question:**
What do you do in the 1:1?

**Type:** mcq

**Options:**
- A) Ask them directly what's blocking them and co-create a recovery plan.
- B) Reassign their tasks to someone else without discussing it first.
- C) Escalate immediately to your manager before speaking with them.
- D) Say nothing and hope the next deadline goes better.

---

## Cross-team resource conflict

**Competency:** CF-F04
**Difficulty:** high
**Methodology:** Korn Ferry-style exercise

**Scenario:**
Two teams you support both need the same specialist next week for conflicting priorities, and both project leads have escalated to you directly.

**Question:**
Describe how you would resolve this, and why.

**Type:** text
`;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "system_admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  return new NextResponse(TEMPLATE, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="case-library-upload-template.md"`,
    },
  });
}
