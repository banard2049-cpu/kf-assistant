package com.kingdomsforlorn.unified.local;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public final class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 8101;
    private static final String LOCAL_HOST = "kf.local";
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(true);

        webView.addJavascriptInterface(new LocalApi(this), "KFAndroid");
        webView.addJavascriptInterface(new AndroidFiles(), "KFAndroidFiles");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!LOCAL_HOST.equals(uri.getHost())) return super.shouldInterceptRequest(view, request);
                WebResourceResponse response = openWebAsset(uri.getPath());
                return response != null ? response : super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (LOCAL_HOST.equals(uri.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception error) {
                    Toast.makeText(MainActivity.this, "无法打开外部链接", Toast.LENGTH_SHORT).show();
                }
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                Intent intent = params.createIntent();
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                } catch (Exception error) {
                    filePathCallback = null;
                    Toast.makeText(MainActivity.this, "无法打开文件选择器", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });
        webView.loadUrl("https://" + LOCAL_HOST + "/index.html");
    }

    private WebResourceResponse openWebAsset(String rawPath) {
        String path = rawPath == null ? "" : rawPath;
        if (path.startsWith("/")) path = path.substring(1);
        if (path.isEmpty() || path.endsWith("/")) path += "index.html";
        if (path.contains("..") || path.startsWith("api.php")) return null;
        try {
            InputStream input = getAssets().open("web/" + path);
            String extension = MimeTypeMap.getFileExtensionFromUrl(path);
            String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension.toLowerCase());
            if (mime == null) {
                if (path.endsWith(".js")) mime = "text/javascript";
                else if (path.endsWith(".json")) mime = "application/json";
                else if (path.endsWith(".css")) mime = "text/css";
                else mime = "application/octet-stream";
            }
            return new WebResourceResponse(mime, "UTF-8", input);
        } catch (Exception ignored) {
            return null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || filePathCallback == null) return;
        Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
        filePathCallback.onReceiveValue(result);
        filePathCallback = null;
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    private final class AndroidFiles {
        @JavascriptInterface
        public String saveTextFile(String fileName, String content, String mimeType) {
            String safeName = fileName == null ? "kf-unified-save.json" : fileName.replaceAll("[\\\\/:*?\"<>|]", "_");
            if (!safeName.toLowerCase().endsWith(".json")) safeName += ".json";
            String safeMime = mimeType == null || mimeType.trim().isEmpty() ? "application/json" : mimeType;
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
                    values.put(MediaStore.Downloads.MIME_TYPE, safeMime);
                    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) throw new IllegalStateException("无法创建下载文件");
                    try (OutputStream output = getContentResolver().openOutputStream(uri)) {
                        if (output == null) throw new IllegalStateException("无法写入下载文件");
                        output.write(String.valueOf(content).getBytes(StandardCharsets.UTF_8));
                    }
                    String message = "已导出到下载目录：" + safeName;
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show());
                    return "ok";
                }
                File dir = getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS);
                if (dir == null) dir = getFilesDir();
                if (!dir.isDirectory() && !dir.mkdirs()) throw new IllegalStateException("无法创建导出目录");
                File outputFile = new File(dir, safeName);
                try (FileOutputStream output = new FileOutputStream(outputFile)) {
                    output.write(String.valueOf(content).getBytes(StandardCharsets.UTF_8));
                }
                String message = "已导出：" + outputFile.getAbsolutePath();
                runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show());
                return "ok";
            } catch (Exception error) {
                String message = "导出失败：" + error.getMessage();
                runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show());
                return "error";
            }
        }
    }
}
