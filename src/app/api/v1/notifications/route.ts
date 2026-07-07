import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, parsePagination, envelope } from "../_lib";

/* Notifications are self-scoped: any authenticated user reads their own. */
export async function GET(request: NextRequest) {
  const limited = rateLimit(request);
  if (limited) return limited;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const { page, perPage, from, to } = parsePagination(request);
  const { data, count, error } = await supabase
    .from("notifications")
    .select("id, title, body, link, read_at, created_at", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return envelope(data, { page, perPage, total: count ?? 0 });
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request);
  if (limited) return limited;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();
  let query = supabase.from("notifications").update({ read_at: now }).eq("user_id", user.id).is("read_at", null);
  if (Array.isArray(body.ids) && body.ids.length > 0) query = query.in("id", body.ids);
  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: { marked_read: true } });
}
