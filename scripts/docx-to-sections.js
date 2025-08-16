import fs from "fs/promises";
import mammoth from "mammoth";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: npm run import:docx -- "/absolute/path/book.docx"');
    process.exit(1);
  }

  console.log("Reading DOCX:", inputPath);
  const { value: html } = await mammoth.convertToHtml(
    { path: inputPath },
    {
      convertImage: mammoth.images.inline(async (image) => {
        const b64 = await image.read("base64");
        return { src: `data:${image.contentType};base64,${b64}` };
      }),
    }
  );

  let sections = [];
  if (html.includes("[[PAGE]]")) {
    sections = html
      .split("[[PAGE]]")
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    const parts = html.split(/<h2[^>]*>/i);
    for (let i = 0; i < parts.length; i++) {
      const chunk = parts[i].trim();
      if (!chunk) continue;
      const sec = i === 0 ? chunk : `<h2>${chunk}`;
      sections.push(sec);
    }
  }

  sections = sections.map((s) =>
    s.replaceAll("<img ", '<img class="full-img" ')
  );

  const outPath = path.resolve(__dirname, "../webapp/assets/book.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify({ sections }, null, 2));
  console.log("OK:", outPath, "sections:", sections.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
