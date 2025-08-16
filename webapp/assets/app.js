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

// --------- АВТОПАГИНАЦИЯ ---------
let BOOK_PAGES = null; // итоговые страницы после пагинации

function getViewportSize() {
  const rect = pageContainer.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

function createMeasureHost() {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-99999px";
  host.style.top = "0";
  host.style.width = getViewportSize().width + "px";
  host.style.height = getViewportSize().height + "px";
  host.className = "page-inner"; // чтобы совпала типографика/отступы
  document.body.appendChild(host);
  return host;
}

function htmlToNodes(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html.trim();
  return Array.from(tpl.content.childNodes);
}

function isTextParagraph(node) {
  return (
    node.nodeType === 1 &&
    node.tagName === "P" &&
    Array.from(node.childNodes).every(
      (n) => n.nodeType === 3 || (n.nodeType === 1 && n.tagName === "BR")
    )
  );
}

function splitParagraphByWords(p, host, maxHeight) {
  const words = p.textContent.split(/(\s+)/); // сохраняем пробелы
  const first = document.createElement("p");
  const rest = document.createElement("p");
  let i = 0;
  first.textContent = "";
  host.appendChild(first);
  while (i < words.length) {
    const next = first.textContent + words[i];
    first.textContent = next;
    i++;
    if (host.scrollHeight > maxHeight) {
      // откат последнего слова
      first.textContent = first.textContent.slice(
        0,
        -(words[i - 1] || "").length
      );
      // остаток
      rest.textContent = words.slice(i - 1).join("");
      break;
    }
  }
  host.removeChild(first);
  return { first, rest: rest.textContent ? rest : null };
}

function paginateSectionsToPages(sections) {
  const { height } = getViewportSize();
  const maxHeight = height; // учитываем паддинги класса page-inner
  const host = createMeasureHost();
  const pages = [];

  function pushPageFromHost() {
    pages.push({ content: host.innerHTML });
    host.innerHTML = "";
  }

  const queue = [];
  sections.forEach((h) => queue.push(h));

  while (queue.length) {
    const sectionHtml = queue.shift();
    const nodes = htmlToNodes(sectionHtml);
    for (let node of nodes) {
      if (node.nodeType === 3 && !node.textContent.trim()) continue;
      // Полноэкранные картинки — отдельной страницей
      if (
        node.nodeType === 1 &&
        node.tagName === "IMG" &&
        node.classList.contains("full-img")
      ) {
        if (host.innerHTML.trim()) pushPageFromHost();
        host.innerHTML = "";
        host.appendChild(node);
        pushPageFromHost();
        continue;
      }
      host.appendChild(node);
      if (host.scrollHeight > maxHeight) {
        host.removeChild(node);
        // если это простой параграф — делим по словам
        if (isTextParagraph(node)) {
          const { first, rest } = splitParagraphByWords(node, host, maxHeight);
          host.appendChild(first);
          pushPageFromHost();
          host.innerHTML = "";
          if (rest) {
            // добавляем остаток обратно в очередь перед следующими элементами
            queue.unshift(rest.outerHTML);
          }
          // оставшиеся узлы этой секции тоже вернуть в очередь
          const remaining = Array.from(
            nodes.slice(nodes.indexOf(node) + 1)
          ).map((n) => n.outerHTML || n.textContent);
          for (let i = remaining.length - 1; i >= 0; i--)
            queue.unshift(remaining[i]);
          break;
        } else {
          // сложный блок: завершаем текущую страницу и переносим блок на следующую
          pushPageFromHost();
          host.appendChild(node);
          if (host.scrollHeight > maxHeight) {
            // если один элемент всё ещё больше, просто делаем его отдельной страницей
            pushPageFromHost();
          }
        }
      }
    }
  }
  if (host.innerHTML.trim()) pushPageFromHost();
  host.remove();
  // пометим первые 2 как демо
  return pages.map((p, i) => ({
    type: i < 2 ? "demo" : "full",
    content: p.content,
  }));
}

async function loadBookPages() {
  try {
    const res = await fetch("/assets/book.json", { cache: "no-store" });
    if (!res.ok) throw new Error("no book.json");
    const data = await res.json();
    const sections = Array.isArray(data.pages)
      ? data.pages.map((p) => (typeof p === "string" ? p : p.content))
      : Array.isArray(data.sections)
      ? data.sections
      : [];
    if (!sections.length) throw new Error("empty book");
    BOOK_PAGES = paginateSectionsToPages(sections);
  } catch {
    // fallback: короткая демо
    BOOK_PAGES = [
      {
        type: "demo",
        content:
          '<h2>Глава 1. Пролог</h2><p>Демо‑страница 1</p><img class="full-img" src="https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=80" />',
      },
      {
        type: "demo",
        content: "<h2>Глава 2. Предисловие</h2><p>Демо‑страница 2</p>",
      },
      { type: "full", content: "<h2>Глава 3</h2><p>Полная часть</p>" },
    ];
  }
}

function effectivePages() {
  return hasFullAccess
    ? BOOK_PAGES
    : (BOOK_PAGES || []).filter((p) => p.type === "demo");
}

function render(i) {
  const list = effectivePages();
  if (!list || !list.length) return;
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
  await loadBookPages();
  render(0);
  await checkAccess();
})();
