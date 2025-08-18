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
    const { userId } = parseJSON(event.body);
    if (!userId) return json(400, { ok: false, error: "Bad payload" });

    const supa = getServiceClient();
    // Каскадные удаления по FK: user_access и purchase_requests удалятся благодаря on delete cascade
    const { error } = await supa
      .from("users")
      .delete()
      .eq("user_id", Number(userId));
    if (error) throw error;
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { ok: false, error: e.message });
  }
};
