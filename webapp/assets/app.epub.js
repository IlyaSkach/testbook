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
const accessLabel = document.getElementById("accessLabel");
const paywallEl = document.getElementById("paywall");
const payBuyBtn = document.getElementById("payBuy");
const payCloseBtn = document.getElementById("payClose");
const buyBtn = document.getElementById("buyBtn");
let PUBLIC_CFG = { support_username: "SkIlyaA", price_rub: 555 };
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
let hasFullAccess = false;
let demoMode = true; // если нет доступа — показываем только первую главу
let FIRST_HREF = null;
let paywallShownOnce = false;
let demoArmed = false;
let CH1_HREF = null;
const ALLOWED_DEMO_HREFS = new Set();

async function initEpub() {
  statusEl.textContent = "Загрузка EPUB...";
  try {
    // 1) Получим публичную конфигурацию (цена и username) и проверим доступ
    try {
      const cfgRes = await fetch("/.netlify/functions/public-config", {
        cache: "no-store",
      });
      const cfg = await cfgRes.json();
      if (cfg?.ok) PUBLIC_CFG = cfg;
      const priceText = document.getElementById("priceText");
      if (priceText)
        priceText.textContent = `Купить за ${PUBLIC_CFG.price_rub} ₽`;
    } catch (_) {}
    try {
      const initDataUnsafe = tg?.initDataUnsafe;
      const user = initDataUnsafe?.user || null;
      const resp = await fetch("/.netlify/functions/check-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user }),
      });
      const d = await resp.json();
      hasFullAccess = !!d?.hasFullAccess;
      demoMode = !hasFullAccess;
    } catch (_) {}
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
    // Сохраним первую главу заранее
    try {
      FIRST_HREF = book?.spine?.items?.[0]?.href || null;
    } catch (_) {}

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
        setTimeout(() => rej(new Error("book ready timeout")), 20000)
      ),
    ]);
    // Попробуем открыть сохранённую позицию; если её раздела нет — очищаем и открываем начало
    const nav = await book.loaded.navigation.catch(() => null);
    const startHref = nav?.toc?.[0]?.href || undefined;
    // Выберем первую содержательную главу (пропустим обложку/титул)
    try {
      const picked = await selectFirstChapterHref(book, nav);
      if (picked) FIRST_HREF = picked;
    } catch (_) {}
    // Найдём явно "ГЛАВА 1" и разрешим её в демо дополнительно
    try {
      CH1_HREF = await findHrefByLabel(nav, /^\s*ГЛАВА\s*1\b/i);
    } catch (_) {}
    // Если не нашли в TOC по лейблу — попробуем прочитать заголовок из секции
    if (!CH1_HREF) {
      try {
        CH1_HREF = await findHrefByHeading(book, nav, /^\s*ГЛАВА\s*1\b/i);
      } catch (_) {}
    }
    // Если всё ещё нет — разрешим следующий раздел после первой содержательной главы
    if (!CH1_HREF) {
      try {
        const spine = book?.spine?.items || [];
        const firstN = normalizeHref(FIRST_HREF || "");
        const idx = spine.findIndex((it) => normalizeHref(it?.href) === firstN);
        if (idx >= 0 && spine[idx + 1]?.href) CH1_HREF = spine[idx + 1].href;
      } catch (_) {}
    }
    // Заполним whitelist демо
    ALLOWED_DEMO_HREFS.clear();
    if (FIRST_HREF) ALLOWED_DEMO_HREFS.add(normalizeHref(FIRST_HREF));
    if (CH1_HREF) ALLOWED_DEMO_HREFS.add(normalizeHref(CH1_HREF));
    const lastCfi = demoMode ? null : localStorage.getItem(STORE_KEY_CFI);
    let opened = false;
    let initialDisplayed = false;
    if (lastCfi) {
      try {
        await Promise.race([
          rendition.display(lastCfi).then(() => (initialDisplayed = true)),
          new Promise((_, rej) =>
            setTimeout(() => rej(new Error("display timeout")), 20000)
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
      const target = demoMode
        ? FIRST_HREF || startHref
        : startHref || undefined;
      await Promise.race([
        (target ? rendition.display(target) : rendition.display()).then(
          () => (initialDisplayed = true)
        ),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error("display timeout")), 20000)
        ),
      ]);
    }

    // fallback если не отрисовалось
    if (!initialDisplayed) {
      try {
        const fallbackHref =
          FIRST_HREF || book?.spine?.items?.[0]?.href || null;
        if (fallbackHref) {
          await rendition.display(fallbackHref);
          initialDisplayed = true;
        }
      } catch (_) {}
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
      // Выводим текущий раздел для диагностики синих экранов
      statusEl.textContent = `Раздел: ${normalizeHref(
        location?.start?.href || ""
      )}`;
    });
    rendition.on("rendered", () => {
      // Если всё хорошо — очищаем статус
      setTimeout(() => {
        statusEl.textContent = "";
      }, 300);
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
      FIRST_HREF =
        FIRST_HREF ||
        book?.spine?.items?.[0]?.href ||
        tocItems?.[0]?.href ||
        null;
      buildToc(tocItems);
    } catch (_) {
      try {
        const spine = book?.spine?.items || [];
        const fallbackToc = spine.map((it, idx) => ({
          href: it?.href,
          label: it?.idref || `Глава ${idx + 1}`,
        }));
        FIRST_HREF =
          FIRST_HREF ||
          book?.spine?.items?.[0]?.href ||
          fallbackToc?.[0]?.href ||
          null;
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
    rendition.on("rendered", () => {
      statusEl.textContent = "";
    });
    // Применим демо-ограничение
    enforceDemo();
    // UI-индикатор доступа и видимость оглавления
    if (accessLabel)
      accessLabel.textContent = demoMode ? "Демо версия" : "Полная версия";
    if (tocBtn) tocBtn.style.display = demoMode ? "none" : "inline-block";
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
    // Удаляем короткие дубликаты "Глава N" при наличии развернутого названия
    const keyOf = (s) => {
      const m = String(s || "").match(/^\s*глава\s*(\d+)\b/i);
      if (m) return `g-${m[1]}`;
      if (/^\s*эпилог\b/i.test(String(s || ""))) return "g-epilogue";
      return null;
    };
    const bestByKey = new Map();
    const order = [];
    for (const it of wanted) {
      const k = keyOf(it.label);
      if (!k) {
        order.push(it);
        continue;
      }
      const prev = bestByKey.get(k);
      if (!prev) {
        bestByKey.set(k, it);
      } else if (String(it.label).length > String(prev.label).length) {
        bestByKey.set(k, it);
      }
    }
    const deduped = [];
    const usedKeys = new Set();
    for (const it of wanted) {
      const k = keyOf(it.label);
      if (!k) {
        deduped.push(it);
        continue;
      }
      const winner = bestByKey.get(k);
      if (winner && !usedKeys.has(k)) {
        deduped.push(winner);
        usedKeys.add(k);
      }
    }
    const finalList = deduped.length ? deduped : wanted;

    finalList.forEach((it, idx) => {
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

// DEMO: перехват переходов между главами и показ пейволла
function normalizeHref(href) {
  if (!href) return "";
  try {
    return String(href).split("#")[0];
  } catch (_) {
    return String(href || "");
  }
}

function enforceDemo() {
  if (!demoMode) return;
  // Разрешаем только 1-ю главу. При попытке уйти — возвращаем и один раз показываем пейволл
  rendition.on("relocated", (location) => {
    try {
      const curHref = normalizeHref(location?.start?.href);
      const first = normalizeHref(FIRST_HREF || book?.spine?.items?.[0]?.href);
      if (!first || !curHref) return;
      // Активируем ограничение только после первого открытия первой главы
      if (
        (curHref === first || ALLOWED_DEMO_HREFS.has(curHref)) &&
        !demoArmed
      ) {
        demoArmed = true;
        return;
      }
      if (!ALLOWED_DEMO_HREFS.has(curHref)) {
        // Если ещё не "armed" — мягко вернём без пейволла (инициализация)
        if (!demoArmed) {
          if (FIRST_HREF) rendition.display(FIRST_HREF);
          return;
        }
        // Armed: блокируем уход со 1-й главы, показываем пейволл один раз
        if (FIRST_HREF) rendition.display(FIRST_HREF);
        if (!paywallShownOnce) {
          paywallShownOnce = true;
          showPaywall();
        }
      }
    } catch (_) {}
  });
}

// Выбираем первую содержательную главу: пропускаем cover/title/toc/nav
async function selectFirstChapterHref(book, nav) {
  try {
    // 1) Сначала пробуем по nav.toc
    const toc = Array.isArray(nav?.toc) ? nav.toc : [];
    const good = (href) =>
      href && !/\b(cover|title|toc|nav)\b/i.test(String(href));
    for (const it of toc) {
      const href = it?.href || it?.url || it?.canonical;
      if (good(href)) return href;
    }
    // 2) Потом по spine
    const spine = book?.spine?.items || [];
    for (const it of spine) {
      const href = it?.href || it?.url || it?.canonical;
      if (good(href)) return href;
    }
  } catch (_) {}
  return null;
}

// Поиск раздела в TOC по тексту лейбла
async function findHrefByLabel(nav, re) {
  try {
    const toc = Array.isArray(nav?.toc) ? nav.toc : [];
    for (const it of toc) {
      const lbl = String(it?.label || it?.title || it?.text || "").trim();
      const href = it?.href || it?.url || it?.canonical;
      if (re.test(lbl) && href) return href;
    }
  } catch (_) {}
  return null;
}

// Поиск раздела, где первый h1/h2 соответствует regex
async function findHrefByHeading(book, nav, re) {
  try {
    const checkList = [];
    const toc = Array.isArray(nav?.toc) ? nav.toc : [];
    if (toc.length) {
      for (const it of toc)
        checkList.push(it?.href || it?.url || it?.canonical);
    }
    const spine = book?.spine?.items || [];
    for (const it of spine)
      checkList.push(it?.href || it?.url || it?.canonical);
    for (const href of checkList) {
      const h = href && String(href);
      if (!h) continue;
      try {
        const sec = await book.load(h);
        const html = await sec
          ?.render()
          .then((r) => r?.document?.body?.innerHTML || "");
        const m = html && html.match(/<(h1|h2)[^>]*>([\s\S]*?)<\/\1>/i);
        if (m) {
          const title = m[2].replace(/<[^>]+>/g, "").trim();
          if (re.test(title)) return h;
        }
      } catch (_) {}
    }
  } catch (_) {}
  return null;
}

function showPaywall() {
  paywallEl?.classList.add("show");
}
function hidePaywall() {
  paywallEl?.classList.remove("show");
}

payCloseBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  hidePaywall();
});

payBuyBtn?.addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    const initDataUnsafe = tg?.initDataUnsafe;
    const user = initDataUnsafe?.user || null;
    if (!user?.id) {
      alert("Откройте приложение через Telegram, чтобы оформить покупку.");
      return;
    }
    await fetch("/.netlify/functions/create-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user }),
    });
  } catch (_) {}
  // Откроем ЛС саппорта (username из конфига)
  const un = PUBLIC_CFG.support_username || "SkIlyaA";
  try {
    tg?.openTelegramLink?.(`https://t.me/${un}`);
  } catch (_) {
    window.open(`https://t.me/${un}`, "_blank");
  }
});

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
