const tg = window.Telegram?.WebApp;
if (tg) {
  tg.expand?.();
  tg.disableVerticalSwipes?.();
}

document.addEventListener("contextmenu", (e) => e.preventDefault());

const onbStart = document.getElementById("onbStart");
const ph = document.getElementById("placeholder");
const phBack = document.getElementById("phBack");
const btnListen = document.getElementById("btnListen");
const btnRead = document.getElementById("btnRead");
const btnMerch = document.getElementById("btnMerch");
const headerEl = document.querySelector(".app-header");
const footerEl = document.querySelector(".app-footer");
const readerEl = document.getElementById("reader");

function setState(state) {
  document.body.classList.remove(
    "state-onboarding",
    "state-home",
    "state-reader"
  );
  document.body.classList.add(state);
}

onbStart?.addEventListener("click", () => setState("state-home"));
phBack?.addEventListener("click", () => {
  ph?.classList.remove("show");
});
btnListen?.addEventListener("click", () => {
  ph?.classList.add("show");
});
btnMerch?.addEventListener("click", () => {
  ph?.classList.add("show");
});
btnRead?.addEventListener("click", () => {
  ph?.classList.remove("show");
  setState("state-reader");
  render(currentIndex);
});

// init state
setState("state-onboarding");

// Book data
const pages = [
  {
    type: "demo",
    content: `
    <h2>Глава 1. Пролог</h2>
    <p>Это демо‑страница 1. Книга читается прямо внутри приложения. Текст адаптирован под экран телефона.</p>
    <img src="https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=80" alt="demo1" />
    <p>Легкая, удобная навигация — листайте кнопками по краям экрана.</p>
  `,
  },
  {
    type: "demo",
    content: `
    <h2>Глава 2. Предисловие</h2>
    <p>Это демо‑страница 2. После покупки вы откроете оставшиеся главы.</p>
    <img src="https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=80" alt="demo2" />
    <p>Никаких загрузок — защита от копирования на первом этапе.</p>
  `,
  },
  {
    type: "full",
    content: `
    <h2>Глава 3. Начало</h2>
    <p>Полный доступ открыт. Добро пожаловать в основную часть книги.</p>
  `,
  },
  {
    type: "full",
    content: `
    <h2>Глава 4. Поворот</h2>
    <p>Сюжет углубляется, герои раскрываются, а вы продолжаете читать удобно и безопасно.</p>
  `,
  },
  {
    type: "full",
    content: `
    <h2>Глава 5. Финал</h2>
    <p>Спасибо за покупку! Надеемся, вам понравилось.</p>
  `,
  },
];

let currentIndex = 0;
let hasFullAccess = false;
const pageContainer = document.getElementById("page-container");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const buyBtn = document.getElementById("buyBtn");
const statusEl = document.getElementById("status");

function getUser() {
  const u = tg?.initDataUnsafe?.user;
  return u
    ? {
        user_id: u.id,
        username: u.username || "",
        first_name: u.first_name || "",
        last_name: u.last_name || "",
      }
    : null;
}

async function checkAccess() {
  try {
    const user = getUser();
    if (!user) {
      statusEl.textContent = "Откройте через Telegram";
      return false;
    }
    const res = await fetch("/.netlify/functions/check-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user }),
    });
    const data = await res.json();
    hasFullAccess = !!data.hasFullAccess;
    buyBtn.classList.toggle("hidden", hasFullAccess);
    statusEl.textContent = hasFullAccess ? "Полный доступ" : "Демо-версия";
    return hasFullAccess;
  } catch {
    statusEl.textContent = "Ошибка сети";
    return false;
  }
}

function effectivePages() {
  return hasFullAccess ? pages : pages.filter((p) => p.type === "demo");
}

function render(i) {
  const list = effectivePages();
  if (!list.length) return;
  if (i < 0) i = 0;
  if (i >= list.length) i = list.length - 1;
  currentIndex = i;
  const old = pageContainer.querySelector(".page-inner");
  if (old) {
    old.classList.add("flip-exit");
    setTimeout(() => old.remove(), 300);
  }
  const w = document.createElement("div");
  w.className = "page-inner flip-enter";
  w.innerHTML = list[i].content;
  pageContainer.appendChild(w);
}

prevBtn.addEventListener("click", () => render(currentIndex - 1));
nextBtn.addEventListener("click", () => render(currentIndex + 1));

let touchStartX = null;
pageContainer.addEventListener(
  "touchstart",
  (e) => {
    touchStartX = e.changedTouches[0].clientX;
  },
  { passive: true }
);
pageContainer.addEventListener("touchend", (e) => {
  if (touchStartX == null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 40) {
    if (dx < 0) render(currentIndex + 1);
    else render(currentIndex - 1);
  }
  touchStartX = null;
});

buyBtn.addEventListener("click", async () => {
  const user = getUser();
  if (!user) {
    statusEl.textContent = "Откройте через Telegram";
    return;
  }
  buyBtn.disabled = true;
  buyBtn.textContent = "Отправляем заявку...";
  try {
    const res = await fetch("/.netlify/functions/create-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user }),
    });
    const data = await res.json();
    statusEl.textContent = data.ok
      ? "Заявка отправлена. Ожидайте подтверждения."
      : "Ошибка: " + (data.error || "неизвестно");
  } catch {
    statusEl.textContent = "Ошибка сети";
  } finally {
    buyBtn.disabled = false;
    buyBtn.textContent = "Купить полную версию";
  }
});

(async function init() {
  render(0);
  await checkAccess();
})();
