import { getServiceClient } from "./_supabase.js";
import { parseJSON, json, methodNotAllowed } from "./_utils.js";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return methodNotAllowed();
    const { user } = parseJSON(event.body);
    if (!user) return json(400, { ok: false, error: "No user" });
    const user_id = Number(user.user_id || user.id);
    if (!user_id) return json(400, { ok: false, error: "No user" });

    const supa = getServiceClient();

    // Обновим/создадим пользователя
    const { error: uerr } = await supa.from("users").upsert({
      user_id,
      username: user.username || null,
      first_name: user.first_name || null,
      last_name: user.last_name || null,
    });
    if (uerr) throw uerr;

    // Создадим заявку
    const { error: rerr } = await supa.from("purchase_requests").insert({
      user_id,
      status: "pending",
    });
    if (rerr) throw rerr;

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { ok: false, error: e.message });
  }
};
