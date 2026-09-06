import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:3000";
const widths = [1280, 1024, 768, 390, 320];
const paths = ["/", "/quiz", "/quiz/jouer?mode=category", "/motus/jouer?mode=classic", "/definitions", "/motus/multijoueur", "/multijoueur/T63Y8T"];

const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
const results = [];

for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  for (const path of paths) {
    await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle", timeout: 25_000 });
    const measure = await page.evaluate(() => {
      const targets = [document.documentElement, document.body, document.getElementById("root"), document.querySelector(".motif-app"), document.querySelector(".page-shell")].filter(Boolean);
      const overflowing = [...document.querySelectorAll("body *")].filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.right > window.innerWidth + 1 || rect.left < -1;
      }).slice(0, 6).map((element) => ({ tag: element.tagName, className: element.className }));
      return {
        viewport: window.innerWidth,
        widths: targets.map((element) => ({ client: element.clientWidth, scroll: element.scrollWidth })),
        overflowing,
      };
    });
    results.push({ width, path, ...measure, pass: measure.widths.every((item) => item.client === item.scroll) && measure.overflowing.length === 0 });
  }
  await page.close();
}

await browser.close();
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
