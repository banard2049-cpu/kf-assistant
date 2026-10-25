"use strict";

// Execute the production Java migration helper against the official JSON-java
// implementation. Pin and verify the small test-only JAR; never commit it.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");

const javaRoot = path.join(__dirname, "packaging/android/app/src/main/java/com/kingdomsforlorn/unified/local");
const production = path.join(javaRoot, "CampaignStateImport.java");
const api = fs.readFileSync(path.join(javaRoot, "LocalApi.java"), "utf8");
const copyRoute = api.slice(api.indexOf('if ("copy".equals(action) && "POST".equals(method))'), api.indexOf('if ("trash".equals(action)'));
const importRoute = api.slice(api.indexOf("private JSONObject campaignImport("), api.indexOf("private JSONObject sheetImport("));
assert.match(copyRoute, /CampaignStateImport\.rebindRogueCampaign\(copy\.getJSONObject\("state"\), copy\.getString\("id"\)\)/,
  "campaign copies must rebind the copied rogue bundle");
assert.match(importRoute, /CampaignStateImport\.remapSheetReferences\(importedState, sheetMap\)/,
  "imports must migrate sheet references inside module saves and undo snapshots");
assert.match(importRoute, /CampaignStateImport\.rebindRogueCampaign\(campaign\.getJSONObject\("state"\), campaign\.getString\("id"\)\)/,
  "imports must rebind rogue slots after the new campaign ID is assigned");

const extension = process.platform === "win32" ? ".exe" : "";
const javaHomes = [process.env.JAVA_HOME, "D:/android-toolchain/jdk-21", "D:/files/scribe/tools/jdk-17.0.20.1+1"].filter(Boolean);
function javaTool(name) {
  for (const home of javaHomes) {
    const file = path.join(home, "bin", name + extension);
    if (fs.existsSync(file)) return file;
  }
  return name;
}

const jsonVersion = "20250517";
const jsonHash = "3ea61b2a06e31edf1c91134fe9106b0ebb16628be169f3db75bc7a2b06b45796";
const jsonUrl = `https://repo.maven.apache.org/maven2/org/json/json/${jsonVersion}/json-${jsonVersion}.jar`;
const sha256 = value => createHash("sha256").update(value).digest("hex");
const sources = {
  "com/kingdomsforlorn/unified/local/CampaignStateImportTest.java": `package com.kingdomsforlorn.unified.local;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;
public final class CampaignStateImportTest {
  private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
  private static JSONObject object(Object... items) throws Exception {
    JSONObject result = new JSONObject();
    for (int i=0; i<items.length; i+=2) result.put((String)items[i], items[i+1]);
    return result;
  }
  private static JSONArray array(Object... items) {
    JSONArray result = new JSONArray(); for (Object item : items) result.put(item); return result;
  }
  public static void main(String[] args) throws Exception {
    Map<String,String> sheets = new HashMap<>(); sheets.put("old-sheet", "new-sheet");
    JSONObject knight = object("id", "old-sheet", "sheetId", "old-sheet", "space", "7", "done", true);
    JSONObject undoKnight = object("id", "piece-1", "sheetId", "old-sheet", "clues", object("martial", 3));
    JSONObject module = object("mainKnightId", "old-sheet", "knights", array(knight),
      "maps", object("SK", object("history", array(object("knights", array(undoKnight))))));
    JSONObject inactiveRun = object("id", "inactive", "state", object("partyName", "keep inactive", "sheetId", "old-sheet"));
    JSONObject activeRun = object("id", "active", "state", object("partyName", "keep active", "gold", 12));
    JSONArray slots = array(activeRun, inactiveRun);
    JSONObject rogue = object("schemaVersion", 2, "campaignId", "old-campaign", "activeSlotId", "active", "slots", slots);
    JSONArray party = array("old-sheet", "unknown-sheet", JSONObject.NULL);
    JSONObject state = object("leaderSheetId", "old-sheet", "party", party,
      "modules", object("map", module, "encounter", object("history", array(array(object("sheetId", "old-sheet")))), "roguePath", rogue),
      "notes", "old-sheet", "nullable", JSONObject.NULL, "unknown", object("sheetId", "unknown-sheet"));

    CampaignStateImport.remapSheetReferences(state, sheets);
    check("new-sheet".equals(state.opt("leaderSheetId")), "leader must use the imported sheet ID");
    check("new-sheet".equals(party.opt(0)), "party must use the imported sheet ID");
    check("unknown-sheet".equals(party.opt(1)) && party.opt(2)==JSONObject.NULL, "unknown and null party values must survive");
    check("new-sheet".equals(knight.opt("sheetId")), "module knight must use imported sheet");
    check("old-sheet".equals(knight.opt("id")) && "old-sheet".equals(module.opt("mainKnightId")), "internal piece IDs must stay unchanged even if equal to an old sheet ID");
    check("7".equals(knight.opt("space")) && Boolean.TRUE.equals(knight.opt("done")), "encounter progress must survive");
    check("new-sheet".equals(undoKnight.opt("sheetId")), "nested undo snapshots must use imported sheet");
    check("piece-1".equals(undoKnight.opt("id")), "undo piece identity must stay unchanged");
    check("old-sheet".equals(state.opt("notes")) && state.opt("nullable")==JSONObject.NULL, "unrelated strings and JSON null must survive");
    check("unknown-sheet".equals(state.optJSONObject("unknown").opt("sheetId")), "unknown sheet references must survive");
    check("new-sheet".equals(inactiveRun.optJSONObject("state").opt("sheetId")), "inactive rogue slots must also migrate");

    CampaignStateImport.rebindRogueCampaign(state, "imported-campaign");
    check("imported-campaign".equals(rogue.opt("campaignId")), "imported bundle ownership must change");
    check(rogue.opt("slots")==slots && slots.length()==2 && "active".equals(rogue.opt("activeSlotId")), "all run slots and active selection must survive import");
    CampaignStateImport.rebindRogueCampaign(state, "copied-campaign");
    check("copied-campaign".equals(rogue.opt("campaignId")), "copied bundle ownership must change");
    check("keep active".equals(activeRun.optJSONObject("state").opt("partyName")) && "keep inactive".equals(inactiveRun.optJSONObject("state").opt("partyName")), "copy/import must preserve both runs");

    JSONObject empty = new JSONObject();
    CampaignStateImport.rebindRogueCampaign(empty, "new");
    check(empty.length()==0, "missing modules must not create a rogue save");
    JSONObject nullModules=object("modules",JSONObject.NULL);
    CampaignStateImport.rebindRogueCampaign(nullModules,"new");
    check(nullModules.opt("modules")==JSONObject.NULL,"null modules must survive");
    JSONObject legacy=object("schemaVersion",1,"partyName","legacy","campaignId","unchanged","slots",JSONObject.NULL);
    CampaignStateImport.rebindRogueCampaign(object("modules",object("roguePath",legacy)),"new");
    check("unchanged".equals(legacy.opt("campaignId")) && legacy.opt("slots")==JSONObject.NULL,"legacy single-run saves must remain compatible");
    CampaignStateImport.remapSheetReferences(JSONObject.NULL,sheets);
    CampaignStateImport.remapSheetReferences(null,sheets);
    System.out.println("Android campaign import passed: copied/imported rogue bundles, inactive slots, nested sheet references, piece identity, unknown IDs, nulls and legacy saves.");
  }
}`
};

const tempParent = fs.realpathSync(os.tmpdir());
const temp = fs.mkdtempSync(path.join(tempParent, "kf-android-campaign-import-"));
async function run() {
 try {
  const jsonJar = path.join(tempParent, `kf-json-${jsonVersion}-${jsonHash.slice(0, 12)}.jar`);
  if (!fs.existsSync(jsonJar) || sha256(fs.readFileSync(jsonJar)) !== jsonHash) {
    const response = await fetch(jsonUrl);
    assert.ok(response.ok, `JSON-java dependency download failed: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(sha256(bytes), jsonHash, "JSON-java dependency SHA256 must match the pinned release");
    const downloaded = path.join(temp, "json.jar");
    fs.writeFileSync(downloaded, bytes);
    fs.copyFileSync(downloaded, jsonJar);
  }
  const files = [];
  for (const [relative, source] of Object.entries(sources)) {
    const file = path.join(temp, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, source);
    files.push(file);
  }
  const classes = path.join(temp, "classes");
  fs.mkdirSync(classes);
  execFileSync(javaTool("javac"), ["-encoding", "UTF-8", "-cp", jsonJar, "-d", classes, production, ...files], { stdio: "pipe" });
  process.stdout.write(execFileSync(javaTool("java"), ["-cp", classes + path.delimiter + jsonJar, "com.kingdomsforlorn.unified.local.CampaignStateImportTest"], { encoding: "utf8" }));
 } finally {
  const resolved = fs.realpathSync(temp);
  assert.equal(path.dirname(resolved), tempParent, "cleanup must stay in the temporary directory");
  assert.ok(path.basename(resolved).startsWith("kf-android-campaign-import-"), "cleanup must only remove this test's fixture");
  fs.rmSync(resolved, { recursive: true, force: true });
 }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
