(() => {
  "use strict";
  const connected=Boolean(new URLSearchParams(location.search).get("campaignId")||localStorage.getItem("kfActiveCampaign"));
  window.KF_ROGUE_EDITOR_STANDALONE=!connected;
  const script=document.createElement("script");
  script.src=connected?"../module-bridge.js?v=23":"editor.js?v=4";
  document.body.append(script);
})();
