/* 首屏主题引导：必须在所有样式表之前同步加载，避免深/浅色闪动。
 * 真正的状态管理与切换逻辑在 theme.js。 */
(function () {
  try {
    var pref = localStorage.getItem("kf-theme") || "auto";
    var dark = pref === "dark" || (pref === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var root = document.documentElement;
    root.dataset.theme = dark ? "dark" : "light";
    root.dataset.themePref = pref;
    /* 刻意不设 color-scheme: dark：它会把原生 button 的默认文字色改成白色，
     * 而大量按钮其实是纸面底色、靠继承取深色文字。深色配色一律由各模块 CSS 自己画。 */
  } catch (err) {
    /* localStorage 不可用时按系统配色渲染 */
  }
})();
