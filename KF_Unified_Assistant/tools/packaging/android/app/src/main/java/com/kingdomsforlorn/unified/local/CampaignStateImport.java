package com.kingdomsforlorn.unified.local;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Iterator;
import java.util.Map;

/** Keep imported module saves attached to their new campaign and knight sheets. */
final class CampaignStateImport {
    private CampaignStateImport() {}

    static void rebindRogueCampaign(JSONObject state, String campaignId) throws JSONException {
        JSONObject modules = state.optJSONObject("modules");
        JSONObject rogue = modules == null ? null : modules.optJSONObject("roguePath");
        if (rogue != null && rogue.optJSONArray("slots") != null) rogue.put("campaignId", campaignId);
    }

    static void remapSheetReferences(Object value, Map<String, String> sheetMap) throws JSONException {
        if (value instanceof JSONObject) {
            JSONObject object = (JSONObject) value;
            for (Iterator<String> keys = object.keys(); keys.hasNext();) {
                String key = keys.next();
                Object item = object.opt(key);
                if (item instanceof String && ("sheetId".equals(key) || "leaderSheetId".equals(key))) {
                    String replacement = sheetMap.get(item);
                    if (replacement != null) object.put(key, replacement);
                } else if ("party".equals(key) && item instanceof JSONArray) {
                    JSONArray party = (JSONArray) item;
                    for (int index = 0; index < party.length(); index++) {
                        Object member = party.opt(index);
                        if (!(member instanceof String)) continue;
                        String replacement = sheetMap.get(member);
                        if (replacement != null) party.put(index, replacement);
                    }
                } else {
                    remapSheetReferences(item, sheetMap);
                }
            }
        } else if (value instanceof JSONArray) {
            JSONArray array = (JSONArray) value;
            for (int index = 0; index < array.length(); index++) remapSheetReferences(array.opt(index), sheetMap);
        }
    }
}
