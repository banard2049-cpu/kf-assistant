"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const app = path.resolve(__dirname, "..");
const java = path.join(app, "tools/packaging/android/app/src/main/java/com/kingdomsforlorn/unified/local");
const production = path.join(java, "LocalSecondScreenServer.java");
const allowed = fs.readFileSync(production, "utf8").match(/DISPLAY_FILES = .*?\(([\s\S]*?)\)\);/)[1];
const activity = fs.readFileSync(path.join(java, "MainActivity.java"), "utf8");
assert.doesNotMatch(activity, /secondScreenServer\.start\(/, "sharing must start with the explicit share action");
const html = fs.readFileSync(path.join(app, "public/modules/display/index.html"), "utf8");
for (const [, reference] of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
  const file = new URL(reference, "https://kf.local/modules/display/").pathname.slice(1);
  assert.ok(allowed.includes('"' + file + '"'), "LAN display needs " + file);
}

// Exercise the real HTTP server code on the JVM with small Android shims.
const sources = {
  "android/content/Context.java": 'package android.content; public class Context {\n'
    + '  public static final String CONNECTIVITY_SERVICE = "connectivity";\n'
    + '  public Context getApplicationContext() { return this; }\n'
    + '  public Object getSystemService(String key) { return new android.net.ConnectivityManager(); }\n'
    + '  public Assets getAssets() { return new Assets(); }\n'
    + '  public static class Assets { public java.io.InputStream open(String path) throws java.io.IOException {\n'
    + '    return new java.io.ByteArrayInputStream(path.getBytes(java.nio.charset.StandardCharsets.UTF_8));\n'
    + '  } }\n}',
  "android/net/ConnectivityManager.java": 'package android.net; public class ConnectivityManager {\n'
    + '  public Network getActiveNetwork() { return new Network(); }\n'
    + '  public Network[] getAllNetworks() { return new Network[0]; }\n'
    + '  public NetworkCapabilities getNetworkCapabilities(Network network) { return null; }\n'
    + '  public LinkProperties getLinkProperties(Network network) { return new LinkProperties(); }\n}',
  "android/net/Network.java": "package android.net; public class Network {}",
  "android/net/NetworkCapabilities.java": 'package android.net; public class NetworkCapabilities {\n'
    + '  public static final int TRANSPORT_WIFI = 1, TRANSPORT_ETHERNET = 2;\n'
    + '  public boolean hasTransport(int value) { return true; }\n}',
  "android/net/LinkProperties.java": 'package android.net; public class LinkProperties {\n'
    + '  public java.util.List<LinkAddress> getLinkAddresses() { return java.util.Collections.singletonList(new LinkAddress()); }\n}',
  "android/net/LinkAddress.java": 'package android.net; public class LinkAddress {\n'
    + '  public java.net.InetAddress getAddress() { try { return java.net.InetAddress.getByName("192.168.1.7"); }\n'
    + '    catch (java.io.IOException error) { throw new AssertionError(error); } }\n}',
  "android/webkit/MimeTypeMap.java": 'package android.webkit; public class MimeTypeMap {\n'
    + '  public static MimeTypeMap getSingleton() { return new MimeTypeMap(); }\n'
    + '  public static String getFileExtensionFromUrl(String path) { return "png"; }\n'
    + '  public String getMimeTypeFromExtension(String extension) { return "image/png"; }\n}',
  "org/json/JSONException.java": "package org.json; public class JSONException extends Exception {}",
  "org/json/JSONObject.java": 'package org.json; public class JSONObject {\n'
    + '  private final String value;\n'
    + '  public JSONObject(String value) { this.value = value; }\n'
    + '  @Override public String toString() { return value; }\n}',
  "com/kingdomsforlorn/unified/local/ResourceStore.java": 'package com.kingdomsforlorn.unified.local;\n'
    + 'class ResourceStore { java.io.InputStream open(String path) { return null; } }',
  "com/kingdomsforlorn/unified/local/LocalApi.java": 'package com.kingdomsforlorn.unified.local;\n'
    + 'class LocalApi {\n'
    + '  long generation = 4;\n'
    + '  long authorizeSecondScreen(String id) throws org.json.JSONException {\n'
    + '    return "map".equals(id) || "encounter".equals(id) ? generation : -1;\n'
    + '  }\n'
    + '  org.json.JSONObject readSecondScreen(String id, long expected) throws org.json.JSONException {\n'
    + '    return expected == generation ? new org.json.JSONObject("{\\"campaign\\":\\"" + id + "\\"}") : null;\n'
    + '  }\n}',
  "com/kingdomsforlorn/unified/local/SecondScreenTest.java": 'package com.kingdomsforlorn.unified.local;\n'
    + 'import java.net.HttpURLConnection;\n'
    + 'import java.net.URI;\n'
    + 'import java.net.URL;\n'
    + 'import java.nio.charset.StandardCharsets;\n'
    + 'public class SecondScreenTest {\n'
    + '  static void check(boolean result, String message) { if (!result) throw new AssertionError(message); }\n'
    + '  static String token(URI url) { return url.getQuery().split("=", 2)[1]; }\n'
    + '  static String state(String token) { return "/api.php?route=display-state&campaignId=" + token; }\n'
    + '  static String fetch(URI share, String path, String method, int status) throws Exception {\n'
    + '    HttpURLConnection connection = (HttpURLConnection) new URL("http://127.0.0.1:" + share.getPort() + path).openConnection();\n'
    + '    try {\n'
    + '      connection.setRequestMethod(method);\n'
    + '      connection.setConnectTimeout(2500); connection.setReadTimeout(2500);\n'
    + '      check(connection.getResponseCode() == status, "Unexpected status: " + path);\n'
    + '      if (status != 200) return "";\n'
    + '      check("no-referrer".equals(connection.getHeaderField("Referrer-Policy")), "Remove capability from referrers");\n'
    + '      return new String(connection.getInputStream().readAllBytes(), StandardCharsets.UTF_8);\n'
    + '    } finally { connection.disconnect(); }\n'
    + '  }\n'
    + '  public static void main(String[] args) throws Exception {\n'
    + '    LocalApi api = new LocalApi();\n'
    + '    LocalSecondScreenServer server = new LocalSecondScreenServer(new android.content.Context(), new ResourceStore(), api);\n'
    + '    try {\n'
    + '      check(server.displayUrl("unavailable").isEmpty(), "Do not issue a link for an unowned campaign");\n'
    + '      URI first = URI.create(server.displayUrl("map"));\n'
    + '      check(first.equals(URI.create(server.displayUrl("map"))), "Opening and copying reuse the same active link");\n'
    + '      check(token(first).matches("[0-9a-f-]{36}"), "Use an unpredictable capability");\n'
    + '      check(fetch(first, state(token(first)), "GET", 200).contains("map"), "Read the selected campaign");\n'
    + '      check(fetch(first, state(token(first)), "HEAD", 200).isEmpty(), "HEAD is read-only and has no body");\n'
    + '      fetch(first, state(""), "GET", 404);\n'
    + '      fetch(first, state("map"), "GET", 404);\n'
    + '      fetch(first, state(token(first)) + "&campaignId=encounter", "GET", 404);\n'
    + '      fetch(first, "/api.php?route=campaign-export&campaignId=" + token(first), "GET", 404);\n'
    + '      fetch(first, state(token(first)), "POST", 405);\n'
    + '      fetch(first, first.getRawPath(), "GET", 200);\n'
    + '      fetch(first, "/assets/board.png", "GET", 200);\n'
    + '      fetch(first, "/assets/private.db", "GET", 404);\n'
    + '      fetch(first, "/modules/map/app.js", "GET", 404);\n'
    + '      URI second = URI.create(server.displayUrl("encounter"));\n'
    + '      check(!token(first).equals(token(second)), "Switching shared campaign replaces the capability");\n'
    + '      fetch(second, state(token(first)), "GET", 404);\n'
    + '      check(fetch(second, state(token(second)), "GET", 200).contains("encounter"), "Read the newly shared campaign");\n'
    + '      api.generation++;\n'
    + '      fetch(second, state(token(second)), "GET", 404);\n'
    + '      server.stop();\n'
    + '      URI restarted = URI.create(server.displayUrl("encounter"));\n'
    + '      fetch(restarted, state(token(second)), "GET", 404);\n'
    + '      fetch(restarted, state(token(restarted)), "GET", 200);\n'
    + '    } finally { server.stop(); }\n'
    + '    System.out.println("Android LAN sharing: explicit scope, read-only routes, assets and revocation verified");\n'
    + '  }\n}',
};

const extension = process.platform === "win32" ? ".exe" : "";
const javaHomes = [process.env.JAVA_HOME, "D:/android-toolchain/jdk-21", "D:/files/scribe/tools/jdk-17.0.20.1+1"].filter(Boolean);
const javaTool = name => javaHomes.map(home => path.join(home, "bin", name + extension)).find(file => fs.existsSync(file)) || name;
const tempRoot = fs.realpathSync(os.tmpdir());
const scratch = fs.mkdtempSync(path.join(tempRoot, "kf-android-lan-"));
try {
  const files = Object.entries(sources).map(([relative, source]) => {
    const file = path.join(scratch, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, source);
    return file;
  });
  execFileSync(javaTool("javac"), ["-encoding", "UTF-8", "-d", scratch, production, ...files], { stdio: "pipe" });
  process.stdout.write(execFileSync(javaTool("java"), ["-cp", scratch, "com.kingdomsforlorn.unified.local.SecondScreenTest"], {
    encoding: "utf8", timeout: 15000,
  }));
} finally {
  const resolved = fs.realpathSync(scratch);
  if (path.dirname(resolved) === tempRoot && path.basename(resolved).startsWith("kf-android-lan-")) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
