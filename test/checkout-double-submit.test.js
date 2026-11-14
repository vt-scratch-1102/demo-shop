// Run with: node --test test/*.test.js
// A double-click on Place order fires the checkout form's submit twice before the
// hashchange re-render replaces the form. The second submit must record nothing.
// Same stubbed-browser approach as checkout-card.test.js: location.hash does not
// trigger a re-render here, which is exactly the window the double-click lands in.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const USER = { email: "alex@demoshop.test", name: "Alex Rivera" };
const CART = [{ id: "mug", qty: 2 }];
const VALID = { name: "Alex Rivera", address: "1 Main St", city: "Springfield", postcode: "12345", card: "4242424242424242" };

function checkoutShop() {
  const els = {};
  const listeners = {};
  const el = (id) => (els[id] ||= {
    addEventListener(type, fn) { (listeners[id + ":" + type] ||= []).push(fn); },
    innerHTML: "", textContent: "", classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {},
  });
  const mem = { "demoshop:cart": JSON.stringify(CART), "demoshop:user": JSON.stringify(USER) };
  const sandbox = {
    document: { getElementById: el, querySelectorAll: () => [] },
    localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { hash: "#/checkout" },
    setTimeout: () => 0,
    clearTimeout() {},
  };
  sandbox.window = { scrollTo() {}, addEventListener() {} };
  sandbox.FormData = class { constructor(form) { this.values = form.values; } entries() { return Object.entries(this.values); } };
  vm.createContext(sandbox);
  const root = path.join(__dirname, "..");
  for (const f of ["products.js", "app.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), sandbox, { filename: f });

  // One form element, submitted repeatedly, as in a double-click on the same page.
  const errEl = { textContent: "" };
  const button = { disabled: false };
  const form = {
    id: "checkout-form",
    values: { ...VALID },
    querySelector: (sel) => (sel === "#form-error" ? errEl : sel === "button[type=submit]" ? button : null),
  };
  const submit = () => {
    for (const fn of listeners["app:submit"]) fn({ target: form, preventDefault() {} });
  };
  const orders = () => JSON.parse(mem["demoshop:orders:" + USER.email] || "[]");
  const cart = () => JSON.parse(mem["demoshop:cart"]);
  return { submit, errEl, button, orders, cart, location: sandbox.location };
}

test("submitting a valid checkout twice records exactly one order", () => {
  const shop = checkoutShop();
  shop.submit();
  const firstHash = shop.location.hash;
  assert.match(firstHash, /^#\/done\/DS-\d{6}$/);
  shop.submit();

  const orders = shop.orders();
  assert.strictEqual(orders.length, 1, "only one order is saved");
  assert.strictEqual(orders[0].lines.length, 1);
  assert.strictEqual(orders[0].lines[0].id, "mug");
  assert.strictEqual(orders[0].lines[0].qty, 2);
  assert.ok(orders[0].total > 0, "the order has a non-zero total");
  assert.deepStrictEqual(shop.cart(), [], "the cart is empty");
  assert.strictEqual(shop.location.hash, firstHash, "Thank you page keeps the first order's number");
  assert.strictEqual(firstHash, "#/done/" + orders[0].number);
});

test("the place-order button is disabled once the order is accepted", () => {
  const shop = checkoutShop();
  assert.strictEqual(shop.button.disabled, false);
  shop.submit();
  assert.strictEqual(shop.button.disabled, true);
});

test("a repeat submit with an empty cart is silent: no order, no error, hash untouched", () => {
  const shop = checkoutShop();
  shop.submit();
  const hash = shop.location.hash;
  shop.submit();
  shop.submit();
  assert.strictEqual(shop.orders().length, 1);
  assert.strictEqual(shop.errEl.textContent, "");
  assert.strictEqual(shop.location.hash, hash);
});
