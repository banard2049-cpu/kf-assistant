(() => {
  "use strict";

  const palebloodWorms = window.KF_MONSTER_DATA?.monsters?.find(
    monster => monster.id === "M_PalebloodWorms"
  );
  if (!palebloodWorms?.sheet) return;

  palebloodWorms.sheet = {
    ...palebloodWorms.sheet,
    face: "assets/sheets-zh/paleblood-worms-1-v1.1.jpg",
    width: 1,
    height: 1,
    index: 0,
    cellWidth: 2405,
    cellHeight: 1649,
    aspect: 1.45846
  };
})();
