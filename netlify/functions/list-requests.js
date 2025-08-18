import { getServiceClient } from "./_supabase.js";
import { json } from "./_utils.js";

export const handler = async (event) => {
  try {
    const adminKey =
      event.headers["x-admin-key"] || event.headers["X-Admin-Key"];
    if (!adminKey || adminKey !== process.env.ADMIN_PANEL_KEY) {
      return json(401, { ok: false, error: "Unauthorized" });
    }
    const supa = getServiceClient();
    // Вернём только последнюю заявку на пользователя (без RPC, на приложении)
    const { data, error } = await supa
      .from("purchase_requests")
      .select("id,user_id,status,created_at, users(username)")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    const seen = new Set();
    const deduped = [];
    for (const row of data) {
      if (seen.has(row.user_id)) continue;
      seen.add(row.user_id);
      deduped.push(row);
    }
    return json(200, { ok: true, items: deduped });
  } catch (e) {
    return json(500, { ok: false, error: e.message });
  }
};
