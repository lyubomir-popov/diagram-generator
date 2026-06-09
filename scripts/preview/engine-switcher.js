"use strict";
/**
 * Engine switcher (spec 035, FR-003/FR-004).
 *
 * Pure preview-shell glue: reads the server-computed list of compatible
 * preview engines from `window.__DG_CONFIG.compatible_engines`, renders a
 * `<select>` control, and on change persists the chosen `layout_engine` via the
 * existing `/api/overrides/{slug}` endpoint, then reloads the preview so the
 * server re-renders with the new engine's scripts.
 *
 * Engine compatibility is decided server-side in the TypeScript preview-engine
 * registry. This module never re-derives compatibility — it only renders the
 * offered list and POSTs the user's choice.
 */
(function initEngineSwitcher() {
  const config = window.__DG_CONFIG || {};
  const slug = config.slug;
  const current = config.layout_engine || "";
  const compatible = Array.isArray(config.compatible_engines)
    ? config.compatible_engines.filter((key) => typeof key === "string" && key.length > 0)
    : [];

  const section = document.getElementById("engine-switcher-section");
  const select = document.getElementById("engine-switcher");
  const help = document.getElementById("engine-switcher-help");
  if (!section || !select) return;

  // Nothing meaningful to switch between unless there are at least two options.
  if (compatible.length < 2) {
    section.hidden = true;
    return;
  }

  // Build options. Ensure the current engine is present and selected.
  const keys = compatible.includes(current) || !current
    ? compatible.slice()
    : [current, ...compatible];
  select.innerHTML = "";
  for (const key of keys) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = key;
    if (key === current) option.selected = true;
    select.appendChild(option);
  }
  section.hidden = false;

  function setHelp(message, isError) {
    if (!help) return;
    help.textContent = message;
    help.classList.toggle("is-error", Boolean(isError));
  }

  const defaultHelp = help ? help.textContent : "";

  select.addEventListener("change", async () => {
    const chosen = select.value;
    if (!chosen || chosen === current) return;

    select.disabled = true;
    setHelp("Switching engine\u2026", false);
    try {
      const resp = await fetch("/api/overrides/" + encodeURIComponent(slug), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout_engine: chosen }),
      });
      if (!resp.ok) {
        const message = await resp.text();
        setHelp("Switch failed: " + (message || resp.statusText || "Unknown error"), true);
        select.value = current;
        select.disabled = false;
        return;
      }
      // The server injects different engine scripts per layout engine, so a
      // full reload is the correct re-render path after an engine switch.
      window.location.reload();
    } catch (err) {
      setHelp("Switch failed: " + err, true);
      select.value = current;
      select.disabled = false;
      if (!defaultHelp) setHelp(defaultHelp, false);
    }
  });
})();
