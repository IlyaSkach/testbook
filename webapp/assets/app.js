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
const statusEl = document.getElementById("status");
const tocBtn = document.getElementById("tocBtn");
const tocEl = document.getElementById("toc");
const tocClose = document.getElementById("tocClose");
const tocList = document.getElementById("tocList");

const DEBUG = location.search.includes("debug=1");
function dbg(...args) {
  console.log("[BOOK]", ...args);
  if (DEBUG && statusEl) {
    const msg = args
      .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
      .join(" ");
    statusEl.textContent = `[BOOK] ${msg}`;
  }
}

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
  // показываем «загрузка», а затем в следующем тике грузим книгу
  statusEl.textContent = "Загрузка книги...";
  setTimeout(async () => {
    if (!BOOK_SECTIONS) await loadBookSections();
    // Режим: страницы с тап-навигацией, без скролла
    BOOK_PAGES = paginateSectionsToPages(BOOK_SECTIONS);
    readerEl.classList.remove("mode-chapter");
    render(0);
  }, 0);
});

tocBtn?.addEventListener("click", () => {
  if (!BOOK_SECTIONS && !BOOK_PAGES) return;
  if (!TOC || TOC.length === 0) {
    if (BOOK_SECTIONS) TOC = buildTocFromSections(BOOK_SECTIONS);
    else TOC = buildToc(BOOK_PAGES);
  }
  openToc();
});
tocClose?.addEventListener("click", () => tocEl.classList.remove("show"));

// init state
setState("state-onboarding");

let currentIndex = 0;
let hasFullAccess = false;
const pageContainer = document.getElementById("page-container");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const buyBtn = document.getElementById("buyBtn");
let TOC = [];
let BOOK_SECTIONS = null; // режим чтения по главам

// Встроенная верстка первой главы (режим без book.json)
const DEFAULT_SECTIONS = [
  [
    "<h1>РИЗИ. ПОБЕГ ИЗ ИДЕАЛИТИ</h1>",
    "<p>© 2025, Резеда Снигирь.</p>",
    "<p>Все права защищены. Любое копирование, трансляция или распространение без письменного согласия автора запрещено и является нарушением авторских прав.</p>",
    "<h2>ГЛАВА 1. КРИСТАЛЬНОЕ СЕРДЦЕ</h2>",
    "<p>Среди стеклянных гигантов Идеалити, словно изумруд в бетонной оправе, выделялся уютный деревянный дом Ризи. Зажатый между громадными небоскрёбами, он оставался одним из уцелевших осколков прошлого. Сад Ризи был окружён деревьями и кустарниками, укутан белоснежным покрывалом снега. Он дышал тишиной и гармонией, резко контрастируя с глянцевой стерильностью города.</p>",
    "<p>Ризи вышла из тёплой оранжереи во двор и приятно поёжилась, шумно вдохнув зимний воздух. Девушка стояла на деревянной террасе и заворожённо рассматривала искусственные снежинки, игравшие на голубых ладонях. Одинаковые, как под копирку, они мерцали в свете праздничных фонарей, словно маленькие драгоценные камни на витрине.</p>",
    "<p>Мысли Ризи унеслись в прошлое, к отцу — Фафису. Она вспоминала, как они лепили вместе странные и смешные фигуры из настоящего снега, который заваливал весь сад — в те дни никто не осмеливался выходить на улицу. Да, погода тогда не была идеальной, но в доме царили тепло и душевность.</p>",
    "<p>Вся семья собиралась на ужин: они разжигали камин, а отец тайком читал им удивительные рассказы о чудесах природы, древних волшебных существах и могущественных кристаллах. Эти истории будоражили воображение Ризи, и она с упоением изучала бережно хранимые книги, которые в Идеалити были под запретом.</p>",
    "<p>Ризи подняла голову и окинула идеополис задумчивым взглядом. В канун Нового Блока Идеалити превращался в парк аттракционов и предлагал жителям всё самое лучшее. «Здесь есть всё и даже больше!» — девиз сети идеаполисов отражал всю его суть. Инженерное чудо — искусственный пушистый снег плавно оседал на улицах и преображал их в белоснежную неоновую сказку.</p>",
    "<p>Центральные площади Идеалити украшали гигантские ёлки, парящие в воздухе благодаря антигравитационным технологиям. Их ветви сияли разноцветными огнями и голографическими украшениями, а гирлянды нежно мерцали розовым неоном. Небосвод переливался пурпурным северным сиянием и узорами бриллиантовых звёзд. На фасадах зданий-исполинов появлялись интерактивные видео, оживляющие сцены из сказок, где виртуальные персонажи взаимодействовали с прохожими.</p>",
    "<p>По всему городу виднелись тёплые парящие розовые купола, где царил настоящий праздник. Под ними жители согревались горячим моколадом с блёстками глимор и слушали виртуальные хоры, чьи ангельские голоса разливались по улицам и наполняли их мелодиями праздника. То и дело в воздухе мелькали мерцающие огни от изящных металлизированных кубитов. Дроны помогали украшать дома гирляндами, превращая Идеалити в настоящее произведение искусства — шедевр технократической мысли!</p>",
    "<p>Ризи смаковала волшебное состояние праздника и ощущения Нового Блока, которое она впервые за долгое время могла почувствовать.</p>",
  ].join(""),
];

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
  } catch (e) {
    statusEl.textContent = "Ошибка сети";
    dbg("checkAccess error", e?.message);
    return false;
  }
}

// --------- АВТОПАГИНАЦИЯ ---------
let BOOK_PAGES = null; // итоговые страницы после пагинации

function getViewportSize() {
  return {
    width: pageContainer.clientWidth,
    height: pageContainer.clientHeight,
  };
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
  const words = p.textContent.split(/(\s+)/); // сохраняем пробелы как токены
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
      // откатываем последнее добавленное слово/пробел
      first.textContent = first.textContent.slice(0, -words[i - 1].length);
      // срежем хвостовые пробелы у первой части, чтобы избежать "пустых" строк
      first.textContent = first.textContent.replace(/\s+$/, "");
      // и уберем ведущие пробелы у продолжения
      const remainder = words.slice(i - 1);
      if (remainder.length && /^\s+$/.test(remainder[0])) remainder.shift();
      rest.textContent = remainder.join("");
      break;
    }
  }
  host.removeChild(first);
  return { first, rest: rest.textContent ? rest : null };
}

function sanitizeSection(html) {
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
      if (tag === "IMG") {
        // Картинок не будет: пропускаем
        return;
      } else if (tag === "H1" || tag === "H2" || tag === "H3") {
        out.push(node.outerHTML);
      } else if (tag === "P") {
        // Соберём чистый текст из параграфа, игнорируя вложенные стили
        pushText(node.textContent);
      } else {
        // прочие блочные теги превращаем в параграфы по тексту
        pushText(node.textContent);
      }
    }
  });
  return out.join("");
}

function paginateSectionsToPages(sections) {
  // нормализуем сложный HTML из DOCX, чтобы корректно бить по словам
  const normalized = sections.map(sanitizeSection);
  const { height } = getViewportSize();
  // небольшой запас, чтобы исключить визуальный переполн на реальном экране (округления, трансформации)
  const HEIGHT_FUDGE_PX = 18;
  const maxHeight = Math.max(0, height - HEIGHT_FUDGE_PX);
  const host = createMeasureHost();
  const pages = [];

  function pushPageFromHost() {
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
        if (isTextParagraph(node)) {
          const { first, rest } = splitParagraphByWords(node, host, maxHeight);
          if (first.textContent) host.appendChild(first);
          pushPageFromHost();
          host.innerHTML = "";
          if (rest) {
            queue.unshift(rest.outerHTML);
          }
          const remaining = Array.from(
            nodes.slice(nodes.indexOf(node) + 1)
          ).map((n) => n.outerHTML || n.textContent);
          for (let i = remaining.length - 1; i >= 0; i--)
            queue.unshift(remaining[i]);
          break;
        } else {
          // переносим текущий блок на новую страницу без потерь
          pushPageFromHost();
          host.appendChild(node);
          if (host.scrollHeight > maxHeight) {
            // если один блок слишком высокий, помещаем его как отдельную страницу
            pushPageFromHost();
          }
        }
      }
    }
  }
  if (host.innerHTML.trim()) pushPageFromHost();
  host.remove();
  // пометим первые 2 как демо
  const out = pages.map((p, i) => ({
    type: i < 2 ? "demo" : "full",
    content: p.content,
  }));
  dbg("paginate result pages:", out.length);
  return out;
}

async function loadBookSections() {
  try {
    statusEl.textContent = "Загрузка книги...";
    // Попробуем загрузить book.json; если его нет, используем встроенную первую главу
    let sections = [];
    try {
      const res = await fetch(`/assets/book.json?v=${Date.now()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        sections = Array.isArray(data.sections)
          ? data.sections
          : Array.isArray(data.pages)
          ? data.pages.map((p) => (typeof p === "string" ? p : p.content))
          : [];
      }
    } catch (_) {}
    if (!sections.length) sections = DEFAULT_SECTIONS;
    // режим глав: не режем, только санитайзим
    BOOK_SECTIONS = sections.map(sanitizeSection);
    // оглавление по разделам
    TOC = buildTocFromSections(BOOK_SECTIONS);
    statusEl.textContent = hasFullAccess ? "Полный доступ" : "Демо-версия";
  } catch (e) {
    dbg("loadBookPages error", e?.message);
    statusEl.textContent = "Ошибка загрузки книги";
    BOOK_SECTIONS = DEFAULT_SECTIONS;
  }
}

function buildToc(pages) {
  const toc = [];
  const headingRegex = /<(h[1-3])[^>]*>(.*?)<\/\1>/gi;
  for (let i = 0; i < pages.length; i++) {
    const html = pages[i].content || "";
    let match;
    while ((match = headingRegex.exec(html))) {
      const level = match[1];
      const title = match[2].replace(/<[^>]+>/g, "").trim();
      if (title) toc.push({ title, level, pageIndex: i });
    }
  }
  return toc;
}

function buildTocFromSections(sections) {
  const toc = [];
  const headingRegex = /<(h[1-3])[^>]*>(.*?)<\/\1>/i;
  for (let i = 0; i < sections.length; i++) {
    const html = sections[i] || "";
    const m = html.match(headingRegex);
    if (m) {
      const level = m[1];
      const title = m[2].replace(/<[^>]+>/g, "").trim();
      if (title) toc.push({ title, level, pageIndex: i });
    } else {
      toc.push({ title: `Глава ${i + 1}`, level: "h2", pageIndex: i });
    }
  }
  return toc;
}

function openToc() {
  if (!TOC || !TOC.length) return;
  tocList.innerHTML = "";
  TOC.forEach((item) => {
    const row = document.createElement("button");
    row.className = "toc-item";
    row.innerHTML = `
      <span class="toc-level">${item.level.toUpperCase()}</span>
      <span class="toc-title">${item.title}</span>
      <span class="toc-page">гл. ${item.pageIndex + 1}</span>
    `;
    row.addEventListener("click", () => {
      tocEl.classList.remove("show");
      renderSection(item.pageIndex);
    });
    tocList.appendChild(row);
  });
  tocEl.classList.add("show");
}

function effectiveSections() {
  if (!BOOK_SECTIONS) return [];
  if (hasFullAccess) return BOOK_SECTIONS;
  const DEMO_SECTIONS = 2;
  return BOOK_SECTIONS.slice(0, DEMO_SECTIONS);
}

function renderSection(i) {
  const list = effectiveSections();
  if (!list || !list.length) {
    dbg("render: no pages");
    return;
  }
  if (i < 0) i = 0;
  if (i >= list.length) i = list.length - 1;
  currentIndex = i;
  dbg("render section", i + 1, "of", list.length);
  const old = pageContainer.querySelector(".page-inner");
  if (old) {
    old.classList.add("flip-exit");
    setTimeout(() => old.remove(), 300);
  }
  const w = document.createElement("div");
  const html = list[i].trim();
  const onlyFullImg =
    /^\s*<img[^>]*class=["'][^"']*full-img[^"']*["'][^>]*>\s*$/i.test(html);
  w.className =
    "page-inner flip-enter" + (onlyFullImg ? " no-pad" : " chapter");
  w.innerHTML = html;
  pageContainer.appendChild(w);

  // Проставим режим на контейнере, чтобы скрыть нав-зоны
  readerEl.classList.add("mode-chapter");

  // Добавим динамический нижний паддинг = высоте футера, чтобы текст не обрезался
  requestAnimationFrame(() => {
    try {
      const footerH = footerEl?.getBoundingClientRect?.().height || 0;
      if (!onlyFullImg && footerH && w.classList.contains("chapter")) {
        const pad = Math.max(112, Math.ceil(footerH + 24));
        w.style.paddingBottom = pad + "px";
      }
    } catch (_) {}
  });
}

prevBtn.addEventListener("click", () => renderSection(currentIndex - 1));
nextBtn.addEventListener("click", () => renderSection(currentIndex + 1));

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
    if (dx < 0) renderSection(currentIndex + 1);
    else renderSection(currentIndex - 1);
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
  } catch (e) {
    statusEl.textContent = "Ошибка сети";
    dbg("create-request error", e?.message);
  } finally {
    buyBtn.disabled = false;
    buyBtn.textContent = "Купить полную версию";
  }
});

(async function init() {
  // убрал автозагрузку книги, чтобы не блокировать кнопку «Начать»
  await checkAccess();
})();
