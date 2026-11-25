package com.kingdomsforlorn.unified.local;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.webkit.MimeTypeMap;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;

/** Small LAN-only HTTP server for the read-only second screen. */
final class LocalSecondScreenServer {
    private static final String DISPLAY_QUERY_PREFIX = "route=display-state&campaignId=";
    private static final Set<String> DISPLAY_FILES = new HashSet<>(Arrays.asList(
            "modules/display/index.html", "modules/display/styles.css", "modules/display/app.js",
            "modules/display/data/conflict-board-data.js", "modules/display/data/belly-board-data.js",
            "modules/map/map-view.css", "modules/encounter/encounter-view.css", "modules/boss-token-frame.css",
            "modules/module-bridge.css", "modules/module-topbar.js", "monster-labels.js", "knight-portrait-colors.js",
            "modules/map/data/map-data.js", "modules/map/data/map-layout.js", "modules/map/map-view.js",
            "modules/map/fog-complex.webp", "modules/rogue/withergraal-data.js", "modules/rogue/data.js",
            "modules/encounter/data/encounter-data.js", "modules/encounter/encounter-brush-paths.js",
            "modules/encounter/encounter-monster-ink.js", "modules/encounter/encounter-view.js",
            "modules/aibp/data/monster-data.js", "modules/aibp/data/localized-traits.js",
            "modules/aibp/data/localized-sheets.js", "modules/aibp/data/level-config.js",
            "modules/aibp/data/postgame-config.js", "modules/aibp/data/terrain-keywords.js",
            "modules/aibp/kf-los.js", "modules/aibp/kf-facing.js", "modules/aibp/kf-overlay.js",
            "android-local-api.js"));
    private static final Set<String> ART_EXTENSIONS = new HashSet<>(Arrays.asList(
            "png", "jpg", "jpeg", "jfif", "gif", "webp", "avif", "bmp", "ico", "svg", "tif", "tiff", "heic", "heif"));

    private static final class Share {
        final String campaignId;
        final long generation;
        final String token = UUID.randomUUID().toString();

        Share(String campaignId, long generation) {
            this.campaignId = campaignId;
            this.generation = generation;
        }
    }

    private final Context context;
    private final ResourceStore resources;
    private final LocalApi localApi;
    private ServerSocket serverSocket;
    private ExecutorService executor;
    private volatile Share share;

    LocalSecondScreenServer(Context context, ResourceStore resources, LocalApi localApi) {
        this.context = context.getApplicationContext();
        this.resources = resources;
        this.localApi = localApi;
    }

    private void start() throws IOException {
        if (serverSocket != null && !serverSocket.isClosed()) return;
        ServerSocket socket = new ServerSocket();
        try {
            socket.setReuseAddress(true);
            socket.bind(new InetSocketAddress("0.0.0.0", 0));
        } catch (IOException error) {
            socket.close();
            throw error;
        }
        ExecutorService pool = Executors.newCachedThreadPool();
        serverSocket = socket;
        executor = pool;
        pool.execute(() -> acceptLoop(socket, pool));
    }

    synchronized void stop() {
        share = null;
        if (serverSocket != null) try { serverSocket.close(); } catch (IOException ignored) {}
        serverSocket = null;
        if (executor != null) executor.shutdownNow();
        executor = null;
    }

    synchronized String displayUrl(String campaignId) {
        Set<String> addresses = lanAddresses();
        if (addresses.isEmpty()) return "";
        try {
            long generation = localApi.authorizeSecondScreen(campaignId);
            if (generation < 0) return "";
            start();
            Share current = share;
            if (current == null || current.generation != generation || !current.campaignId.equals(campaignId)) {
                current = new Share(campaignId, generation);
                share = current;
            }
            return "http://" + addresses.iterator().next() + ":" + serverSocket.getLocalPort()
                    + "/modules/display/?c=" + current.token;
        } catch (IOException | JSONException error) {
            return "";
        }
    }

    private void acceptLoop(ServerSocket listener, ExecutorService pool) {
        while (!listener.isClosed()) {
            try {
                Socket connection = listener.accept();
                try { pool.execute(() -> handle(connection)); }
                catch (RejectedExecutionException stopped) { connection.close(); }
            } catch (IOException error) {
                if (listener.isClosed()) return;
            }
        }
    }

    private void handle(Socket socket) {
        try (Socket connection = socket) {
            connection.setSoTimeout(10000);
            BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.US_ASCII));
            String requestLine = reader.readLine();
            if (requestLine == null) return;
            String[] request = requestLine.split(" ", 3);
            if (request.length < 2 || !("GET".equals(request[0]) || "HEAD".equals(request[0]))) {
                sendText(connection.getOutputStream(), 405, "text/plain; charset=utf-8", "Method Not Allowed", false); return;
            }
            for (String header; (header = reader.readLine()) != null && !header.isEmpty();) {}
            URI uri;
            try { uri = URI.create(request[1]); } catch (IllegalArgumentException error) {
                sendText(connection.getOutputStream(), 400, "text/plain; charset=utf-8", "Bad Request", false); return;
            }
            boolean head = "HEAD".equals(request[0]);
            if ("/api.php".equals(uri.getRawPath())) serveDisplayState(connection.getOutputStream(), uri.getRawQuery(), head);
            else serveStatic(connection.getOutputStream(), uri.getRawPath(), head);
        } catch (IOException ignored) {}
    }

    private void serveDisplayState(OutputStream output, String query, boolean head) throws IOException {
        Share current = share;
        if (current == null || !(DISPLAY_QUERY_PREFIX + current.token).equals(query)) {
            sendText(output, 404, "application/json; charset=utf-8", "{}", head);
            return;
        }
        try {
            JSONObject state = localApi.readSecondScreen(current.campaignId, current.generation);
            if (state == null || share != current) sendText(output, 404, "application/json; charset=utf-8", "{}", head);
            else sendText(output, 200, "application/json; charset=utf-8", state.toString(), head);
        } catch (JSONException error) {
            sendText(output, 500, "application/json; charset=utf-8", "{\"error\":\"本地接口失败\"}", head);
        }
    }

    private void serveStatic(OutputStream output, String rawPath, boolean head) throws IOException {
        String path;
        try { path = URLDecoder.decode(rawPath == null ? "/" : rawPath, "UTF-8"); }
        catch (IllegalArgumentException error) { sendText(output, 400, "text/plain; charset=utf-8", "Bad Request", head); return; }
        if ("/modules/display/".equals(path)) path += "index.html";
        String relative = path.startsWith("/") ? path.substring(1) : path;
        if (!safeRelative(relative)) { sendText(output, 400, "text/plain; charset=utf-8", "Bad Request", head); return; }
        int dot = relative.lastIndexOf('.');
        boolean isArt = relative.startsWith("assets/") && dot >= 0
                && ART_EXTENSIONS.contains(relative.substring(dot + 1).toLowerCase(Locale.ROOT));
        if (!isArt && !DISPLAY_FILES.contains(relative)) {
            sendText(output, 404, "text/plain; charset=utf-8", "Not Found", head);
            return;
        }
        InputStream input = isArt ? resources.open(relative) : null;
        if (input == null) {
            try { input = context.getAssets().open("web/" + relative); }
            catch (IOException missing) { sendText(output, 404, "text/plain; charset=utf-8", "Not Found", head); return; }
        }
        try (InputStream resource = input) {
            writeHeaders(output, 200, mimeType(relative), -1);
            if (!head) copy(resource, output);
        }
    }

    private static boolean safeRelative(String path) {
        if (path.isEmpty() || path.indexOf('\\') >= 0 || path.indexOf('\0') >= 0) return false;
        for (String part : path.split("/", -1)) if (part.isEmpty() || part.startsWith(".")) return false;
        return true;
    }

    private static String mimeType(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".js")) return "application/javascript; charset=utf-8";
        if (lower.endsWith(".json")) return "application/json; charset=utf-8";
        if (lower.endsWith(".css")) return "text/css; charset=utf-8";
        if (lower.endsWith(".html")) return "text/html; charset=utf-8";
        String extension = MimeTypeMap.getFileExtensionFromUrl(path);
        String detected = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension.toLowerCase(Locale.ROOT));
        return detected == null ? "application/octet-stream" : detected;
    }

    private Set<String> lanAddresses() {
        Set<String> values = new LinkedHashSet<>();
        try {
            ConnectivityManager manager = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            Network active = manager == null ? null : manager.getActiveNetwork();
            if (manager != null) {
                if (active != null) addNetworkAddresses(manager, active, values);
                for (Network network : manager.getAllNetworks()) if (active == null || !active.equals(network)) addNetworkAddresses(manager, network, values);
            }
        } catch (Exception ignored) {}
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces != null && interfaces.hasMoreElements()) {
                NetworkInterface network = interfaces.nextElement();
                if (!network.isUp() || network.isLoopback()) continue;
                Enumeration<InetAddress> addresses = network.getInetAddresses();
                while (addresses.hasMoreElements()) addAddress(values, addresses.nextElement());
            }
        } catch (Exception ignored) {}
        return values;
    }

    private static void addNetworkAddresses(ConnectivityManager manager, Network network, Set<String> values) {
        NetworkCapabilities capabilities = manager.getNetworkCapabilities(network);
        if (capabilities != null && !capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) && !capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) return;
        LinkProperties properties = manager.getLinkProperties(network);
        if (properties != null) for (LinkAddress address : properties.getLinkAddresses()) addAddress(values, address.getAddress());
    }

    private static void addAddress(Set<String> values, InetAddress address) {
        if (address instanceof Inet4Address && address.isSiteLocalAddress() && !address.isLoopbackAddress()) values.add(address.getHostAddress());
    }

    private static void sendText(OutputStream output, int status, String type, String body, boolean head) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8); writeHeaders(output, status, type, bytes.length); if (!head) output.write(bytes);
    }

    private static void writeHeaders(OutputStream output, int status, String type, long length) throws IOException {
        String reason = status == 200 ? "OK" : status == 404 ? "Not Found" : status == 405 ? "Method Not Allowed" : "Error";
        String headers = "HTTP/1.1 " + status + " " + reason + "\r\nContent-Type: " + type
                + "\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n"
                + (length >= 0 ? "Content-Length: " + length + "\r\n" : "") + "\r\n";
        output.write(headers.getBytes(StandardCharsets.US_ASCII));
    }

    private static void copy(InputStream input, OutputStream output) throws IOException { byte[] buffer = new byte[65536]; for (int read; (read = input.read(buffer)) != -1;) output.write(buffer, 0, read); }

}
