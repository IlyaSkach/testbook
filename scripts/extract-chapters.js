import fs from "fs/promises";
import path from "path";

async function main() {
  const bookPath = path.resolve("webapp/assets/book.json");
  const outDir = path.resolve("webapp/assets/chapters");
  try {
    const raw = await fs.readFile(bookPath, "utf8");
    const json = JSON.parse(raw);
    const sections = Array.isArray(json.sections)
      ? json.sections
      : Array.isArray(json.pages)
      ? json.pages.map((p) => (typeof p === "string" ? p : p.content))
      : [];
    if (!sections.length) throw new Error("empty sections in book.json");

    const html = sections.join("");
    // Разрежем на главы по первому вхождению заголовка следующей главы
    const NEXT_TITLE = "ГЛАВА. СЛУЧАЙНОСТИ НЕ СЛУЧАЙНЫ";
    let idx = html.indexOf(NEXT_TITLE);
    if (idx < 0) idx = html.length;
    let ch1 = html.slice(0, idx);

    // Удалим картинки
    ch1 = ch1.replace(/<img[^>]*>/gi, "");

    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(outDir, "ch1.html"), ch1, "utf8");
    console.log("OK: chapters/ch1.html generated");
  } catch (e) {
    console.error("extract-chapters error:", e.message);
    process.exit(1);
  }
}

main();
