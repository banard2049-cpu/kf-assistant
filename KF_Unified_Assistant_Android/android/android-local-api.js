(function () {
  "use strict";
  if (!window.KFAndroid) return;

  try {
    Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => true });
  } catch (_) {}

  const nativeFetch = window.fetch.bind(window);
  const nativeCreateObjectURL = URL.createObjectURL.bind(URL);
  const nativeRevokeObjectURL = URL.revokeObjectURL.bind(URL);
  const nativeAnchorClick = HTMLAnchorElement.prototype.click;
  const androidBlobUrls = new Map();

  URL.createObjectURL = function (value) {
    const url = nativeCreateObjectURL(value);
    if (value instanceof Blob && /json|text/i.test(value.type || "")) androidBlobUrls.set(url, value);
    return url;
  };

  URL.revokeObjectURL = function (url) {
    window.setTimeout(() => androidBlobUrls.delete(url), 30000);
    return nativeRevokeObjectURL(url);
  };

  HTMLAnchorElement.prototype.click = function () {
    const downloadName = this.getAttribute("download");
    const blob = downloadName && androidBlobUrls.get(this.href || "");
    if (blob && window.KFAndroidFiles?.saveTextFile) {
      const reader = new FileReader();
      reader.onload = () => window.KFAndroidFiles.saveTextFile(downloadName, String(reader.result || ""), blob.type || "application/json");
      reader.onerror = () => nativeAnchorClick.call(this);
      reader.readAsText(blob);
      return;
    }
    return nativeAnchorClick.call(this);
  };

  window.fetch = function (input, options) {
    const source = typeof input === "string" ? input : input.url;
    const url = new URL(source, window.location.href);
    if (url.host !== "kf.local" || (url.pathname !== "/api.php" && !url.pathname.startsWith("/api/"))) {
      return nativeFetch(input, options);
    }
    const method = String(options?.method || "GET").toUpperCase();
    const body = String(options?.body || "");
    try {
      const result = JSON.parse(window.KFAndroid.request(method, url.href, body));
      return Promise.resolve(new Response(JSON.stringify(result.body), {
        status: Number(result.status) || 500,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      }));
    } catch (error) {
      return Promise.reject(error);
    }
  };

  document.documentElement.classList.add("kf-android-local");
})();
