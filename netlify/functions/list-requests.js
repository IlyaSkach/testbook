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
    // Вернём только последнюю заявку на пользователя
    const { data, error } = await supa
      .rpc("get_latest_requests_with_user");
    if (error) throw error;
    return json(200, { ok: true, items: data });
  } catch (e) {
    return json(500, { ok: false, error: e.message });
  }
};
