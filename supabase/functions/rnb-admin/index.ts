// rnb (Rose&Bloom) admin actions that need the service role: creating logins and setting passwords.
// Caller must be signed in as an active rnb admin.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

async function findUserByEmail(email: string) {
  const e = email.toLowerCase();
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => (x.email || "").toLowerCase() === e);
    if (u) return u;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function isAdmin(req: Request) {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
  if (!jwt) return false;
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u?.user) return false;
  const { data: p } = await admin.from("rnb_profiles").select("role, active").eq("id", u.user.id).maybeSingle();
  return !!p && p.active && p.role === "admin";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!(await isAdmin(req))) return json({ error: "not allowed" }, 403);
    const body = await req.json();

    if (body.action === "create_user") {
      const email = String(body.email || "").trim().toLowerCase();
      const display_name = String(body.display_name || "").trim();
      if (!email || !display_name) return json({ error: "חובה למלא שם ואימייל" }, 400);
      if (body.password && String(body.password).length < 6) return json({ error: "סיסמה קצרה מדי" }, 400);
      const { data: exists } = await admin.from("rnb_profiles").select("id").eq("email", email).maybeSingle();
      if (exists) return json({ error: "כבר קיים עובד עם האימייל הזה" }, 409);
      let user = await findUserByEmail(email);
      let created = false;
      if (!user) {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          ...(body.password ? { password: String(body.password) } : {}),
        });
        if (error) return json({ error: error.message }, 400);
        user = data.user;
        created = true;
      }
      const active = body.active === undefined ? true : !!body.active;
      const { error: pe } = await admin.from("rnb_profiles").insert({
        id: user!.id,
        email,
        display_name,
        phone: body.phone || null,
        role: body.role === "admin" ? "admin" : "worker",
        active,
        schedulable: active && (body.schedulable === undefined ? true : !!body.schedulable),
      });
      if (pe) return json({ error: pe.message }, 400);
      return json({ id: user!.id, created, existing_account: !created });
    }

    if (body.action === "set_password") {
      const id = String(body.user_id || "");
      const password = String(body.password || "");
      if (password.length < 6) return json({ error: "סיסמה חייבת להכיל לפחות 6 תווים" }, 400);
      const { data: p } = await admin.from("rnb_profiles").select("id").eq("id", id).maybeSingle();
      if (!p) return json({ error: "not an rnb member" }, 404);
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
