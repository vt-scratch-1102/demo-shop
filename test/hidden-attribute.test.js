// Run with: node --test test/*.test.js
// The shop hides things (product cards, the "No products match your search."
// message) with the HTML `hidden` attribute. A class that sets `display`
// (.empty, .card) beats the browser's built-in [hidden] rule, so the stylesheet
// must say that hidden wins, or the message shows on the home page all the time.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

test("the no-match message is rendered hidden and uses a class that sets display", () => {
  assert.match(app, /<p id="no-match" class="empty" hidden>/);
  assert.match(css, /\.empty\s*\{[^}]*display:\s*flex/);
});

test("a stylesheet rule keeps [hidden] elements out of sight, even with !important over class display", () => {
  const rule = css.match(/(^|\})\s*\[hidden\]\s*\{([^}]*)\}/);
  assert.ok(rule, "no bare [hidden] rule in styles.css");
  assert.match(rule[2], /display:\s*none\s*!important/);
});
