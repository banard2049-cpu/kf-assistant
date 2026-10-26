(() => {
  "use strict";
  // Match the campaign's selected sheet, never a model choice or a party member's name.
  const leaderKnightId = (party, leaderSheetId) => {
    if (!leaderSheetId) return "";
    const leader = (Array.isArray(party) ? party : []).find(member =>
      member.type !== "squire" && (member.id === leaderSheetId || member.sheetId === leaderSheetId)
    );
    return leader?.knightId || "";
  };
  const available = (monsters, knightId) => (monsters || []).filter(monster =>
    monster.category !== "special" || monster.special?.scope === "campaign" ||
    (knightId && monster.special?.knightId === knightId)
  );
  window.KFEncounterCatalog = Object.freeze({ leaderKnightId, available });
})();
