import { getServiceClient } from "./_supabase.js";
import { parseJSON, json, methodNotAllowed } from "./_utils.js";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return methodNotAllowed();
    const { user } = parseJSON(event.body);
    if (!user?.user_id) return json(400, { error: "No user" });

    const supa = getServiceClient();

    await supa.from("users").upsert({
      user_id: user.user_id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
    });

    const { data, error } = await supa
      .from("user_access")
      .select("has_full_access")
      .eq("user_id", user.user_id)
      .maybeSingle();
    if (error) throw error;

    return json(200, { hasFullAccess: !!data?.has_full_access });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
