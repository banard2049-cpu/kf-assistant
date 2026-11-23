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
const settingsMethod = api.slice(api.indexOf("    private JSONObject userSettings("), api.indexOf("    private JSONObject campaigns("));
const mergeSettingsMethod = api.slice(api.indexOf("    private void mergeSettings("), api.indexOf("    private JSONObject currentUser("));
const copyRoute = api.slice(api.indexOf('if ("copy".equals(action) && "POST".equals(method))'), api.indexOf('if ("trash".equals(action)'));
const importRoute = api.slice(api.indexOf("private JSONObject campaignImport("), api.indexOf("private JSONObject sheetImport("));
const storeDb = api.slice(api.indexOf("    private static final class StoreDb"), api.lastIndexOf("\n}"));
const requestMethod = api.slice(api.indexOf("    public synchronized String request("), api.indexOf("    private JSONObject dispatch("));
const campaignSyncMethods = api.slice(api.indexOf("    private JSONObject campaignSync("), api.indexOf("    private JSONObject campaignExport("));
const pathMethods = api.slice(api.indexOf("    private Object getPath("), api.indexOf("    private String route("));
const mapSyncConstants = api.slice(api.indexOf("    private static final String MAP_PATH"), api.indexOf("    private static final Map<String, String> KNIGHTS"));
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
import java.util.Set;
import java.util.HashSet;
import java.util.Iterator;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONException;
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
  private static JSONObject copyObject(JSONObject value) throws JSONException { return value == null ? new JSONObject() : new JSONObject(value.toString()); }
  private static JSONArray copyArray(JSONArray value) throws JSONException { return value == null ? new JSONArray() : new JSONArray(value.toString()); }
  private static Object valueOrNull(Object value) { return value == null ? JSONObject.NULL : value; }
  private static JSONObject envelope(int status, JSONObject body) throws JSONException {
    return new JSONObject().put("status", status).put("body", body);
  }
  private static JSONObject ok(JSONObject value) throws JSONException { return envelope(200, value); }
  private static JSONObject error(String message) throws JSONException { return new JSONObject().put("error", message); }
  ${settingsMethod}
  ${mergeSettingsMethod}
  ${storeDb}
  ${requestMethod}
  ${campaignSyncMethods}
  ${pathMethods}
  ${mapSyncConstants}

  private final StoreDb database = new StoreDb(new Context());
  private static final class Uri { static Uri parse(String ignored) { return new Uri(); } }
  private String route(Uri uri) { return "campaign-sync"; }
  private JSONObject json(String value) throws JSONException { return new JSONObject(value); }
  private String safeMessage(Exception error) { return error.toString(); }
  private String now() { return "test time"; }
  private JSONObject dispatch(JSONObject store, String method, String route, Uri uri, JSONObject data) throws JSONException {
    return campaignSync(store, "owner", data);
  }
  private JSONObject activeCampaign(JSONObject store, String userId, String id) {
    return store.getJSONObject("campaigns").getJSONObject(userId).optJSONObject(id);
  }

  // The JVM harness only exposes SQLite's scalar API. Android's native
  // implementation returns the text directly without allocating a window.
  private static final class Context { final SQLiteDatabase db = new SQLiteDatabase(); }
  private static final class ContentValues extends HashMap<String, Object> {}
  private static final class SQLiteDoneException extends RuntimeException {}
  private static abstract class SQLiteOpenHelper {
    private final SQLiteDatabase db;
    SQLiteOpenHelper(Context context, String name, Object factory, int version) { db = context.db; }
    SQLiteDatabase getReadableDatabase() { return db; }
    SQLiteDatabase getWritableDatabase() { return db; }
    public abstract void onCreate(SQLiteDatabase db);
    public abstract void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion);
  }
  private static final class SQLiteDatabase {
    static final int CONFLICT_REPLACE = 5;
    String row;
    void execSQL(String sql) {}
    SQLiteStatement compileStatement(String sql) {
      check("SELECT json FROM store WHERE id=1".equals(sql), "read the original save row in place");
      return new SQLiteStatement(row);
    }
    long insertWithOnConflict(String table, String nullColumn, ContentValues values, int conflictAlgorithm) {
      check("store".equals(table) && Integer.valueOf(1).equals(values.get("id")) && conflictAlgorithm == CONFLICT_REPLACE,
        "keep writing the original row atomically");
      row = (String) values.get("json");
      return 1;
    }
  }
  private static final class SQLiteStatement implements AutoCloseable {
    private final String row;
    SQLiteStatement(String row) { this.row = row; }
    String simpleQueryForString() {
      if (row == null) throw new SQLiteDoneException();
      return row;
    }
    @Override public void close() {}
  }

  private static void checkLargeStore() throws Exception {
    Context context = new Context();
    StoreDb db = new StoreDb(context);
    check(db.read().getJSONObject("campaigns").length() == 0, "a new database should have an empty campaign list");
    String notes = "骑士🛡️".repeat(300_000);
    JSONObject legacy = object("currentUserId", "owner", "campaigns", object("owner", object("notes", notes)));
    context.db.row = legacy.toString();
    check(context.db.row.getBytes(StandardCharsets.UTF_8).length > 3 * 1024 * 1024, "fixture must exceed the default cursor window");

    JSONObject loaded = db.read();
    check(notes.equals(loaded.getJSONObject("campaigns").getJSONObject("owner").getString("notes")),
      "read the entire large legacy save including multibyte text");
    loaded.getJSONObject("settings").put("owner", object("marker", true));
    db.write(loaded);
    JSONObject reopened = new StoreDb(context).read();
    check(reopened.getJSONObject("settings").getJSONObject("owner").getBoolean("marker"), "large saves remain writable");
    check(notes.equals(reopened.getJSONObject("campaigns").getJSONObject("owner").getString("notes")),
      "a write and reopen must preserve the oversized content");
  }

  private static final String INDEXED_CLUE = "modules.map.knights.0.clues.martial";

  private JSONObject sync(JSONObject... ops) throws Exception {
    return new JSONObject(request("POST", "/api.php?route=campaign-sync", object("campaignId", "campaign", "operations", array((Object[]) ops)).toString()));
  }
  private static JSONObject op(String id, int base, String path, Object value) throws Exception {
    return object("id", id, "baseRevision", base, "path", path, "value", value);
  }
  private static JSONObject map(int round, boolean reordered, int bartos, int caelia) throws Exception {
    JSONObject left = object("sheetId", "squire:bartos", "memberType", "squire", "clues", object("martial", bartos));
    JSONObject right = object("sheetId", "squire:caelia", "memberType", "squire", "clues", object("martial", caelia));
    return object("round", round, "knights", reordered ? array(right, left) : array(left, right));
  }
  private static JSONObject acceptedMap(JSONObject response, String resolution) throws Exception {
    check(response.getInt("status") == 200, "expected successful sync: " + response);
    JSONObject body = response.getJSONObject("body");
    if (resolution != null) check(resolution.equals(body.getJSONArray("conflicts").getJSONObject(0).getString("resolution")), "expected resolution " + resolution);
    return body.getJSONObject("state").getJSONObject("modules").getJSONObject("map");
  }
  private static int clueAt(JSONObject map, int index) {
    return map.getJSONArray("knights").getJSONObject(index).getJSONObject("clues").getInt("martial");
  }
  private void checkCampaignClueSync() throws Exception {
    JSONObject record = object("state", object("modules", object("map", map(5, false, 2, 3))), "revision", 6,
      "fieldVersions", object(MAP_PATH, 5, INDEXED_CLUE, 6, "modules.map.knights.1.clues.martial", 4), "appliedOps", new JSONObject());
    database.write(object("campaigns", object("owner", object("campaign", record))));
    JSONObject staleMap = op("stale", 5, MAP_PATH, map(6, true, 0, 1));
    JSONObject merged = acceptedMap(sync(staleMap), "merged");
    check(merged.getInt("round") == 6 && clueAt(merged, 1) == 2 && clueAt(merged, 0) == 1,
      "carry forward the newer legacy clue by stable identity, ignoring older indexed revisions");

    JSONObject relative = op("gain", 5, INDEXED_CLUE, 1).put("squireId", "squire:bartos").put("clueDelta", 1);
    JSONObject gained = acceptedMap(sync(relative), null);
    check(clueAt(gained, 1) == 3 && clueAt(gained, 0) == 1, "apply a delta to the correct squire after reordering");
    check(clueAt(acceptedMap(sync(relative), null), 1) == 3, "retries must not repeat a clue delta");
    check(clueAt(acceptedMap(sync(staleMap), "merged"), 1) == 3, "a stale map retry receives the authoritative map");
    check(sync(op("absolute", 5, INDEXED_CLUE, 10)).getInt("status") == 409, "reject a legacy write with a stale index");

    JSONObject lowered = acceptedMap(sync(op("lower", 5, MAP_PATH, map(4, false, 0, 1))), "existing");
    check(lowered.getInt("round") == 6, "keep an existing higher round when a stale write loses arbitration");
    check(clueAt(acceptedMap(sync(op("fresh", 20, MAP_PATH, map(7, true, 5, 1))), null), 1) == 5, "allow a fresh map to intentionally change a clue");
    check(clueAt(acceptedMap(sync(op("next", 9, MAP_PATH, map(8, false, 0, 1))), "merged"), 0) == 5, "record clue revisions from whole-map writes");

    JSONObject missing = op("missing", 20, INDEXED_CLUE, 1).put("squireId", "squire:missing").put("clueDelta", 1);
    JSONObject result = sync(op("rollback", 20, "presentation.scene", "conflict"), missing);
    check(result.getInt("status") == 409, "report a removed squire");
    JSONObject after = activeCampaign(database.read(), "owner", "campaign");
    check(!after.getJSONObject("state").has("presentation") && !after.getJSONObject("appliedOps").has("rollback"),
      "a failed batch must persist neither earlier edits nor their operation IDs");
  }

  public static void main(String[] args) throws Exception {
    checkLargeStore();
    CampaignStateImportTest localApi = new CampaignStateImportTest();
    localApi.checkCampaignClueSync();
    JSONObject store = object("settings", new JSONObject());
    JSONObject ledger = object("enabled", true, "level", 2, "shards", 14, "built", array("saints-sanctuary"), "loadouts", array(object("name", "saved setup")));
    localApi.userSettings(store, "owner", "PATCH", object("jura", ledger));
    ledger.put("shards", 999);
    JSONObject savedSettings = localApi.userSettings(store, "owner", "GET", new JSONObject()).getJSONObject("body").getJSONObject("settings");
    check(savedSettings.getJSONObject("jura").getInt("shards") == 14, "Android must persist a copied Jura ledger");
    savedSettings.getJSONObject("jura").put("shards", 888);
    check(store.getJSONObject("settings").getJSONObject("owner").getJSONObject("jura").getInt("shards") == 14, "GET must not expose mutable stored data");
    localApi.userSettings(store, "owner", "PATCH", object("passwords", array(object("id", "keep"))));
    check(store.getJSONObject("settings").getJSONObject("owner").getJSONObject("jura").getInt("shards") == 14, "unrelated settings updates preserve Jura");
    localApi.mergeSettings(store, "owner", object("jura", object("enabled", true, "shards", 7), "passwords", array(object("id", "imported"))));
    check(store.getJSONObject("settings").getJSONObject("owner").getJSONObject("jura").getInt("shards") == 7, "campaign imports restore the shared Jura ledger");
    check(store.getJSONObject("settings").getJSONObject("owner").getJSONArray("passwords").length() == 2, "imports retain existing passwords");
    localApi.mergeSettings(store, "owner", object("jura", JSONObject.NULL));
    check(store.getJSONObject("settings").getJSONObject("owner").getJSONObject("jura").getInt("shards") == 7, "legacy imports without a ledger cannot clear existing Jura");
    localApi.userSettings(store, "owner", "PATCH", object("jura", JSONObject.NULL));
    check(store.getJSONObject("settings").getJSONObject("owner").isNull("jura"), "explicit settings reset stores JSON null");
    check(!localApi.userSettings(store, "other", "GET", new JSONObject()).getJSONObject("body").getJSONObject("settings").has("jura"), "accounts keep separate ledgers");
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
    System.out.println("Android local saves passed: oversized legacy saves, stable squire clue sync, rejected batch rollback, Jura settings, and campaign import/copy.");
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
