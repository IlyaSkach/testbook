let adminKey = "";

function qs(sel) {
  return document.querySelector(sel);
}
function renderRequests(list) {
  const tbody = qs("#requestsTable tbody");
  tbody.innerHTML = "";
  list.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${r.user_id}</td>
      <td>${r.status}</td>
      <td>
        <button data-id="${r.id}" data-user="${r.user_id}" class="approve">Подтвердить</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

qs("#loginBtn").addEventListener("click", () => {
  adminKey = qs("#adminKey").value.trim();
  if (!adminKey) return alert("Введите ADMIN_PANEL_KEY");
  qs("#adminPanel").classList.remove("hidden");
});

qs("#refreshBtn").addEventListener("click", async () => {
  const res = await fetch("/.netlify/functions/list-requests", {
    headers: { "x-admin-key": adminKey },
  });
  const data = await res.json();
  if (!data.ok) return alert(data.error || "Ошибка");
  renderRequests(data.items || []);
});

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("button.approve");
  if (!btn) return;
  const id = btn.getAttribute("data-id");
  const userId = btn.getAttribute("data-user");
  const res = await fetch("/.netlify/functions/approve-request", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
    body: JSON.stringify({ id, userId }),
  });
  const data = await res.json();
  if (!data.ok) return alert(data.error || "Ошибка");
  alert("Одобрено");
  qs("#refreshBtn").click();
});
