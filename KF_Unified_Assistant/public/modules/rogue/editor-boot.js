(() => {
  "use strict";
  const connected=Boolean(localStorage.getItem("kfActiveCampaign"));
  window.KF_ROGUE_EDITOR_STANDALONE=!connected;
  const script=document.createElement("script");
  script.src=connected?"../module-bridge.js?v=21":"editor.js?v=3";
  document.body.append(script);
})();
