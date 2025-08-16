const tg = window.Telegram?.WebApp;
if (tg) {
  tg.expand?.();
  tg.disableVerticalSwipes?.();
}

// блокируем контекстное меню
document.addEventListener("contextmenu", (e) => e.preventDefault());

// Данные книги: 2 демо + 3 платные
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
    <img src="https://images.unsplash.com/photo-1513477967668-2aaf11838bd0?w=1200&q=80" alt="demo2" />
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
  const user = tg?.initDataUnsafe?.user;
  if (!user) return null;
  return {
    user_id: user.id,
    username: user.username || "",
    first_name: user.first_name || "",
    last_name: user.last_name || "",
  };
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
  } catch (e) {
    statusEl.textContent = "Ошибка сети";
    return false;
  }
}

function render(index) {
  const effectivePages = hasFullAccess
    ? pages
    : pages.filter((p) => p.type === "demo");
  if (index < 0) index = 0;
  if (index >= effectivePages.length) index = effectivePages.length - 1;
  currentIndex = index;

  const old = pageContainer.querySelector(".page-inner");
  if (old) {
    old.classList.add("flip-exit");
    setTimeout(() => old.remove(), 300);
  }

  const wrapper = document.createElement("div");
  wrapper.className = "page-inner flip-enter";
  wrapper.innerHTML = effectivePages[index].content;
  pageContainer.appendChild(wrapper);
}

prevBtn.addEventListener("click", () => {
  render(currentIndex - 1);
});
nextBtn.addEventListener("click", () => {
  render(currentIndex + 1);
});

// свайпы
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
    if (data.ok) {
      statusEl.textContent = "Заявка отправлена. Ожидайте подтверждения.";
    } else {
      statusEl.textContent = "Ошибка: " + (data.error || "неизвестно");
    }
  } catch (e) {
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
