package com.kingdomsforlorn.unified.local;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.net.Uri;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;
import java.util.UUID;

final class LocalApi {
    private static final Map<String, String> KNIGHTS = new HashMap<>();
    static {
        KNIGHTS.put("stoneface", "Stoneface");
        KNIGHTS.put("fleischritter", "Fleischritter");
        KNIGHTS.put("renholder", "Renholder");
        KNIGHTS.put("ser-sonch", "Ser Sonch");
        KNIGHTS.put("paracelsa", "Paracelsa");
        KNIGHTS.put("ser-ubar", "Ser Ubar");
        KNIGHTS.put("kara", "Kara");
    }

    private final StoreDb database;

    LocalApi(Context context) {
        database = new StoreDb(context.getApplicationContext());
    }

    @JavascriptInterface
    public synchronized String request(String method, String rawUrl, String body) {
        try {
            JSONObject store = database.read();
            Uri uri = Uri.parse(rawUrl);
            String route = route(uri);
            JSONObject payload = json(body);
            JSONObject result = dispatch(store, method == null ? "GET" : method.toUpperCase(Locale.ROOT), route, uri, payload);
            database.write(store);
            return result.toString();
        } catch (Exception error) {
            try {
                return envelope(500, error("本地存档处理失败：" + safeMessage(error))).toString();
            } catch (JSONException ignored) {
                return "{\"status\":500,\"body\":{\"error\":\"本地存档处理失败\"}}";
            }
        }
    }

    private JSONObject dispatch(JSONObject store, String method, String route, Uri uri, JSONObject data) throws Exception {
        if ("health".equals(route)) return ok(new JSONObject().put("ok", true).put("time", now()));
        if ("config".equals(route)) return ok(new JSONObject().put("registration", true));
        if ("auth/me".equals(route)) {
            JSONObject user = currentUser(store);
            return ok(new JSONObject().put("user", user == null ? JSONObject.NULL : publicUser(user)));
        }
        if ("auth/register".equals(route) && "POST".equals(method)) return register(store, data);
        if ("auth/login".equals(route) && "POST".equals(method)) return login(store, data);
        if ("auth/logout".equals(route) && "POST".equals(method)) {
            store.put("currentUserId", "");
            return ok(new JSONObject().put("ok", true));
        }

        JSONObject user = currentUser(store);
        if (user == null) return envelope(401, error("请先登录"));
        String userId = user.getString("id");
        String defaultCampaignId = ensureDefaultCampaign(store, userId);

        if ("user-settings".equals(route)) return userSettings(store, userId, method, data);
        if ("campaigns".equals(route)) return campaigns(store, userId, defaultCampaignId, method, uri, data);
        if (route.startsWith("campaigns/")) return campaignRecord(store, userId, method, route, data);
        if ("campaign-sync".equals(route) && "POST".equals(method)) return campaignSync(store, userId, data);
        if ("campaign-export".equals(route) && "GET".equals(method)) return campaignExport(store, userId, uri);
        if ("campaign-import".equals(route) && "POST".equals(method)) return campaignImport(store, userId, data);
        if ("encounters/start".equals(route) && "POST".equals(method)) return encounter(store, userId, data, true);
        if ("encounters/complete".equals(route) && "POST".equals(method)) return encounter(store, userId, data, false);
        if ("sheets".equals(route)) return sheets(store, userId, defaultCampaignId, method, uri, data);
        if (route.startsWith("sheets/")) return sheetRecord(store, userId, method, route, data);
        if ("sync".equals(route) && "POST".equals(method)) return sheetSync(store, userId, data);
        if ("export".equals(route) || "import".equals(route) || "game-settings".equals(route))
            return envelope(410, error("旧版接口已停用，请使用新版完整存档导入导出"));
        return envelope(404, error("接口不存在"));
    }

    private JSONObject register(JSONObject store, JSONObject data) throws Exception {
        String username = data.optString("username", "").trim();
        String key = username.toLowerCase(Locale.ROOT);
        String password = data.optString("password", "");
        if (!username.matches("[\\p{L}\\p{N}_.-]{3,32}") || password.length() < 8 || password.length() > 128)
            return envelope(400, error("用户名需为 3-32 位，密码至少 8 位"));
        JSONObject users = store.getJSONObject("users");
        if (findUserByKey(users, key) != null) return envelope(409, error("用户名已存在"));
        String id = uuid();
        JSONObject user = new JSONObject().put("id", id).put("username", username).put("key", key)
                .put("passwordHash", hash(password)).put("createdAt", now());
        users.put(id, user);
        store.put("currentUserId", id);
        ensureDefaultCampaign(store, id);
        return envelope(201, new JSONObject().put("user", publicUser(user)));
    }

    private JSONObject login(JSONObject store, JSONObject data) throws Exception {
        String key = data.optString("username", "").trim().toLowerCase(Locale.ROOT);
        JSONObject user = findUserByKey(store.getJSONObject("users"), key);
        if (user == null || !user.optString("passwordHash").equals(hash(data.optString("password", ""))))
            return envelope(401, error("用户名或密码错误"));
        store.put("currentUserId", user.getString("id"));
        ensureDefaultCampaign(store, user.getString("id"));
        return ok(new JSONObject().put("user", publicUser(user)));
    }

    private JSONObject userSettings(JSONObject store, String userId, String method, JSONObject data) throws JSONException {
        JSONObject all = store.getJSONObject("settings");
        JSONObject settings = all.optJSONObject(userId);
        if (settings == null) settings = new JSONObject().put("storyMarkers", new JSONObject()).put("passwords", new JSONArray());
        if ("PATCH".equals(method)) {
            if (data.has("storyMarkers")) settings.put("storyMarkers", copyObject(data.optJSONObject("storyMarkers")));
            if (data.has("passwords")) settings.put("passwords", copyArray(data.optJSONArray("passwords")));
            all.put(userId, settings);
        }
        return ok(new JSONObject().put("settings", copyObject(settings)));
    }

    private JSONObject campaigns(JSONObject store, String userId, String defaultId, String method, Uri uri, JSONObject data) throws JSONException {
        JSONObject all = campaignBucket(store, userId);
        if ("POST".equals(method)) {
            JSONObject record = newCampaign(data.optString("name", "新战役"), defaultCampaignState());
            all.put(record.getString("id"), record);
            return envelope(201, new JSONObject().put("campaign", parsedCampaign(record)));
        }
        boolean trash = "1".equals(uri.getQueryParameter("trash"));
        JSONArray rows = new JSONArray();
        for (JSONObject record : sortedRecords(all)) if (isDeleted(record) == trash) rows.put(campaignSummary(record));
        return ok(new JSONObject().put("campaigns", rows).put("defaultCampaignId", defaultId));
    }

    private JSONObject campaignRecord(JSONObject store, String userId, String method, String route, JSONObject data) throws JSONException {
        String[] parts = route.split("/");
        if (parts.length < 2) return envelope(404, error("战役不存在"));
        JSONObject bucket = campaignBucket(store, userId);
        JSONObject record = bucket.optJSONObject(parts[1]);
        String action = parts.length > 2 ? parts[2] : "";
        if (record == null || (isDeleted(record) && !"restore".equals(action))) return envelope(404, error("战役不存在"));
        if (action.isEmpty() && "GET".equals(method)) return ok(new JSONObject().put("campaign", parsedCampaign(record)));
        if (action.isEmpty() && "PATCH".equals(method)) {
            record.put("name", title(data.optString("name", ""))).put("updatedAt", now());
            return ok(new JSONObject().put("ok", true));
        }
        if ("copy".equals(action) && "POST".equals(method)) {
            JSONObject copy = newCampaign(record.optString("name") + "（副本）", copyObject(record.optJSONObject("state")));
            bucket.put(copy.getString("id"), copy);
            return envelope(201, new JSONObject().put("id", copy.getString("id")));
        }
        if ("trash".equals(action) && "POST".equals(method)) {
            int active = 0;
            for (Iterator<String> keys = bucket.keys(); keys.hasNext();) if (!isDeleted(bucket.optJSONObject(keys.next()))) active++;
            if (active <= 1) return envelope(400, error("至少保留一个战役"));
            record.put("deletedAt", now()).put("updatedAt", now());
            return ok(new JSONObject().put("ok", true));
        }
        if ("restore".equals(action) && "POST".equals(method)) {
            record.put("deletedAt", JSONObject.NULL).put("updatedAt", now());
            return ok(new JSONObject().put("ok", true));
        }
        return envelope(404, error("接口不存在"));
    }

    private JSONObject campaignSync(JSONObject store, String userId, JSONObject data) throws JSONException {
        JSONObject record = activeCampaign(store, userId, data.optString("campaignId"));
        if (record == null) return envelope(404, error("战役不存在"));
        JSONObject state = record.getJSONObject("state");
        JSONObject versions = record.getJSONObject("fieldVersions");
        JSONObject applied = record.getJSONObject("appliedOps");
        int revision = record.optInt("revision");
        JSONArray conflicts = new JSONArray();
        JSONArray operations = data.optJSONArray("operations");
        for (int index = 0; operations != null && index < Math.min(200, operations.length()); index++) {
            JSONObject operation = operations.optJSONObject(index);
            if (operation == null) continue;
            String operationId = operation.optString("id");
            if (!operationId.isEmpty() && applied.has(operationId)) continue;
            String path = operation.optString("path");
            int base = operation.optInt("baseRevision");
            if (versions.optInt(path) > base) {
                conflicts.put(new JSONObject().put("path", path).put("previous", valueOrNull(getPath(state, path))).put("resolution", "incoming"));
            }
            revision++;
            setPath(state, path, valueOrNull(operation.opt("value")));
            versions.put(path, revision);
            if (!operationId.isEmpty()) applied.put(operationId, true);
        }
        trimObject(applied, 1500);
        record.put("revision", revision).put("updatedAt", now());
        return ok(new JSONObject().put("state", copyObject(state)).put("revision", revision).put("conflicts", conflicts));
    }

    private JSONObject campaignExport(JSONObject store, String userId, Uri uri) throws JSONException {
        JSONObject campaign = activeCampaign(store, userId, uri.getQueryParameter("campaignId"));
        if (campaign == null) return envelope(404, error("战役不存在"));
        JSONArray exportedSheets = new JSONArray();
        JSONObject sheets = sheetBucket(store, userId);
        for (JSONObject sheet : sortedRecords(sheets)) if (!isDeleted(sheet)) {
            exportedSheets.put(new JSONObject().put("id", sheet.getString("id")).put("title", sheet.getString("title"))
                    .put("state", copyObject(sheet.getJSONObject("state"))));
        }
        JSONObject settings = store.getJSONObject("settings").optJSONObject(userId);
        if (settings == null) settings = new JSONObject().put("storyMarkers", new JSONObject()).put("passwords", new JSONArray());
        JSONObject payload = new JSONObject().put("name", campaign.getString("name"))
                .put("state", copyObject(campaign.getJSONObject("state"))).put("sheets", exportedSheets);
        return ok(new JSONObject().put("format", "kf-unified-campaign").put("schemaVersion", 2).put("exportedAt", now())
                .put("shared", copyObject(settings)).put("campaign", payload));
    }

    private JSONObject campaignImport(JSONObject store, String userId, JSONObject data) throws JSONException {
        if (!"kf-unified-campaign".equals(data.optString("format")) || data.optInt("schemaVersion") != 2 || data.optJSONObject("campaign") == null)
            return envelope(400, error("只支持新版 KF 一体化战役存档（版本 2）"));
        JSONObject payload = data.getJSONObject("campaign");
        JSONObject importedState = copyObject(payload.optJSONObject("state"));
        if (importedState.length() == 0) importedState = defaultCampaignState();
        importedState.put("schemaVersion", 2);
        JSONObject sheets = sheetBucket(store, userId);
        Map<String, String> existingByKnight = new HashMap<>();
        for (JSONObject existing : sortedRecords(sheets)) if (!isDeleted(existing)) {
            String knightId = existing.getJSONObject("state").optString("knightId");
            if (!knightId.isEmpty()) existingByKnight.put(knightId, existing.getString("id"));
        }
        JSONArray sourceSheets = payload.optJSONArray("sheets");
        Map<String, String> sheetMap = new HashMap<>();
        Set<String> seen = new HashSet<>();
        for (int index = 0; sourceSheets != null && index < Math.min(100, sourceSheets.length()); index++) {
            JSONObject source = sourceSheets.optJSONObject(index);
            JSONObject state = source == null ? null : source.optJSONObject("state");
            String knightId = state == null ? "" : state.optString("knightId");
            if (!KNIGHTS.containsKey(knightId) || !seen.add(knightId)) return envelope(400, error("导入文件包含无效或重复的骑士身份"));
            sheetMap.put(source.optString("id", uuid()), existingByKnight.containsKey(knightId) ? existingByKnight.get(knightId) : uuid());
        }
        String leader = importedState.optString("leaderSheetId");
        if (sheetMap.containsKey(leader)) importedState.put("leaderSheetId", sheetMap.get(leader));
        JSONArray party = importedState.optJSONArray("party");
        if (party != null) for (int index = 0; index < party.length(); index++) {
            String oldId = party.optString(index);
            if (sheetMap.containsKey(oldId)) party.put(index, sheetMap.get(oldId));
        }
        JSONObject campaign = newCampaign(title(payload.optString("name", "导入战役")) + "（导入）", importedState);
        campaignBucket(store, userId).put(campaign.getString("id"), campaign);
        for (int index = 0; sourceSheets != null && index < Math.min(100, sourceSheets.length()); index++) {
            JSONObject source = sourceSheets.optJSONObject(index);
            JSONObject state = source == null ? null : source.optJSONObject("state");
            if (state == null) continue;
            String knightId = state.optString("knightId");
            if (existingByKnight.containsKey(knightId)) continue;
            JSONObject copy = copyObject(state).put("knight", KNIGHTS.get(knightId));
            String newId = sheetMap.get(source.optString("id"));
            JSONObject record = newSheet(newId == null ? uuid() : newId, title(source.optString("title", KNIGHTS.get(knightId))), copy);
            sheets.put(record.getString("id"), record);
        }
        mergeSettings(store, userId, data.optJSONObject("shared"));
        return envelope(201, new JSONObject().put("id", campaign.getString("id")));
    }

    private JSONObject encounter(JSONObject store, String userId, JSONObject data, boolean start) throws JSONException {
        JSONObject campaign = activeCampaign(store, userId, data.optString("campaignId"));
        if (campaign == null) return envelope(404, error("战役不存在"));
        JSONObject state = campaign.getJSONObject("state");
        if (start) {
            int level = Math.max(1, Math.min(4, data.optInt("level", 1)));
            String type = data.optString("type", "normal");
            if (!"ambush".equals(type) && !"special".equals(type)) type = "normal";
            state.put("encounter", new JSONObject().put("active", true).put("monster", data.optString("monster"))
                    .put("level", level).put("type", type).put("phase", "setup").put("board", new JSONObject()).put("result", ""));
            state.put("aibp", new JSONObject().put("monster", data.optString("monster")).put("level", level)
                    .put("ai", new JSONArray()).put("bp", new JSONArray()).put("discard", new JSONArray())
                    .put("wounds", new JSONArray()).put("promotion", 0).put("history", new JSONArray()));
        } else {
            JSONObject encounter = state.optJSONObject("encounter");
            if (encounter == null) encounter = new JSONObject();
            String result = data.optString("result", "victory");
            if (!"defeat".equals(result) && !"retreat".equals(result)) result = "victory";
            encounter.put("active", false).put("result", result).put("resultDetails", new JSONObject()
                    .put("casualties", data.optString("casualties")).put("rewards", data.optString("rewards")));
            state.put("encounter", encounter);
        }
        campaign.put("revision", campaign.optInt("revision") + 1).put("updatedAt", now());
        return ok(new JSONObject().put("state", copyObject(state)));
    }

    private JSONObject sheets(JSONObject store, String userId, String defaultCampaignId, String method, Uri uri, JSONObject data) throws JSONException {
        String campaignId = uri.getQueryParameter("campaignId");
        if (campaignId == null || campaignId.isEmpty()) campaignId = data.optString("campaignId", defaultCampaignId);
        if (activeCampaign(store, userId, campaignId) == null) return envelope(404, error("战役不存在"));
        JSONObject bucket = sheetBucket(store, userId);
        if ("POST".equals(method)) {
            String knightId = data.optString("knightId");
            if (!KNIGHTS.containsKey(knightId)) return envelope(400, error("请选择一个有效的骑士"));
            for (JSONObject existing : sortedRecords(bucket)) if (!isDeleted(existing) && knightId.equals(existing.getJSONObject("state").optString("knightId")))
                return envelope(409, error("已经有这名骑士的共享档案"));
            JSONObject state = defaultKnightState(knightId, data.optString("player"));
            String requestedTitle = data.optString("title").trim();
            JSONObject record = newSheet(uuid(), requestedTitle.isEmpty() ? KNIGHTS.get(knightId) : title(requestedTitle), state);
            bucket.put(record.getString("id"), record);
            return envelope(201, new JSONObject().put("sheet", parsedSheet(record)));
        }
        boolean trash = "1".equals(uri.getQueryParameter("trash"));
        boolean overview = "1".equals(uri.getQueryParameter("overview"));
        JSONArray rows = new JSONArray();
        for (JSONObject record : sortedRecords(bucket)) if (isDeleted(record) == trash) rows.put(sheetSummary(record, overview));
        return ok(new JSONObject().put("sheets", rows));
    }

    private JSONObject sheetRecord(JSONObject store, String userId, String method, String route, JSONObject data) throws JSONException {
        String[] parts = route.split("/");
        if (parts.length < 2) return envelope(404, error("档案不存在"));
        JSONObject bucket = sheetBucket(store, userId);
        JSONObject record = bucket.optJSONObject(parts[1]);
        String action = parts.length > 2 ? parts[2] : "";
        if (record == null || (isDeleted(record) && !"restore".equals(action))) return envelope(404, error("档案不存在"));
        if (action.isEmpty() && "GET".equals(method)) return ok(new JSONObject().put("sheet", parsedSheet(record)));
        if (action.isEmpty() && "PATCH".equals(method)) {
            record.put("title", title(data.optString("title"))).put("updatedAt", now());
            return ok(new JSONObject().put("ok", true));
        }
        if ("copy".equals(action) && "POST".equals(method)) return envelope(409, error("骑士档案跨战役共享，无需复制"));
        if ("trash".equals(action) && "POST".equals(method)) {
            record.put("deletedAt", now()).put("updatedAt", now());
            JSONObject campaigns = campaignBucket(store, userId);
            for (Iterator<String> keys = campaigns.keys(); keys.hasNext();) {
                JSONObject campaign = campaigns.optJSONObject(keys.next());
                JSONObject state = campaign == null ? null : campaign.optJSONObject("state");
                if (state == null) continue;
                boolean changed = false;
                if (record.optString("id").equals(state.optString("leaderSheetId"))) { state.put("leaderSheetId", ""); changed = true; }
                JSONArray party = state.optJSONArray("party");
                if (party != null) for (int index = party.length() - 1; index >= 0; index--) if (record.optString("id").equals(party.optString(index))) { party.remove(index); changed = true; }
                if (changed) campaign.put("revision", campaign.optInt("revision") + 1).put("updatedAt", now());
            }
            return ok(new JSONObject().put("ok", true));
        }
        if ("restore".equals(action) && "POST".equals(method)) {
            String knightId = record.getJSONObject("state").optString("knightId");
            for (JSONObject existing : sortedRecords(bucket)) if (!isDeleted(existing) && knightId.equals(existing.getJSONObject("state").optString("knightId")))
                return envelope(409, error("这名骑士已有共享档案，无法恢复重复备份"));
            record.put("deletedAt", JSONObject.NULL).put("updatedAt", now());
            return ok(new JSONObject().put("ok", true));
        }
        return envelope(404, error("接口不存在"));
    }

    private JSONObject sheetSync(JSONObject store, String userId, JSONObject data) throws JSONException {
        JSONObject record = activeSheet(store, userId, data.optString("sheetId"));
        if (record == null) return envelope(404, error("档案不存在"));
        JSONObject state = record.getJSONObject("state");
        JSONObject versions = record.getJSONObject("fieldVersions");
        JSONObject applied = record.getJSONObject("appliedOps");
        int revision = record.optInt("revision");
        JSONArray conflicts = new JSONArray();
        JSONArray operations = data.optJSONArray("operations");
        for (int index = 0; operations != null && index < Math.min(200, operations.length()); index++) {
            JSONObject operation = operations.optJSONObject(index);
            if (operation == null) continue;
            String operationId = operation.optString("id");
            if (!operationId.isEmpty() && applied.has(operationId)) continue;
            String path = operation.optString("path");
            int base = operation.optInt("baseRevision");
            if (versions.optInt(path) > base) conflicts.put(new JSONObject().put("path", path).put("previous", valueOrNull(getPath(state, path))));
            revision++;
            setPath(state, path, valueOrNull(operation.opt("value")));
            versions.put(path, revision);
            if (!operationId.isEmpty()) applied.put(operationId, true);
        }
        trimObject(applied, 1500);
        record.put("revision", revision).put("updatedAt", now());
        return ok(new JSONObject().put("state", copyObject(state)).put("revision", revision).put("conflicts", conflicts));
    }

    private JSONObject defaultCampaignState() throws JSONException {
        JSONObject kingdoms = new JSONObject()
                .put("sunken", new JSONObject().put("tiles", new JSONArray()).put("partyTile", "").put("markers", new JSONArray()).put("round", 0))
                .put("stone", new JSONObject().put("tiles", new JSONArray()).put("partyTile", "").put("markers", new JSONArray()).put("round", 0));
        return new JSONObject().put("schemaVersion", 2).put("kingdom", "sunken").put("leaderSheetId", "")
                .put("party", new JSONArray()).put("squires", new JSONArray())
                .put("monsterPool", new JSONObject().put("row", 0).put("cards", new JSONArray()).put("districts", new JSONArray()).put("history", new JSONArray()))
                .put("map", new JSONObject().put("activeKingdom", "sunken").put("kingdoms", kingdoms))
                .put("encounter", new JSONObject().put("active", false).put("monster", "").put("level", 1).put("type", "normal")
                        .put("phase", "setup").put("board", new JSONObject()).put("result", ""))
                .put("aibp", new JSONObject().put("monster", "").put("level", 1).put("ai", new JSONArray()).put("bp", new JSONArray())
                        .put("discard", new JSONArray()).put("wounds", new JSONArray()).put("promotion", 0).put("history", new JSONArray()))
                .put("modules", new JSONObject().put("map", JSONObject.NULL).put("encounter", JSONObject.NULL).put("aibp", JSONObject.NULL));
    }

    private JSONObject defaultKnightState(String knightId, String player) throws JSONException {
        JSONObject virtues = new JSONObject();
        for (String key : new String[]{"bravery", "tenacity", "sagacity", "fortitude", "might", "insight"})
            virtues.put(key, new JSONObject().put("value", 0).put("vice", new JSONArray().put(false).put(false).put(false).put(false)));
        JSONArray story = new JSONArray();
        for (int index = 0; index < 5; index++) {
            JSONArray investigations = new JSONArray();
            for (int item = 0; item < 3; item++) investigations.put(new JSONObject().put("attempted", false).put("success", ""));
            story.put(new JSONObject().put("quest", false).put("investigations", investigations));
        }
        JSONArray rapport = new JSONArray();
        for (int index = 0; index < 4; index++) rapport.put(new JSONObject().put("knight", "")
                .put("hearts", new JSONArray().put(false).put(false).put(false)).put("favor", ""));
        return new JSONObject().put("knightId", knightId).put("knight", KNIGHTS.get(knightId)).put("player", player)
                .put("bane", 0).put("gold", 0).put("leads", 0).put("sigh", 0).put("virtues", virtues).put("notes", "")
                .put("prologue", false).put("story", story).put("rapport", rapport).put("armory", new JSONArray().put(""))
                .put("saints", new JSONArray().put("")).put("mercenaries", new JSONArray().put(""))
                .put("choices", new JSONObject()).put("choicesUnlocked", false).put("successfulInvestigations", new JSONObject()).put("firstDeath", false);
    }

    private JSONObject newCampaign(String name, JSONObject state) throws JSONException {
        String time = now();
        return new JSONObject().put("id", uuid()).put("name", title(name)).put("state", state == null ? defaultCampaignState() : state)
                .put("fieldVersions", new JSONObject()).put("appliedOps", new JSONObject()).put("revision", 0)
                .put("createdAt", time).put("updatedAt", time).put("deletedAt", JSONObject.NULL);
    }

    private JSONObject newSheet(String id, String title, JSONObject state) throws JSONException {
        String time = now();
        return new JSONObject().put("id", id).put("title", title).put("state", state).put("fieldVersions", new JSONObject())
                .put("appliedOps", new JSONObject()).put("revision", 0).put("createdAt", time).put("updatedAt", time).put("deletedAt", JSONObject.NULL);
    }

    private String ensureDefaultCampaign(JSONObject store, String userId) throws JSONException {
        JSONObject bucket = campaignBucket(store, userId);
        for (JSONObject record : sortedRecords(bucket)) if (!isDeleted(record)) return record.getString("id");
        JSONObject record = newCampaign("默认战役", defaultCampaignState());
        bucket.put(record.getString("id"), record);
        return record.getString("id");
    }

    private JSONObject campaignBucket(JSONObject store, String userId) throws JSONException {
        JSONObject all = store.getJSONObject("campaigns");
        JSONObject bucket = all.optJSONObject(userId);
        if (bucket == null) { bucket = new JSONObject(); all.put(userId, bucket); }
        return bucket;
    }

    private JSONObject sheetBucket(JSONObject store, String userId) throws JSONException {
        JSONObject all = store.getJSONObject("sheets");
        JSONObject bucket = all.optJSONObject(userId);
        if (bucket == null) { bucket = new JSONObject(); all.put(userId, bucket); }
        return bucket;
    }

    private JSONObject activeCampaign(JSONObject store, String userId, String id) throws JSONException {
        JSONObject record = campaignBucket(store, userId).optJSONObject(id);
        return record == null || isDeleted(record) ? null : record;
    }

    private JSONObject activeSheet(JSONObject store, String userId, String id) throws JSONException {
        JSONObject record = sheetBucket(store, userId).optJSONObject(id);
        return record == null || isDeleted(record) ? null : record;
    }

    private JSONObject campaignSummary(JSONObject record) throws JSONException {
        return new JSONObject().put("id", record.getString("id")).put("name", record.getString("name"))
                .put("revision", record.optInt("revision")).put("created_at", record.optString("createdAt"))
                .put("updated_at", record.optString("updatedAt")).put("deleted_at", valueOrNull(record.opt("deletedAt"))).put("deleted", isDeleted(record));
    }

    private JSONObject parsedCampaign(JSONObject record) throws JSONException {
        return campaignSummary(record).put("state", copyObject(record.optJSONObject("state")))
                .put("fieldVersions", copyObject(record.optJSONObject("fieldVersions")));
    }

    private JSONObject sheetSummary(JSONObject record, boolean overview) throws JSONException {
        JSONObject result = new JSONObject().put("id", record.getString("id")).put("title", record.getString("title"))
                .put("revision", record.optInt("revision")).put("created_at", record.optString("createdAt"))
                .put("updated_at", record.optString("updatedAt")).put("deleted_at", valueOrNull(record.opt("deletedAt"))).put("deleted", isDeleted(record));
        if (overview) result.put("state", copyObject(record.optJSONObject("state")));
        return result;
    }

    private JSONObject parsedSheet(JSONObject record) throws JSONException {
        return sheetSummary(record, true).put("fieldVersions", copyObject(record.optJSONObject("fieldVersions")));
    }

    private void mergeSettings(JSONObject store, String userId, JSONObject imported) throws JSONException {
        if (imported == null) return;
        JSONObject all = store.getJSONObject("settings");
        JSONObject current = all.optJSONObject(userId);
        if (current == null) current = new JSONObject().put("storyMarkers", new JSONObject()).put("passwords", new JSONArray());
        JSONObject markers = current.optJSONObject("storyMarkers");
        if (markers == null) markers = new JSONObject();
        JSONObject incomingMarkers = imported.optJSONObject("storyMarkers");
        if (incomingMarkers != null) for (Iterator<String> keys = incomingMarkers.keys(); keys.hasNext();) {
            String key = keys.next(); if (incomingMarkers.optBoolean(key)) markers.put(key, true);
        }
        JSONArray passwords = current.optJSONArray("passwords");
        if (passwords == null) passwords = new JSONArray();
        Set<String> ids = new HashSet<>();
        for (int index = 0; index < passwords.length(); index++) ids.add(passwords.optJSONObject(index) == null ? "" : passwords.optJSONObject(index).optString("id"));
        JSONArray incomingPasswords = imported.optJSONArray("passwords");
        for (int index = 0; incomingPasswords != null && index < incomingPasswords.length(); index++) {
            JSONObject item = incomingPasswords.optJSONObject(index);
            if (item != null && ids.add(item.optString("id"))) passwords.put(copyObject(item));
        }
        current.put("storyMarkers", markers).put("passwords", passwords);
        all.put(userId, current);
    }

    private JSONObject currentUser(JSONObject store) {
        String id = store.optString("currentUserId", "");
        return id.isEmpty() ? null : store.optJSONObject("users") == null ? null : store.optJSONObject("users").optJSONObject(id);
    }

    private JSONObject findUserByKey(JSONObject users, String key) {
        for (Iterator<String> ids = users.keys(); ids.hasNext();) {
            JSONObject user = users.optJSONObject(ids.next());
            if (user != null && key.equals(user.optString("key"))) return user;
        }
        return null;
    }

    private JSONObject publicUser(JSONObject user) throws JSONException {
        return new JSONObject().put("id", user.getString("id")).put("username", user.getString("username")).put("created_at", user.optString("createdAt"));
    }

    private List<JSONObject> sortedRecords(JSONObject bucket) {
        List<JSONObject> records = new ArrayList<>();
        for (Iterator<String> keys = bucket.keys(); keys.hasNext();) {
            JSONObject record = bucket.optJSONObject(keys.next());
            if (record != null) records.add(record);
        }
        Collections.sort(records, new Comparator<JSONObject>() {
            @Override public int compare(JSONObject left, JSONObject right) { return right.optString("updatedAt").compareTo(left.optString("updatedAt")); }
        });
        return records;
    }

    private boolean isDeleted(JSONObject record) {
        if (record == null) return false;
        Object value = record.opt("deletedAt");
        return value != null && value != JSONObject.NULL && !String.valueOf(value).isEmpty();
    }

    private Object getPath(Object root, String path) {
        Object current = root;
        for (String part : path.split("\\.")) {
            if (current instanceof JSONObject) current = ((JSONObject) current).opt(part);
            else if (current instanceof JSONArray && part.matches("\\d+")) current = ((JSONArray) current).opt(Integer.parseInt(part));
            else return null;
            if (current == null || current == JSONObject.NULL) return current;
        }
        return current;
    }

    private void setPath(JSONObject root, String path, Object value) throws JSONException {
        String[] parts = path.split("\\.");
        Object current = root;
        for (int index = 0; index < parts.length - 1; index++) {
            String part = parts[index];
            boolean nextArray = parts[index + 1].matches("\\d+");
            if (current instanceof JSONObject) {
                JSONObject object = (JSONObject) current;
                Object next = object.opt(part);
                if (!(next instanceof JSONObject) && !(next instanceof JSONArray)) {
                    next = nextArray ? new JSONArray() : new JSONObject();
                    object.put(part, next);
                }
                current = next;
            } else if (current instanceof JSONArray && part.matches("\\d+")) {
                JSONArray array = (JSONArray) current;
                int position = Integer.parseInt(part);
                ensureLength(array, position + 1);
                Object next = array.opt(position);
                if (!(next instanceof JSONObject) && !(next instanceof JSONArray)) {
                    next = nextArray ? new JSONArray() : new JSONObject();
                    array.put(position, next);
                }
                current = next;
            } else throw new JSONException("无效字段路径");
        }
        String last = parts[parts.length - 1];
        if (current instanceof JSONObject) ((JSONObject) current).put(last, value);
        else if (current instanceof JSONArray && last.matches("\\d+")) {
            int position = Integer.parseInt(last); ensureLength((JSONArray) current, position + 1); ((JSONArray) current).put(position, value);
        } else throw new JSONException("无效字段路径");
    }

    private void ensureLength(JSONArray array, int length) { while (array.length() < length) array.put(JSONObject.NULL); }

    private void trimObject(JSONObject object, int limit) {
        while (object.length() > limit) {
            Iterator<String> keys = object.keys();
            if (!keys.hasNext()) break;
            object.remove(keys.next());
        }
    }

    private String route(Uri uri) {
        String route = uri.getQueryParameter("route");
        if (route != null) return trimSlashes(route);
        String path = uri.getPath() == null ? "" : uri.getPath();
        if (path.startsWith("/api/")) path = path.substring(5);
        return trimSlashes(path);
    }

    private String trimSlashes(String value) { return value == null ? "" : value.replaceAll("^/+|/+$", ""); }
    private JSONObject json(String value) throws JSONException { return value == null || value.trim().isEmpty() ? new JSONObject() : new JSONObject(value); }
    private JSONObject copyObject(JSONObject value) throws JSONException { return value == null ? new JSONObject() : new JSONObject(value.toString()); }
    private JSONArray copyArray(JSONArray value) throws JSONException { return value == null ? new JSONArray() : new JSONArray(value.toString()); }
    private Object valueOrNull(Object value) { return value == null ? JSONObject.NULL : value; }
    private JSONObject error(String message) throws JSONException { return new JSONObject().put("error", message); }
    private JSONObject ok(JSONObject body) throws JSONException { return envelope(200, body); }
    private JSONObject envelope(int status, JSONObject body) throws JSONException { return new JSONObject().put("status", status).put("body", body); }
    private String title(String value) { String text = value == null ? "" : value.trim(); return text.isEmpty() ? "未命名骑士" : text.length() > 80 ? text.substring(0, 80) : text; }
    private String uuid() { return UUID.randomUUID().toString(); }
    private String safeMessage(Exception error) { return error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage(); }
    private String hash(String value) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder result = new StringBuilder();
        for (byte item : digest) result.append(String.format(Locale.US, "%02x", item & 0xff));
        return result.toString();
    }
    private String now() {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date());
    }

    private static final class StoreDb extends SQLiteOpenHelper {
        StoreDb(Context context) { super(context, "kf-unified-local.db", null, 1); }
        @Override public void onCreate(SQLiteDatabase db) { db.execSQL("CREATE TABLE store (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL)"); }
        @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {}

        JSONObject read() throws JSONException {
            SQLiteDatabase db = getReadableDatabase();
            try (Cursor cursor = db.rawQuery("SELECT json FROM store WHERE id=1", null)) {
                if (cursor.moveToFirst()) return normalize(new JSONObject(cursor.getString(0)));
            }
            return normalize(new JSONObject());
        }

        void write(JSONObject store) {
            ContentValues values = new ContentValues();
            values.put("id", 1);
            values.put("json", store.toString());
            getWritableDatabase().insertWithOnConflict("store", null, values, SQLiteDatabase.CONFLICT_REPLACE);
        }

        private JSONObject normalize(JSONObject store) throws JSONException {
            if (!store.has("currentUserId")) store.put("currentUserId", "");
            if (store.optJSONObject("users") == null) store.put("users", new JSONObject());
            if (store.optJSONObject("settings") == null) store.put("settings", new JSONObject());
            if (store.optJSONObject("campaigns") == null) store.put("campaigns", new JSONObject());
            if (store.optJSONObject("sheets") == null) store.put("sheets", new JSONObject());
            return store;
        }
    }
}
