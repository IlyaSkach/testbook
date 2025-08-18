import { getServiceClient } from "./_supabase.js";
import { parseJSON, json, methodNotAllowed } from "./_utils.js";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return methodNotAllowed();
    const { user } = parseJSON(event.body);
    if (!user) return json(400, { error: "No user" });
    const user_id = Number(user.user_id || user.id);
    if (!user_id) return json(400, { error: "No user" });

    const supa = getServiceClient();

    await supa.from("users").upsert({
      user_id,
      username: user.username || null,
      first_name: user.first_name || null,
      last_name: user.last_name || null,
    });

    const { data, error } = await supa
      .from("user_access")
      .select("has_full_access")
      .eq("user_id", user_id)
      .maybeSingle();
    if (error) throw error;

    return json(200, { hasFullAccess: !!data?.has_full_access });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
