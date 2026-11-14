// Run with: node --test test/
// Drives the real checkout submit path: loads products.js + app.js in a stubbed
// browser, fires the submit listener app.js binds on #app, and checks what
// placeOrder does with different card numbers.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const USER = { email: "alex@demoshop.test", name: "Alex Rivera" };
const CART = [{ id: "mug", qty: 2 }];
const VALID = { name: "Alex Rivera", address: "1 Main St", city: "Springfield", postcode: "12345" };

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
  // placeOrder reads the form through FormData(form).entries() and writes errors to #form-error.
  const errEl = { textContent: "" };
  sandbox.FormData = class { constructor(form) { this.values = form.values; } entries() { return Object.entries(this.values); } };
  vm.createContext(sandbox);
  const root = path.join(__dirname, "..");
  for (const f of ["products.js", "app.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), sandbox, { filename: f });

  // Submit the checkout form the way the browser would: the delegated listener on #app.
  function submit(card) {
    const form = { id: "checkout-form", values: { ...VALID, card }, querySelector: (sel) => (sel === "#form-error" ? errEl : null) };
    let prevented = false;
    for (const fn of listeners["app:submit"]) fn({ target: form, preventDefault() { prevented = true; } });
    assert.ok(prevented, "submit default is prevented");
    return form;
  }
  const orders = () => JSON.parse(mem["demoshop:orders:" + USER.email] || "[]");
  const cart = () => JSON.parse(mem["demoshop:cart"]);
  return { submit, errEl, orders, cart, location: sandbox.location };
}

const MESSAGE = "The card number needs 16 digits.";

function assertRefused(shop, form, card) {
  assert.strictEqual(shop.errEl.textContent, MESSAGE);
  assert.strictEqual(shop.orders().length, 0, "no order is saved");
  assert.deepStrictEqual(shop.cart(), CART, "the cart is not cleared");
  assert.strictEqual(shop.location.hash, "#/checkout", "stays on checkout");
  assert.strictEqual(form.values.card, card, "typed values are kept");
  assert.strictEqual(form.values.name, VALID.name);
}

function assertPlaced(shop) {
  assert.strictEqual(shop.errEl.textContent, "");
  assert.strictEqual(shop.orders().length, 1, "one order is saved");
  assert.deepStrictEqual(shop.cart(), [], "the cart is cleared");
  assert.match(shop.location.hash, /^#\/done\/DS-\d{6}$/);
}

test("a 16-letter card number is refused and no order is placed", () => {
  const shop = checkoutShop();
  const form = shop.submit("abcdabcdabcdabcd");
  assertRefused(shop, form, "abcdabcdabcdabcd");
});

test("a 16-character card number with dashes (13 digits) is refused", () => {
  const shop = checkoutShop();
  const form = shop.submit("4242-4242-4242-4");
  assertRefused(shop, form, "4242-4242-4242-4");
});

test("a 15-digit card number is refused", () => {
  const shop = checkoutShop();
  const form = shop.submit("424242424242424");
  assertRefused(shop, form, "424242424242424");
});

test("a 16-digit card number is accepted and places the order", () => {
  const shop = checkoutShop();
  shop.submit("4242424242424242");
  assertPlaced(shop);
});

test("a 16-digit card number typed with spaces is accepted", () => {
  const shop = checkoutShop();
  shop.submit("4242 4242 4242 4242");
  assertPlaced(shop);
});
