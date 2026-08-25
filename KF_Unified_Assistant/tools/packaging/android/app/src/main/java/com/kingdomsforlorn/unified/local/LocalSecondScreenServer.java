package com.kingdomsforlorn.unified.local;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.webkit.MimeTypeMap;

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
import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Small LAN-only HTTP server for the read-only second screen. */
final class LocalSecondScreenServer {
    private final Context context;
    private final ResourceStore resources;
    private final LocalApi localApi;
    private volatile ServerSocket serverSocket;
    private volatile ExecutorService executor;
    /** Short, process-local aliases keep the LAN address easy to type without exposing a UUID. */
    private final Map<String, String> displayAliases = new HashMap<>();
    private final Map<String, String> campaignAliases = new HashMap<>();
    private int nextDisplayAlias = 1;

    LocalSecondScreenServer(Context context, ResourceStore resources, LocalApi localApi) {
        this.context = context.getApplicationContext();
        this.resources = resources;
        this.localApi = localApi;
    }

    synchronized void start() throws IOException {
        if (serverSocket != null && !serverSocket.isClosed()) return;
        ServerSocket socket = new ServerSocket();
        socket.setReuseAddress(true);
        socket.bind(new InetSocketAddress("0.0.0.0", 0));
        serverSocket = socket;
        executor = Executors.newCachedThreadPool();
        executor.execute(this::acceptLoop);
    }

    synchronized void stop() {
        if (serverSocket != null) try { serverSocket.close(); } catch (IOException ignored) {}
        serverSocket = null;
        if (executor != null) executor.shutdownNow();
        executor = null;
    }

    String displayUrl(String campaignId) {
        ServerSocket socket = serverSocket;
        if (socket == null || socket.isClosed()) return "";
        int port = socket.getLocalPort();
        String alias = aliasFor(campaignId);
        for (String address : lanAddresses()) return "http://" + address + ":" + port + "/modules/display/?c=" + alias;
        return "";
    }

    private synchronized String aliasFor(String campaignId) {
        String value = campaignId == null ? "" : campaignId;
        if (value.isEmpty()) return "";
        String existing = campaignAliases.get(value);
        if (existing != null) return existing;
        String alias;
        do { alias = Integer.toString(nextDisplayAlias++, 36); } while (displayAliases.containsKey(alias));
        displayAliases.put(alias, value);
        campaignAliases.put(value, alias);
        return alias;
    }

    private void acceptLoop() {
        while (true) {
            try {
                Socket socket = serverSocket.accept();
                ExecutorService pool = executor;
                if (pool != null) pool.execute(() -> handle(socket)); else socket.close();
            } catch (IOException error) {
                if (serverSocket == null || serverSocket.isClosed()) return;
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
            if ("/api.php".equals(uri.getPath())) serveApi(connection.getOutputStream(), request[1], head);
            else serveStatic(connection.getOutputStream(), uri.getRawPath(), head);
        } catch (IOException ignored) {}
    }

    private void serveApi(OutputStream output, String target, boolean head) throws IOException {
        String result = localApi.request("GET", "http://127.0.0.1" + resolveDisplayAlias(target), "");
        try {
            JSONObject envelope = new JSONObject(result);
            JSONObject body = envelope.optJSONObject("body");
            sendText(output, envelope.optInt("status", 500), "application/json; charset=utf-8", body == null ? "{}" : body.toString(), head);
        } catch (Exception error) {
            sendText(output, 500, "application/json; charset=utf-8", "{\"error\":\"本地接口失败\"}", head);
        }
    }

    private String resolveDisplayAlias(String target) {
        try {
            URI uri = URI.create(target);
            String query = uri.getRawQuery();
            if (query == null || query.isEmpty()) return target;
            StringBuilder rebuilt = new StringBuilder();
            for (String part : query.split("&", -1)) {
                if (rebuilt.length() > 0) rebuilt.append('&');
                int split = part.indexOf('=');
                String key = split < 0 ? part : part.substring(0, split);
                String value = split < 0 ? "" : part.substring(split + 1);
                if ("c".equals(key) || "campaignId".equals(key)) {
                    String campaignId;
                    synchronized (this) { campaignId = displayAliases.get(value); }
                    if (campaignId != null) { key = "campaignId"; value = UriCompat.encode(campaignId); }
                }
                rebuilt.append(key);
                if (split >= 0 || "campaignId".equals(key)) rebuilt.append('=').append(value);
            }
            return uri.getPath() + "?" + rebuilt;
        } catch (IllegalArgumentException ignored) { return target; }
    }

    private void serveStatic(OutputStream output, String rawPath, boolean head) throws IOException {
        String path;
        try { path = URLDecoder.decode(rawPath == null ? "/" : rawPath, "UTF-8"); }
        catch (IllegalArgumentException error) { sendText(output, 400, "text/plain; charset=utf-8", "Bad Request", head); return; }
        if ("/".equals(path)) path = "/modules/display/";
        if (path.endsWith("/")) path += "index.html";
        String relative = path.startsWith("/") ? path.substring(1) : path;
        if (!safeRelative(relative)) { sendText(output, 400, "text/plain; charset=utf-8", "Bad Request", head); return; }
        InputStream input = resources.open(relative);
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
        for (String part : path.split("/", -1)) if (part.isEmpty() || ".".equals(part) || "..".equals(part)) return false;
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
        String headers = "HTTP/1.1 " + status + " " + reason + "\r\nContent-Type: " + type + "\r\nCache-Control: no-store\r\nConnection: close\r\n" + (length >= 0 ? "Content-Length: " + length + "\r\n" : "") + "\r\n";
        output.write(headers.getBytes(StandardCharsets.US_ASCII));
    }

    private static void copy(InputStream input, OutputStream output) throws IOException { byte[] buffer = new byte[65536]; for (int read; (read = input.read(buffer)) != -1;) output.write(buffer, 0, read); }

    private static final class UriCompat {
        static String encode(String value) { return value == null ? "" : value.replace("%", "%25").replace(" ", "%20"); }
    }
}
