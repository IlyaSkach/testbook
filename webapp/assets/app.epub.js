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
    // Загружаем файл (без предварительного HEAD — в WebView бывает заблокирован)
    const res = await fetch(`/assets/book.epub?v=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("epub fetch failed");
    const buf = await res.arrayBuffer();
    const blob = new Blob([buf], { type: "application/epub+zip" });

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
    // Попробуем по очереди: ArrayBuffer → Blob → ObjectURL
    let createdUrl = null;
    try {
      book = window.ePub(buf);
    } catch (_) {
      try {
        book = window.ePub(blob);
      } catch (_) {
        createdUrl = URL.createObjectURL(blob);
        book = window.ePub(createdUrl);
      }
    }
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
    // Попробуем открыть сохранённую позицию; если её раздела нет — очищаем и открываем начало
    const nav = await book.loaded.navigation.catch(() => null);
    const startHref = nav?.toc?.[0]?.href || undefined;
    const lastCfi = localStorage.getItem(STORE_KEY_CFI);
    let opened = false;
    if (lastCfi) {
      try {
        await Promise.race([
          rendition.display(lastCfi),
          new Promise((_, rej) =>
            setTimeout(() => rej(new Error("display timeout")), 8000)
          ),
        ]);
        opened = true;
      } catch (_) {
        try {
          localStorage.removeItem(STORE_KEY_CFI);
        } catch (_) {}
      }
    }
    if (!opened) {
      await Promise.race([
        startHref ? rendition.display(startHref) : rendition.display(),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error("display timeout")), 8000)
        ),
      ]);
    }

    // Тема: увеличенный шрифт и корректные отступы, запрет выхода за край
    rendition.themes.register("tg", {
      "html, body": {
        margin: 0,
        padding: 0,
        background: "transparent",
        overflowX: "hidden",
      },
      body: {
        fontSize: "18px",
        lineHeight: "1.6",
        color: "#e6e6e6",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
        WebkitHyphens: "auto",
        hyphens: "auto",
        boxSizing: "border-box",
        padding: "12px 16px 16px 16px",
        maxWidth: "100%",
      },
      // Сброс любых внутренних увеличений шрифта, кроме заголовков
      "body *": { fontSize: "inherit !important", color: "#e6e6e6" },
      h1: { fontSize: "1.4em !important", color: "#ffffff" },
      h2: { fontSize: "1.3em !important", color: "#ffffff" },
      h3: { fontSize: "1.2em !important", color: "#ffffff" },
      p: { margin: "0 0 1em", color: "#e6e6e6 !important" },
      li: { color: "#e6e6e6 !important" },
      a: { color: "#a3d3ff !important" },
      img: {
        maxWidth: "100% !important",
        height: "auto !important",
        display: "block",
      },
      svg: { maxWidth: "100% !important" },
    });
    rendition.themes.select("tg");
    // Доп. масштаб
    let currentFontPercent = parseInt(
      localStorage.getItem(STORE_KEY_FONT) || "112",
      10
    );
    if (Number.isNaN(currentFontPercent)) currentFontPercent = 112;
    rendition.themes.override("font-size", currentFontPercent + "%", true);

    // Контролы шрифта
    function applyFont() {
      const min = 90,
        max = 160;
      if (currentFontPercent < min) currentFontPercent = min;
      if (currentFontPercent > max) currentFontPercent = max;
      rendition.themes.override("font-size", currentFontPercent + "%", true);
      try {
        localStorage.setItem(STORE_KEY_FONT, String(currentFontPercent));
      } catch (_) {}
    }
    fontIncBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      currentFontPercent += 6;
      applyFont();
    });
    fontDecBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
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

    // TOC: если в EPUB нет нормального nav, соберём оглавление из spine
    try {
      const navData = await book.loaded.navigation;
      let tocItems = Array.isArray(navData?.toc) ? navData.toc.slice() : [];
      const badNav =
        !tocItems.length ||
        tocItems.every((it) => String(it?.href || "").match(/\b(toc|nav)\b/i));
      if (badNav) {
        const spine = book?.spine?.items || [];
        tocItems = spine.map((it, idx) => ({
          href: it?.href,
          label: it?.idref || `Глава ${idx + 1}`,
        }));
      }
      buildToc(tocItems);
    } catch (_) {
      try {
        const spine = book?.spine?.items || [];
        const fallbackToc = spine.map((it, idx) => ({
          href: it?.href,
          label: it?.idref || `Глава ${idx + 1}`,
        }));
        buildToc(fallbackToc);
      } catch (_) {}
    }

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
    if (createdUrl) {
      // освободим URL позже
      setTimeout(() => URL.revokeObjectURL(createdUrl), 15000);
    }
  } catch (e) {
    console.error("EPUB error", e);
    statusEl.textContent = `EPUB не загрузился: ${e?.message || "unknown"}`;
  }
}

function buildToc(items) {
  function labelOf(it, idx) {
    const raw = it?.label || it?.title || it?.text || it?.idref || it?.id;
    if (typeof raw === "string") return raw.trim() || `Глава ${idx + 1}`;
    if (raw && typeof raw.toString === "function")
      return raw.toString() || `Глава ${idx + 1}`;
    return `Глава ${idx + 1}`;
  }
  function hrefOf(it) {
    return it?.href || it?.url || it?.canonical || it?.href?.href || null;
  }
  async function improveLabels(list) {
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      let label = it.label;
      try {
        const sec = await book.load(it.href);
        const html = await sec
          ?.render()
          .then((r) => r?.document?.body?.innerHTML || "");
        const m = html && html.match(/<(h1|h2)[^>]*>([\s\S]*?)<\/\1>/i);
        if (m) label = m[2].replace(/<[^>]+>/g, "").trim() || label;
      } catch (_) {}
      out.push({ href: it.href, label: label || `Глава ${i + 1}` });
    }
    return out;
  }
  // Если nav пуст — собираем из spine
  let list = Array.isArray(items) ? items.slice() : [];
  if (!list.length && book?.spine?.items?.length) {
    list = book.spine.items.map((sp, i) => ({
      href: hrefOf(sp) || sp?.href,
      label: sp?.idref || `Глава ${i + 1}`,
    }));
  }
  list = list
    .map((it, idx) => ({ href: hrefOf(it), label: labelOf(it, idx) }))
    .filter((it) => !!it.href);
  if (!list.length) return;
  tocList.innerHTML = "";
  (async () => {
    const improved = await improveLabels(list);
    // Оставляем только «Глава …» и «Эпилог»
    let wanted = improved.filter((it) =>
      /^(?:глава\b|эпилог\b)/i.test(it.label || "")
    );
    if (!wanted.length) wanted = improved; // запасной вариант
    wanted.forEach((it, idx) => {
      const row = document.createElement("button");
      row.className = "toc-item";
      row.innerHTML = `
        <span class="toc-level">${String(idx + 1).padStart(2, "0")}</span>
        <span class="toc-title">${it.label}</span>
        <span class="toc-page"></span>
      `;
      row.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        tocEl.classList.remove("show");
        try {
          await rendition?.display(it.href);
        } catch (_) {}
      });
      tocList.appendChild(row);
    });
  })();
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
  readerEl.classList.add("mode-epub");
  await initEpub();
});

setState("state-onboarding");
