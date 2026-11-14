// Run with: node --test test/
// Loads the real products.js + app.js in a stubbed browser and checks the
// totals the cart and checkout pages render.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// app.js renders the current hash once on load, so each test boots a fresh shop at its page.
function shopAt(hash, cart, user) {
  const els = {};
  const el = (id) => (els[id] ||= { addEventListener() {}, innerHTML: "", textContent: "", classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {} });
  const mem = { "demoshop:cart": JSON.stringify(cart), "demoshop:user": JSON.stringify(user || null) };
  const sandbox = {
    document: { getElementById: el, querySelectorAll: () => [] },
    localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { hash },
    setTimeout: () => 0,
    clearTimeout() {},
  };
  sandbox.window = { scrollTo() {}, addEventListener() {} };
  vm.createContext(sandbox);
  const root = path.join(__dirname, "..");
  // products.js assigns to window.*; share the same object the app reads.
  for (const f of ["products.js", "app.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), sandbox, { filename: f });
  return { html: () => el("app").innerHTML, mem, el };
}

const norm = (html, id) => (html.match(new RegExp('id="' + id + '">([^<]*)<')) || [])[1];

test("cart summary multiplies each line's price by its quantity", () => {
  const shop = shopAt("#/cart", [{ id: "mug", qty: 2 }, { id: "notebook", qty: 1 }]);
  assert.strictEqual(norm(shop.html(), "subtotal"), "$48.50");
  assert.strictEqual(norm(shop.html(), "total"), "$53.49");
});

test("checkout shows the quantity-aware total on the summary and the Place order button", () => {
  const user = { email: "alex@demoshop.test", name: "Alex Rivera" };
  const shop = shopAt("#/checkout", [{ id: "mug", qty: 2 }, { id: "notebook", qty: 1 }], user);
  assert.strictEqual(norm(shop.html(), "total"), "$53.49");
  assert.match(shop.html(), /Place order · \$53\.49/);
});

test("free shipping is judged on the quantity-aware subtotal", () => {
  // Four notebooks = $50.00, which is exactly the free-shipping threshold.
  const shop = shopAt("#/cart", [{ id: "notebook", qty: 4 }]);
  assert.strictEqual(norm(shop.html(), "subtotal"), "$50.00");
  assert.strictEqual(norm(shop.html(), "total"), "$50.00");
  assert.match(shop.html(), /<dt>Shipping<\/dt><dd>Free<\/dd>/);
});

test("a quantity of 1 is unchanged", () => {
  const shop = shopAt("#/cart", [{ id: "mug", qty: 1 }, { id: "notebook", qty: 1 }]);
  assert.strictEqual(norm(shop.html(), "subtotal"), "$30.50");
  assert.strictEqual(norm(shop.html(), "total"), "$35.49");
});
