// Run with: node --test test/*.test.js
// On the shop home page each card shows the product name and its price under
// the picture. The price must flow in the card like the name does; taking it out
// of the flow (position: absolute) draws it over the start of the name.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp("(^|\\})\\s*" + escaped + "\\s*\\{([^}]*)\\}"));
  assert.ok(m, `no ${selector} rule in styles.css`);
  return m[2];
}

test("the card price stays in the card's flow, so it cannot cover the product name", () => {
  const body = rule(".card-price");
  assert.doesNotMatch(body, /position:\s*(absolute|fixed)/);
  assert.doesNotMatch(body, /\b(top|left|right|bottom)\s*:/);
});

test("the card title and price sit in the same column container as the picture", () => {
  assert.match(rule(".card-link"), /display:\s*flex/);
  assert.match(rule(".card-link"), /flex-direction:\s*column/);
});
