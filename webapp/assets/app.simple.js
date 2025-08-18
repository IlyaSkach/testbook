// Simple reader: loads chapters as HTML fragments, paginates to full-screen pages, tap to navigate

const tg = window.Telegram?.WebApp;
tg?.expand?.();
tg?.disableVerticalSwipes?.();

document.addEventListener("contextmenu", (e) => e.preventDefault());

// UI
const onbStart = document.getElementById("onbStart");
const ph = document.getElementById("placeholder");
const phBack = document.getElementById("phBack");
const btnRead = document.getElementById("btnRead");
const headerEl = document.querySelector(".app-header");
const footerEl = document.querySelector(".app-footer");
const readerEl = document.getElementById("reader");
const statusEl = document.getElementById("status");
const pageContainer = document.getElementById("page-container");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

// Config
const CHAPTER_URLS = ["/assets/chapters/ch1.html", "/assets/chapters/ch2.html"];
const DEFAULT_SECTIONS = [
  "<h2>ГЛАВА 1</h2><p>Текст главы недоступен. Проверьте файлы в /assets/chapters/</p>",
];

// State
let PAGES = [];
let currentIndex = 0;

// Helpers
function setState(state) {
  document.body.classList.remove(
    "state-onboarding",
    "state-home",
    "state-reader"
  );
  document.body.classList.add(state);
}

function getViewportSize() {
  const headerH = headerEl?.getBoundingClientRect?.().height || 0;
  const footerH = footerEl?.getBoundingClientRect?.().height || 0;
  const width =
    pageContainer.clientWidth || readerEl.clientWidth || window.innerWidth;
  let height =
    pageContainer.clientHeight ||
    readerEl.clientHeight ||
    window.innerHeight - headerH - footerH;
  if (!height || height < 100)
    height = Math.max(100, window.innerHeight - headerH - footerH);
  return { width, height };
}

function createMeasureHost() {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-99999px";
  host.style.top = "0";
  const { width, height } = getViewportSize();
  host.style.width = width + "px";
  host.style.height = height + "px";
  host.className = "page-inner";
  document.body.appendChild(host);
  return host;
}

function sanitize(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const out = [];
  function pushText(text) {
    const t = (text || "").replace(/\s+/g, " ").trim();
    if (t) out.push(`<p>${t}</p>`);
  }
  tpl.content.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      pushText(node.textContent);
    } else if (node.nodeType === 1) {
      const tag = node.tagName;
      if (tag === "IMG") return; // skip images
      if (tag === "H1" || tag === "H2" || tag === "H3")
        out.push(node.outerHTML);
      else if (tag === "P") pushText(node.textContent);
      else pushText(node.textContent);
    }
  });
  return out.join("");
}

function htmlToNodes(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html.trim();
  return Array.from(tpl.content.childNodes);
}

function isTextParagraph(node) {
  return (
    node?.nodeType === 1 &&
    node.tagName === "P" &&
    Array.from(node.childNodes).every(
      (n) => n.nodeType === 3 || (n.nodeType === 1 && n.tagName === "BR")
    )
  );
}

function splitParagraphByWords(p, host, maxHeight) {
  const words = p.textContent.split(/(\s+)/);
  const first = document.createElement("p");
  const rest = document.createElement("p");
  first.textContent = "";
  host.appendChild(first);
  let i = 0;
  while (i < words.length) {
    first.textContent = first.textContent + words[i];
    i++;
    if (host.scrollHeight > maxHeight) {
      first.textContent = first.textContent
        .slice(0, -words[i - 1].length)
        .replace(/\s+$/, "");
      const remainder = words.slice(i - 1);
      if (remainder.length && /^\s+$/.test(remainder[0])) remainder.shift();
      rest.textContent = remainder.join("");
      break;
    }
  }
  host.removeChild(first);
  return { first, rest: rest.textContent ? rest : null };
}

function paginateSectionsToPages(sections) {
  const normalized = sections.map(sanitize);
  const { height } = getViewportSize();
  const maxHeight = Math.max(0, height - 18);
  const host = createMeasureHost();
  const pages = [];

  function pushPage() {
    pages.push({ content: host.innerHTML });
    host.innerHTML = "";
  }

  const queue = [];
  normalized.forEach((h) => queue.push(h));

  while (queue.length) {
    const sectionHtml = queue.shift();
    const nodes = htmlToNodes(sectionHtml);
    for (let node of nodes) {
      if (node.nodeType === 3 && !node.textContent.trim()) continue;
      host.appendChild(node);
      if (host.scrollHeight > maxHeight) {
        host.removeChild(node);
        if (isTextParagraph(node)) {
          const { first, rest } = splitParagraphByWords(node, host, maxHeight);
          if (first.textContent) host.appendChild(first);
          pushPage();
          if (rest) queue.unshift(rest.outerHTML);
          const remaining = Array.from(
            nodes.slice(nodes.indexOf(node) + 1)
          ).map((n) => n.outerHTML || n.textContent);
          for (let i = remaining.length - 1; i >= 0; i--)
            queue.unshift(remaining[i]);
          break;
        } else {
          pushPage();
          host.appendChild(node);
          if (host.scrollHeight > maxHeight) pushPage();
        }
      }
    }
  }
  if (host.innerHTML.trim()) pushPage();
  host.remove();
  return pages.map((p, i) => ({
    type: i < 2 ? "demo" : "full",
    content: p.content,
  }));
}

async function loadChapters() {
  statusEl.textContent = "Загрузка книги...";
  const results = await Promise.all(
    CHAPTER_URLS.map(async (u) => {
      try {
        const r = await fetch(`${u}?v=${Date.now()}`, { cache: "no-store" });
        if (r.ok) return await r.text();
      } catch (_) {}
      try {
        const r2 = await fetch(`${u.replace(/^\//, "")}?v=${Date.now()}`, {
          cache: "no-store",
        });
        if (r2.ok) return await r2.text();
      } catch (_) {}
      return "";
    })
  );
  const sections = results.filter(Boolean);
  return sections.length ? sections : DEFAULT_SECTIONS;
}

function render(i) {
  if (!PAGES.length) return;
  if (i < 0) i = 0;
  if (i >= PAGES.length) i = PAGES.length - 1;
  currentIndex = i;
  const old = pageContainer.querySelector(".page-inner");
  if (old) {
    old.classList.add("flip-exit");
    setTimeout(() => old.remove(), 300);
  }
  const w = document.createElement("div");
  w.className = "page-inner flip-enter";
  w.innerHTML = PAGES[i].content;
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

onbStart?.addEventListener("click", () => setState("state-home"));
phBack?.addEventListener("click", () => ph?.classList.remove("show"));
btnRead?.addEventListener("click", async () => {
  ph?.classList.remove("show");
  setState("state-reader");
  try {
    const sections = await loadChapters();
    await new Promise((r) => requestAnimationFrame(r));
    PAGES = paginateSectionsToPages(sections);
    render(0);
    statusEl.textContent = `Страниц: ${PAGES.length}`;
  } catch (e) {
    statusEl.textContent = "Ошибка загрузки";
  }
});

setState("state-onboarding");
