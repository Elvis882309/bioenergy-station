/* Dashboard UI shell adapter (DESIGN.md). Presentation only: reads input values, writes a collapsed
   summary, change markers and html[data-ui-still]. Never changes values, requests, playback or charts. */
(() => {
  "use strict";
  const root = document.documentElement, byId = id => document.getElementById(id);
  const still = byId("static-mode"), reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const syncStill = () => { root.dataset.uiStill = String(still.checked || reduce.matches); };
  still.addEventListener("change", syncStill); reduce.addEventListener?.("change", syncStill); syncStill();
  // dashboard.js may restore the stored static preference after this script's first read.
  queueMicrotask(syncStill); window.addEventListener("load", syncStill);

  const sidebar = document.querySelector(".sidebar"), summary = byId("advSummary");
  const kla = byId("kla"), dt = byId("dt"), backend = byId("backend");
  const same = el => Number(el.value) === Number(el.defaultValue);
  function syncSummary() {
    const option = backend.selectedOptions[0];
    const defaultBackend = [...backend.options].find(o => o.defaultSelected) || backend.options[0];
    const changed = !same(kla) || !same(dt) || option !== defaultBackend;
    summary.textContent = "kLa " + kla.value + " d⁻¹ · dt " + dt.value + " d · " + (option ? option.textContent.replace(/（.*?）/g, "") : "") + (changed ? " · 已改动" : " · 默认");
    summary.dataset.changed = String(changed);
  }
  const seen = new WeakMap();
  function flash(el) {
    const field = el.closest(".field, .feed-row");
    if (!field || root.dataset.uiStill === "true" || document.body.classList.contains("static-report")) return;
    field.classList.remove("ui-flash"); void field.offsetWidth; field.classList.add("ui-flash");
  }
  sidebar.addEventListener("change", event => {
    const el = event.target;
    if (el.matches?.("input[type=number], input[type=range], select") && el.checkValidity() && seen.get(el) !== el.value) flash(el);
    if (el.matches?.("input, select")) seen.set(el, el.value);
    syncSummary();
  });
  sidebar.addEventListener("input", syncSummary);
  // Reset runs in app.js's own click handler; read the values after it has finished.
  byId("reset").addEventListener("click", () => setTimeout(syncSummary, 0));
  syncSummary();
})();
