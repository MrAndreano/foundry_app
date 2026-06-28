/**
 * Интеграция с Telegram Mini App (Web App).
 * Работает только внутри Telegram; в обычном браузере — no-op.
 */
(function (global) {
  "use strict";

  const tg = global.Telegram?.WebApp;
  let onNext = null;
  let onBack = null;

  function isActive() {
    return Boolean(tg?.initData);
  }

  function applyTheme() {
    if (!tg?.themeParams) return;
    const p = tg.themeParams;
    const root = document.documentElement;
    if (p.bg_color) root.style.setProperty("--tg-bg", p.bg_color);
    if (p.secondary_bg_color) root.style.setProperty("--tg-surface", p.secondary_bg_color);
    if (p.text_color) root.style.setProperty("--tg-text", p.text_color);
    if (p.hint_color) root.style.setProperty("--tg-muted", p.hint_color);
    if (p.button_color) root.style.setProperty("--tg-accent", p.button_color);
  }

  function syncWizard(step) {
    if (!isActive()) return;

    const labels = { 1: "Далее", 2: "Далее", 3: "Рассчитать", 4: "Новый расчёт" };
    tg.MainButton.setText(labels[step] || "Далее");
    tg.MainButton.show();

    if (step > 1) tg.BackButton.show();
    else tg.BackButton.hide();
  }

  function init(handlers) {
    if (!isActive()) return false;

    onNext = handlers?.onNext;
    onBack = handlers?.onBack;

    document.body.classList.add("is-telegram");
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation();

    applyTheme();
    tg.onEvent("themeChanged", applyTheme);

    tg.MainButton.onClick(() => onNext?.());
    tg.BackButton.onClick(() => onBack?.());

    const toggle = document.querySelector(".view-toggle");
    if (toggle) toggle.hidden = true;

    document.body.classList.remove("view-desktop");
    document.body.classList.add("view-mobile");

    syncWizard(1);
    return true;
  }

  global.TelegramBridge = { init, isActive, syncWizard };
})(typeof window !== "undefined" ? window : globalThis);
