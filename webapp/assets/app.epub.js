// EPUB-only reader: robust load as Blob + ePub.js render with tap/swipe navigation

const tg = window.Telegram?.WebApp;
try {
  tg?.expand?.();
} catch (_) {}
try {
  tg?.disableVerticalSwipes?.();
} catch (_) {}

document.addEventListener("contextmenu", (e) => e.preventDefault());

// UI refs
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
const tocBtn = document.getElementById("tocBtn");
const tocEl = document.getElementById("toc");
const tocClose = document.getElementById("tocClose");
const tocList = document.getElementById("tocList");
const fontIncBtn = document.getElementById("fontInc");
const fontDecBtn = document.getElementById("fontDec");
const STORE_KEY_FONT = "epub_font_percent";
const STORE_KEY_CFI = "epub_last_cfi";

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

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

let rendition = null;
let book = null;

async function initEpub() {
  statusEl.textContent = "Загрузка EPUB...";
  try {
    // 1) Убедимся, что файл доступен
    const head = await fetch(`/assets/book.epub?v=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
    });
    if (!head.ok) {
      statusEl.textContent = "EPUB не найден";
      return;
    }
    // 2) Загружаем как Blob, чтобы исключить CORS/кеш проблемы
    const res = await fetch(`/assets/book.epub?v=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("epub fetch failed");
    const blob = await res.blob();

    // 3) Грузим зависимости: JSZip, затем ePub.js (локально, затем CDN)
    try {
      await loadScript(`/assets/vendor/jszip.min.js?v=${Date.now()}`);
    } catch (_) {
      await loadScript(
        "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"
      );
    }
    try {
      await loadScript(`/assets/vendor/epub.min.js?v=${Date.now()}`);
    } catch (_) {
      await loadScript("https://unpkg.com/epubjs/dist/epub.min.js");
    }

    // 4) Рендер
    const { width, height } = getViewportSize();
    pageContainer.innerHTML = "";
    // ВАЖНО: передаём сам Blob, иначе ePub.js считает, что это папка и пытается загрузить /META-INF/container.xml
    book = window.ePub(blob);
    rendition = book.renderTo("page-container", {
      width,
      height,
      flow: "paginated",
      spread: "none",
      allowScriptedContent: false,
      manager: "default",
    });

    await Promise.race([
      book.ready,
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("book ready timeout")), 8000)
      ),
    ]);
    const lastCfi = localStorage.getItem(STORE_KEY_CFI);
    await Promise.race([
      lastCfi ? rendition.display(lastCfi) : rendition.display(),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("display timeout")), 8000)
      ),
    ]);

    // Тема: увеличенный шрифт и корректные отступы, запрет выхода за край
    rendition.themes.register("tg", {
      "html, body": { margin: 0, padding: 0, background: "transparent" },
      body: {
        fontSize: "18px",
        lineHeight: "1.6",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
        WebkitHyphens: "auto",
        hyphens: "auto",
        boxSizing: "border-box",
        padding: "16px 16px 24px 16px",
      },
      p: { margin: "0 0 1em" },
      img: { maxWidth: "100% !important", height: "auto !important" },
    });
    rendition.themes.select("tg");
    // Доп. масштаб
    let currentFontPercent = parseInt(
      localStorage.getItem(STORE_KEY_FONT) || "112",
      10
    );
    if (Number.isNaN(currentFontPercent)) currentFontPercent = 112;
    rendition.themes.fontSize(currentFontPercent + "%");

    // Контролы шрифта
    function applyFont() {
      const min = 90,
        max = 160;
      if (currentFontPercent < min) currentFontPercent = min;
      if (currentFontPercent > max) currentFontPercent = max;
      rendition.themes.fontSize(currentFontPercent + "%");
      try {
        localStorage.setItem(STORE_KEY_FONT, String(currentFontPercent));
      } catch (_) {}
    }
    fontIncBtn?.addEventListener("click", () => {
      currentFontPercent += 6;
      applyFont();
    });
    fontDecBtn?.addEventListener("click", () => {
      currentFontPercent -= 6;
      applyFont();
    });

    prevBtn.onclick = (e) => {
      e.stopPropagation();
      rendition.prev();
    };
    nextBtn.onclick = (e) => {
      e.stopPropagation();
      rendition.next();
    };
    rendition.on("relocated", (location) => {
      try {
        localStorage.setItem(STORE_KEY_CFI, location?.start?.cfi || "");
      } catch (_) {}
    });

    // TOC
    try {
      const nav = await book.loaded.navigation;
      buildToc(nav?.toc || []);
    } catch (_) {}

    // Resize handling
    let resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const { width: w, height: h } = getViewportSize();
        rendition?.resize(w, h);
      }, 150);
    });

    statusEl.textContent = "EPUB";
  } catch (e) {
    console.error("EPUB error", e);
    statusEl.textContent = "EPUB не загрузился";
  }
}

function buildToc(items) {
  if (!Array.isArray(items) || !items.length) return;
  tocList.innerHTML = "";
  items.forEach((it) => {
    const row = document.createElement("button");
    row.className = "toc-item";
    row.innerHTML = `
      <span class="toc-level">EPUB</span>
      <span class="toc-title">${(
        it.label ||
        it.title ||
        "Без названия"
      ).toString()}</span>
      <span class="toc-page"></span>
    `;
    row.addEventListener("click", async () => {
      tocEl.classList.remove("show");
      try {
        await rendition?.display(it.href);
      } catch (_) {}
    });
    tocList.appendChild(row);
  });
  tocBtn?.addEventListener("click", () => tocEl.classList.add("show"));
  tocClose?.addEventListener("click", () => tocEl.classList.remove("show"));
}

// Touch swipe
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
    if (dx < 0) rendition?.next();
    else rendition?.prev();
  }
  touchStartX = null;
});

// Buttons and state
onbStart?.addEventListener("click", () => setState("state-home"));
phBack?.addEventListener("click", () => ph?.classList.remove("show"));
btnRead?.addEventListener("click", async () => {
  ph?.classList.remove("show");
  setState("state-reader");
  await initEpub();
});

setState("state-onboarding");
