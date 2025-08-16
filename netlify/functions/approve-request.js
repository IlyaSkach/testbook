import { getServiceClient } from "./_supabase.js";
import { parseJSON, json, methodNotAllowed } from "./_utils.js";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return methodNotAllowed();
    const adminKey =
      event.headers["x-admin-key"] || event.headers["X-Admin-Key"];
    if (!adminKey || adminKey !== process.env.ADMIN_PANEL_KEY) {
      return json(401, { ok: false, error: "Unauthorized" });
    }
    const { id, userId } = parseJSON(event.body);
    if (!id || !userId) return json(400, { ok: false, error: "Bad payload" });

    const supa = getServiceClient();

    const { error: uerr } = await supa.from("user_access").upsert({
      user_id: Number(userId),
      has_full_access: true,
    });
    if (uerr) throw uerr;

    const { error: rerr } = await supa
      .from("purchase_requests")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", id);
    if (rerr) throw rerr;

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { ok: false, error: e.message });
  }
};
