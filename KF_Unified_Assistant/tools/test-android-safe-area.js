"use strict";

// Compile and execute the production Java wrapper against a small Android API
// surface. This exercises API guards, inset dispatch and viewport ownership;
// device rendering remains an Android instrumentation/manual check.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const androidRoot = path.join(root, "tools/packaging/android/app/src/main");
const production = path.join(androidRoot, "java/com/kingdomsforlorn/unified/local/WebViewSafeArea.java");
const activity = fs.readFileSync(path.join(androidRoot, "java/com/kingdomsforlorn/unified/local/MainActivity.java"), "utf8");
const manifest = fs.readFileSync(path.join(androidRoot, "AndroidManifest.xml"), "utf8");
assert.match(activity, /WebViewSafeArea\.wrap\(this,\s*webView\)/, "Activity must put the WebView inside the safe viewport");
assert.match(activity, /setContentView\(content\);\s*content\.requestApplyInsets\(\);/, "request insets after attaching the container");
assert.doesNotMatch(activity, /setContentView\(webView\)/, "a bare WebView leaves fixed HTML headers under system bars");
assert.match(manifest, /android:windowSoftInputMode="adjustResize"/, "keyboard resizing remains explicit on legacy Android");

const extension = process.platform === "win32" ? ".exe" : "";
const javaHomes = [process.env.JAVA_HOME, "D:/android-toolchain/jdk-21", "D:/files/scribe/tools/jdk-17.0.20.1+1"].filter(Boolean);
function javaTool(name) {
  for (const home of javaHomes) {
    const file = path.join(home, "bin", name + extension);
    if (fs.existsSync(file)) return file;
  }
  return name;
}

const sources = {
  "android/graphics/Insets.java": `package android.graphics;
public final class Insets {
  public final int left, top, right, bottom;
  private Insets(int l, int t, int r, int b) { left=l; top=t; right=r; bottom=b; }
  public static Insets of(int l, int t, int r, int b) { return new Insets(l,t,r,b); }
}`,
  "android/os/Build.java": `package android.os;
public final class Build {
  public static final class VERSION { public static int SDK_INT; }
  public static final class VERSION_CODES { public static final int R = 30; }
}`,
  "android/view/Window.java": `package android.view;
import android.os.Build;
public final class Window {
  public boolean decorFits = true;
  public int calls;
  public void setDecorFitsSystemWindows(boolean value) {
    if (Build.VERSION.SDK_INT < 30) throw new AssertionError("new Window API used on old Android");
    decorFits = value; calls++;
  }
}`,
  "android/app/Activity.java": `package android.app;
import android.view.Window;
public class Activity {
  private final Window window = new Window();
  public Window getWindow() { return window; }
}`,
  "android/view/View.java": `package android.view;
public class View {
  public interface OnApplyWindowInsetsListener { WindowInsets onApplyWindowInsets(View view, WindowInsets insets); }
  public OnApplyWindowInsetsListener listener;
  public int left, top, right, bottom, paddingCalls;
  public boolean fitsSystemWindows;
  public void setOnApplyWindowInsetsListener(OnApplyWindowInsetsListener value) { listener=value; }
  public void setPadding(int l, int t, int r, int b) { left=l; top=t; right=r; bottom=b; paddingCalls++; }
  public void setFitsSystemWindows(boolean value) { fitsSystemWindows=value; }
  public WindowInsets dispatch(WindowInsets value) { return listener == null ? value : listener.onApplyWindowInsets(this, value); }
}`,
  "android/widget/FrameLayout.java": `package android.widget;
import android.app.Activity;
import android.view.View;
public final class FrameLayout extends View {
  public int background;
  public View child;
  public LayoutParams params;
  public FrameLayout(Activity activity) {}
  public void setBackgroundColor(int color) { background=color; }
  public void addView(View view, LayoutParams layout) { child=view; params=layout; }
  public static final class LayoutParams {
    public static final int MATCH_PARENT = -1;
    public final int width, height;
    public LayoutParams(int w, int h) { width=w; height=h; }
  }
}`,
  "android/view/WindowInsets.java": `package android.view;
import android.graphics.Insets;
import android.os.Build;
public final class WindowInsets {
  public static final WindowInsets CONSUMED = new WindowInsets();
  private final Insets[] values;
  public int requestedMask, calls;
  public WindowInsets(Insets... source) { values=source; }
  public Insets getInsets(int mask) {
    if (Build.VERSION.SDK_INT < 30) throw new AssertionError("new Insets API used on old Android");
    requestedMask=mask; calls++;
    int l=0,t=0,r=0,b=0;
    for (int i=0; i<values.length; i++) if ((mask & (1 << i)) != 0) {
      Insets v=values[i]; l=Math.max(l,v.left); t=Math.max(t,v.top);
      r=Math.max(r,v.right); b=Math.max(b,v.bottom);
    }
    return Insets.of(l,t,r,b);
  }
  public static final class Type {
    public static int systemBars() { return 1; }
    public static int displayCutout() { return 2; }
    public static int ime() { return 4; }
  }
}`,
  "com/kingdomsforlorn/unified/local/SafeAreaTest.java": `package com.kingdomsforlorn.unified.local;
import android.app.Activity;
import android.graphics.Insets;
import android.os.Build;
import android.view.View;
import android.view.WindowInsets;
import android.widget.FrameLayout;
public final class SafeAreaTest {
  private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
  private static void padding(View v, int l, int t, int r, int b, String scenario) {
    check(v.left==l && v.top==t && v.right==r && v.bottom==b, scenario + " unexpected safe viewport padding");
  }
  private static WindowInsets insets(int[] bars, int[] cutout, int[] ime) {
    return new WindowInsets(Insets.of(bars[0],bars[1],bars[2],bars[3]),
      Insets.of(cutout[0],cutout[1],cutout[2],cutout[3]), Insets.of(ime[0],ime[1],ime[2],ime[3]));
  }
  public static void main(String[] args) {
    for (int sdk : new int[]{24,29,30,35,36}) {
      Build.VERSION.SDK_INT=sdk;
      Activity activity=new Activity(); View webView=new View();
      FrameLayout container=WebViewSafeArea.wrap(activity,webView);
      check(container.child==webView, "content must be owned by padded parent");
      check(container.params.width==-1 && container.params.height==-1, "WebView must fill the safe viewport");
      check(container.background==0xff101211, "system bar area must have the app's dark background");
      check(webView.listener==null && webView.paddingCalls==0, "WebView must not receive a fake CSS-safe padding");
      if (sdk<30) {
        check(activity.getWindow().calls==0 && activity.getWindow().decorFits, "legacy decor fitting must remain enabled");
        check(container.fitsSystemWindows && container.listener==null, "legacy Android must use framework fitting");
        continue;
      }
      check(activity.getWindow().calls==1 && !activity.getWindow().decorFits, "explicit edge-to-edge must pair with owned insets");
      check(!container.fitsSystemWindows && container.listener!=null, "one inset owner avoids duplicate padding");
      WindowInsets portrait=insets(new int[]{0,24,0,48},new int[]{0,40,0,0},new int[]{0,0,0,0});
      check(container.dispatch(portrait)==WindowInsets.CONSUMED, "WebView descendants must not inset the viewport twice");
      padding(container,0,40,0,48,"portrait status bar and taller cutout");
      check(portrait.requestedMask==7 && portrait.calls==1, "query all obstruction types in one union");
      container.dispatch(portrait);
      padding(container,0,40,0,48,"repeated dispatch must not accumulate");
      WindowInsets landscape=insets(new int[]{0,20,48,0},new int[]{60,0,0,0},new int[]{0,0,0,0});
      container.dispatch(landscape);
      padding(container,60,20,48,0,"landscape cutout and side three-button navigation");
      WindowInsets keyboard=insets(new int[]{0,24,0,24},new int[]{0,0,0,0},new int[]{0,0,0,300});
      container.dispatch(keyboard);
      padding(container,0,24,0,300,"IME must use max height, not add navigation height");
      container.dispatch(insets(new int[]{0,24,0,24},new int[]{0,0,0,0},new int[]{0,0,0,0}));
      padding(container,0,24,0,24,"keyboard dismissal restores gesture navigation inset");
      container.dispatch(insets(new int[]{0,0,0,0},new int[]{0,0,0,0},new int[]{0,0,0,0}));
      padding(container,0,0,0,0,"hidden bars and no cutout leave the full viewport");
      padding(webView,0,0,0,0,"fixed HTML uses the resized parent viewport");
    }
    System.out.println("Android safe area passed: API 24/29 legacy fitting and API 30/35/36 system bars, cutouts, IME, repeat dispatch and inset consumption.");
  }
}`
};

const tempParent = fs.realpathSync(os.tmpdir());
const temp = fs.mkdtempSync(path.join(tempParent, "kf-android-safe-area-"));
try {
  const files = [];
  for (const [relative, source] of Object.entries(sources)) {
    const file = path.join(temp, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, source);
    files.push(file);
  }
  const classes = path.join(temp, "classes");
  fs.mkdirSync(classes);
  execFileSync(javaTool("javac"), ["-encoding", "UTF-8", "-d", classes, production, ...files], { stdio: "pipe" });
  process.stdout.write(execFileSync(javaTool("java"), ["-cp", classes, "com.kingdomsforlorn/unified/local/SafeAreaTest".replaceAll("/", ".")], { encoding: "utf8" }));
} finally {
  const resolved = fs.realpathSync(temp);
  assert.equal(path.dirname(resolved), tempParent, "cleanup must stay in the temporary directory");
  assert.ok(path.basename(resolved).startsWith("kf-android-safe-area-"), "cleanup must only remove this test's fixture");
  fs.rmSync(resolved, { recursive: true, force: true });
}
