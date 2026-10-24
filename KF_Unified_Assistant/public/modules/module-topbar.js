(() => {
  "use strict";

  const links = [
    ["overview", "/", "骑士团"],
    ["map", "/modules/map/", "地图"],
    ["encounter", "/modules/encounter/", "遭遇"],
    ["aibp", "/modules/aibp/", "AI / BP"],
    ["rogue", "/modules/rogue/", "肉鸽之路"],
    ["display", "/modules/display/", "第二屏"],
  ];

  for (const header of document.querySelectorAll("header[data-unified-topbar]")) {
    if (header.classList.contains("unified-topbar")) continue;
    const moduleName = header.dataset.unifiedTopbar || document.body.dataset.kfModule || "overview";
    header.classList.add("unified-topbar");
    header.querySelector("[data-topbar-title]")?.classList.add("unified-topbar-title");
    header.querySelector("[data-topbar-actions]")?.classList.add("unified-topbar-actions");
    const nav = document.createElement("nav");
    nav.className = "unified-module-bar";
    nav.setAttribute("aria-label", "模块切换");
    for (const [id, href, label] of links) {
      const link = document.createElement("a");
      link.href = href;
      link.textContent = label;
      if (id === moduleName) {
        link.className = "active";
        link.setAttribute("aria-current", "page");
      }
      nav.append(link);
    }
    header.append(nav);
    for (const control of header.querySelectorAll("button, a, select, label.button, .deck-order-toggle")) {
      control.classList.add("unified-topbar-control");
    }
    const updateHeight = () => {
      const height = Math.ceil(header.getBoundingClientRect().height);
      if (height) document.documentElement.style.setProperty("--kf-topbar-height", `${height}px`);
    };
    updateHeight();
    new ResizeObserver(updateHeight).observe(header);
  }
})();
