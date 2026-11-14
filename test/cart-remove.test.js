// Run with: node --test test/*.test.js
// Loads the real products.js + app.js in a stubbed browser, clicks the real
// Remove buttons the cart page renders, and checks the cart that is left.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function shopAt(hash, cart) {
  const els = {};
  const el = (id) => (els[id] ||= { addEventListener() {}, innerHTML: "", textContent: "", classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {} });
  const mem = { "demoshop:cart": JSON.stringify(cart), "demoshop:user": "null" };
  const listeners = {};
  el("app").addEventListener = (type, fn) => { (listeners[type] ||= []).push(fn); };
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
  for (const f of ["products.js", "app.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), sandbox, { filename: f });
  // Press the button the cart page renders with `attr="id"` (e.g. data-remove="mug"), the way a browser click would.
  const press = (attr, id) => {
    const html = el("app").innerHTML;
    assert.ok(html.includes(attr + '="' + id + '"'), "no " + attr + " button for " + id + " on the page");
    const button = { dataset: { [attr.replace(/^data-/, "")]: id } };
    for (const fn of listeners.click || []) fn({ target: { closest: () => button } });
  };
  const saved = () => JSON.parse(mem["demoshop:cart"]);
  return { html: () => el("app").innerHTML, el, press, saved };
}

const mugAndNotebook = () => [{ id: "mug", qty: 2 }, { id: "notebook", qty: 1 }];

test("Remove takes the line out of the cart, the badge drops by its quantity and the Summary updates", () => {
  const shop = shopAt("#/cart", mugAndNotebook());
  shop.press("data-remove", "notebook");
  assert.deepStrictEqual(shop.saved(), [{ id: "mug", qty: 2 }]);
  assert.strictEqual(shop.el("cart-count").textContent, 2);
  assert.ok(!shop.html().includes("Linen Notebook"));
  assert.match(shop.html(), /id="subtotal">\$36\.00</);
});

test("removing a line with quantity 2 drops the badge by 2", () => {
  const shop = shopAt("#/cart", mugAndNotebook());
  shop.press("data-remove", "mug");
  assert.deepStrictEqual(shop.saved(), [{ id: "notebook", qty: 1 }]);
  assert.strictEqual(shop.el("cart-count").textContent, 1);
});

test("removing the last line shows \"Your cart is empty.\"", () => {
  const shop = shopAt("#/cart", mugAndNotebook());
  shop.press("data-remove", "notebook");
  shop.press("data-remove", "mug");
  assert.deepStrictEqual(shop.saved(), []);
  assert.strictEqual(shop.el("cart-count").textContent, 0);
  assert.match(shop.html(), /Your cart is empty\./);
});
