import fs from "fs/promises";
import path from "path";
import mammoth from "mammoth";
import { execSync } from "child_process";

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function splitHtmlByChapters(html) {
  const clean = String(html || "")
    .replace(/\r/g, "")
    .replace(/\u00A0/g, " ");

  // Маркеры начала главы: абзац с ГЛАВА/ПРОЛОГ/ЭПИЛОГ
  const markerRe =
    /(<p[^>]*>\s*(?:ГЛАВА\b[^<]*|ПРОЛОГ\b[^<]*|ЭПИЛОГ\b[^<]*)<\/p>)/gi;

  const parts = [];
  let lastIndex = 0;
  let m;
  const indices = [];
  while ((m = markerRe.exec(clean))) {
    indices.push({ index: m.index, marker: m[1] });
  }
  if (indices.length === 0) {
    return [clean];
  }
  // Преамбула до первой главы — отдельной страницей
  const firstIdx = indices[0].index;
  if (firstIdx > 0) parts.push(clean.slice(0, firstIdx));
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i].index;
    const end = i + 1 < indices.length ? indices[i + 1].index : clean.length;
    parts.push(clean.slice(start, end));
  }
  return parts.map((s) => s.trim()).filter(Boolean);
}

async function main() {
  const projectRoot = path.resolve(path.join(process.cwd()));
  const docxPath = path.resolve(projectRoot, "webapp/assets/book.docx");
  const outDir = path.resolve(projectRoot, "webapp/assets/epub-src");
  const outEpub = path.resolve(projectRoot, "webapp/assets/book.epub");
  const cssPath = path.resolve(projectRoot, "webapp/assets/epub.css");

  console.log("Reading DOCX:", docxPath);
  // Пробуем явно замапить стили Pages/Word в <h2>
  const styleMap = [
    "p[style-name='Heading 2'] => h2:fresh",
    "p[style-name='Заголовок 2'] => h2:fresh",
    "p[style-name='Рубрика 2'] => h2:fresh",
    "p[style-name='Heading2'] => h2:fresh",
    "p[style-name='Заголовок2'] => h2:fresh",
  ];
  const { value: htmlRaw } = await mammoth.convertToHtml(
    { path: docxPath },
    { styleMap }
  );
  // Сначала пробуем порезать по <h2>
  let chapters;
  if (/\<h2[^>]*\>/i.test(htmlRaw)) {
    const parts = htmlRaw.split(/<h2[^>]*>/i);
    const out = [];
    if (parts[0].trim()) out.push(parts[0]);
    for (let i = 1; i < parts.length; i++) out.push("<h2>" + parts[i]);
    chapters = out;
  } else {
    chapters = splitHtmlByChapters(htmlRaw);
  }
  console.log("Chapters found:", chapters.length);
  await ensureDir(outDir);
  // Очистим папку
  for (const entry of await fs.readdir(outDir)) {
    await fs.rm(path.join(outDir, entry), { recursive: true, force: true });
  }
  if (chapters.length === 0) throw new Error("no chapters produced");
  // Сконструируем единый HTML, где каждая глава начинается с <h1>
  const mkTitle = (idx, html) => {
    const m = html.match(/<p[^>]*>(.*?)<\/p>/i);
    const raw = m ? m[1] : `Глава ${idx + 1}`;
    return (
      String(raw)
        .replace(/<[^>]+>/g, "")
        .trim() || `Глава ${idx + 1}`
    );
  };
  const normalized = chapters.map((h, i) => {
    const title = mkTitle(i, h);
    return `\n<h1>${title}</h1>\n${h}`;
  });
  const combinedPath = path.join(outDir, "combined.html");
  const combined = `<!doctype html><html lang=\"ru\"><head><meta charset=\"utf-8\"></head><body>${normalized.join(
    "\n"
  )}</body></html>`;
  await fs.writeFile(combinedPath, combined, "utf8");

  // Соберём EPUB через pandoc с разбиением по H1
  const cmd = [
    "pandoc",
    combinedPath,
    "-o",
    outEpub,
    "--toc",
    "--split-level=1",
    "-V",
    "lang=ru",
    "--css",
    cssPath,
  ];
  console.log("Running:", cmd.join(" "));
  execSync(cmd.join(" "), { stdio: "inherit" });
  console.log("EPUB ready:", outEpub);
}

main().catch((e) => {
  console.error("docx-to-epub-split failed:", e);
  process.exit(1);
});
