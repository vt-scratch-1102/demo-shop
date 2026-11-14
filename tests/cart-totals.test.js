// Runs app.js against a minimal fake browser and checks the totals it renders.
// Run: node tests/cart-totals.test.js
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.join(__dirname, "..");

function boot(hash, cart, user) {
  const els = {};
  const el = (id) => (els[id] = els[id] || { id, innerHTML: "", textContent: "", classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, addEventListener() {} });
  const mem = { "demoshop:cart": JSON.stringify(cart) };
  if (user) mem["demoshop:user"] = JSON.stringify(user);
  const win = { addEventListener() {}, scrollTo() {} };
  const ctx = {
    window: win,
    document: { getElementById: el, querySelectorAll: () => [] },
    localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { hash },
    FormData: class {},
    setTimeout, clearTimeout, Date, JSON, Math, String, Object,
  };
  ctx.window.localStorage = ctx.localStorage;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "products.js"), "utf8"), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "app.js"), "utf8"), ctx);
  return el("app").innerHTML;
}

const alex = { email: "alex@demoshop.test", name: "Alex Rivera" };
const dd = (html, label) => { const m = html.match(new RegExp("<dt>" + label + "</dt><dd[^>]*>([^<]*)</dd>")); assert(m, label + " missing"); return m[1]; };

// 3 mugs ($18 each): subtotal counts quantity, free shipping applies
let html = boot("#/cart", [{ id: "mug", qty: 3 }]);
assert.strictEqual(dd(html, "Subtotal"), "$54.00");
assert.strictEqual(dd(html, "Shipping"), "Free");
assert.strictEqual(dd(html, "Total"), "$54.00");

// 2 mugs ($36): under the free-shipping line, so shipping is charged on the real subtotal
html = boot("#/cart", [{ id: "mug", qty: 2 }]);
assert.strictEqual(dd(html, "Subtotal"), "$36.00");
assert.strictEqual(dd(html, "Shipping"), "$4.99");
assert.strictEqual(dd(html, "Total"), "$40.99");

// Mixed cart: 2 x notebook ($12.50) + 1 x bottle ($22.00) = $47.00
html = boot("#/cart", [{ id: "notebook", qty: 2 }, { id: "bottle", qty: 1 }]);
assert.strictEqual(dd(html, "Subtotal"), "$47.00");
assert.strictEqual(dd(html, "Total"), "$51.99");

// Checkout: summary and the Place order button agree with the cart
html = boot("#/checkout", [{ id: "mug", qty: 3 }], alex);
assert.strictEqual(dd(html, "Total"), "$54.00");
assert(html.includes("Place order · $54.00"), "Place order button must show $54.00");

console.log("cart-totals: ok");
