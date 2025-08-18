import fs from "fs/promises";

const dir = "webapp/assets/book-pages";
const files = (await fs.readdir(dir))
  .filter((n) => /\.(jpe?g|png|webp)$/i.test(n))
  .sort();
const pages = files.map((n, i) => ({
  type: i < 2 ? "demo" : "full",
  content: `<img class="full-img" src="/assets/book-pages/${n}"/>`,
}));
await fs.writeFile(
  "webapp/assets/book.json",
  JSON.stringify({ pages }, null, 2)
);
console.log("OK pages:", files.length);


