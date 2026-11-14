/* KF 全站主题管理
 * 偏好取值：auto（跟随系统）/ light / dark
 * localStorage 键：kf-theme
 * 应用结果写到 <html data-theme="light|dark" data-theme-pref="auto|light|dark">
 * 切换时在 document 上派发 kf:theme 事件，detail = { theme, pref }
 */
(function () {
  "use strict";

  var STORAGE_KEY = "kf-theme";
  var PREFS = ["auto", "light", "dark"];
  var mql = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  /* data-scope="control" 的页面只负责切换偏好、不给自己换肤（主控制台用） */
  var scriptTag = document.currentScript;
  var CONTROL_ONLY = !!(scriptTag && scriptTag.dataset && scriptTag.dataset.scope === "control");

  function normalize(value) {
    return PREFS.indexOf(value) >= 0 ? value : "auto";
  }

  function readPref() {
    try {
      return normalize(window.localStorage.getItem(STORAGE_KEY));
    } catch (err) {
      return "auto";
    }
  }

  function writePref(pref) {
    try {
      window.localStorage.setItem(STORAGE_KEY, pref);
    } catch (err) {
      /* 隐私模式下忽略 */
    }
  }

  function systemTheme() {
    return mql && mql.matches ? "dark" : "light";
  }

  function resolve(pref) {
    return pref === "auto" ? systemTheme() : pref;
  }

  function currentPref() {
    var root = document.documentElement;
    return normalize(root.dataset.themePref || readPref());
  }

  function apply(pref, options) {
    var root = document.documentElement;
    var normalized = normalize(pref);
    var theme = resolve(normalized);

    if (!CONTROL_ONLY) {
      root.dataset.theme = theme;
      root.dataset.themePref = normalized;
      /* color-scheme 只在 theme.css 里为浅色声明；深色不设，
       * 否则原生控件（button/input）默认文字色会变白。 */

      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        if (!meta.dataset.darkValue) meta.dataset.darkValue = meta.getAttribute("content") || "#211d1b";
        meta.setAttribute("content", theme === "light" ? "#f3ebdb" : meta.dataset.darkValue);
      }
    }

    syncControls(normalized, theme);

    if (!options || !options.silent) {
      document.dispatchEvent(new CustomEvent("kf:theme", { detail: { theme: theme, pref: normalized } }));
    }
    return theme;
  }

  function set(pref, options) {
    var normalized = normalize(pref);
    writePref(normalized);
    return apply(normalized, options);
  }

  function toggle() {
    // 在深浅之间切换；从 auto 出发时以当前实际配色为起点取反
    var next = resolve(currentPref()) === "dark" ? "light" : "dark";
    set(next);
    return next;
  }

  /* 侧栏等处的分段控件：<div data-theme-control><button data-theme-value="auto">…</button> */
  function syncControls(pref, theme) {
    var groups = document.querySelectorAll("[data-theme-control]");
    for (var i = 0; i < groups.length; i++) {
      var buttons = groups[i].querySelectorAll("[data-theme-value]");
      for (var j = 0; j < buttons.length; j++) {
        var value = buttons[j].dataset.themeValue;
        var active = value === pref;
        buttons[j].classList.toggle("is-active", active);
        buttons[j].setAttribute("aria-pressed", active ? "true" : "false");
      }
      groups[i].dataset.resolvedTheme = theme;
    }

    var label = document.querySelector("[data-theme-resolved-label]");
    if (label) {
      var names = { auto: "跟随系统", light: "浅色", dark: "深色" };
      label.textContent = pref === "auto" ? "跟随系统 · " + (theme === "light" ? "浅色" : "深色") : names[pref];
    }
  }

  function bindControls() {
    document.addEventListener("click", function (event) {
      var button = event.target.closest ? event.target.closest("[data-theme-value]") : null;
      if (!button) return;
      event.preventDefault();
      set(button.dataset.themeValue);
    });
  }

  function watchSystem() {
    if (!mql) return;
    var handler = function () {
      if (currentPref() !== "auto") return;
      apply("auto");
    };
    if (mql.addEventListener) mql.addEventListener("change", handler);
    else if (mql.addListener) mql.addListener(handler);
  }

  function watchStorage() {
    window.addEventListener("storage", function (event) {
      if (event.key !== STORAGE_KEY) return;
      apply(normalize(event.newValue));
    });
  }

  /* 从往返缓存（bfcache）恢复时，重新按最新偏好渲染 */
  function watchPageShow() {
    window.addEventListener("pageshow", function (event) {
      if (!event.persisted) return;
      apply(currentPref(), { silent: true });
    });
  }

  var api = {
    PREFS: PREFS,
    get: currentPref,
    resolved: function () {
      return document.documentElement.dataset.theme || resolve(currentPref());
    },
    system: systemTheme,
    set: set,
    toggle: toggle,
    apply: apply
  };

  window.kfTheme = api;

  bindControls();
  watchSystem();
  watchStorage();
  watchPageShow();

  // 页面已由 head 内联脚本设定过主题时保留当前值，只补充控件状态
  apply(currentPref(), { silent: true });
})();
