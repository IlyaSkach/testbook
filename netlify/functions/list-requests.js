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
    const { data, error } = await supa
      .from("purchase_requests")
      .select("id,user_id,status,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return json(200, { ok: true, items: data });
  } catch (e) {
    return json(500, { ok: false, error: e.message });
  }
};
