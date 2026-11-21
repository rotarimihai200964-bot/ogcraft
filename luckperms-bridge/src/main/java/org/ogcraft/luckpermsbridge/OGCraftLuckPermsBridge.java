package org.ogcraft.luckpermsbridge;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import net.luckperms.api.LuckPerms;
import net.luckperms.api.LuckPermsProvider;
import net.luckperms.api.model.user.User;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class OGCraftLuckPermsBridge extends JavaPlugin {
    private static final String COLOR_PATTERN = "^#[0-9a-fA-F]{6}$";

    private volatile List<OnlinePlayer> onlinePlayers = List.of();
    private Map<String, String> rankColors;
    private String allowedOrigin;
    private HttpServer httpServer;
    private ExecutorService httpExecutor;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        rankColors = loadRankColors();
        allowedOrigin = getConfig().getString("allowed-origin", "*");

        try {
            startHttpServer();
        } catch (IOException exception) {
            throw new IllegalStateException("Could not start the LuckPerms read-only endpoint.", exception);
        }

        getServer().getScheduler().runTaskTimer(this, this::updateOnlinePlayers, 0L, 100L);
    }

    @Override
    public void onDisable() {
        if (httpServer != null) {
            httpServer.stop(0);
        }
        if (httpExecutor != null) {
            httpExecutor.shutdownNow();
        }
    }

    private Map<String, String> loadRankColors() {
        Map<String, String> colors = new HashMap<>();
        if (getConfig().isConfigurationSection("rank-colors")) {
            for (String rank : getConfig().getConfigurationSection("rank-colors").getKeys(false)) {
                String color = getConfig().getString("rank-colors." + rank, "");
                if (color.matches(COLOR_PATTERN)) {
                    colors.put(rank.toLowerCase(Locale.ROOT), color);
                } else {
                    getLogger().warning("Ignoring invalid color for LuckPerms group '" + rank + "'.");
                }
            }
        }
        return Map.copyOf(colors);
    }

    private void startHttpServer() throws IOException {
        String bindAddress = getConfig().getString("bind-address", "127.0.0.1");
        int port = getConfig().getInt("port", 8765);
        if (port < 1 || port > 65535) {
            throw new IllegalArgumentException("The endpoint port must be between 1 and 65535.");
        }

        InetAddress address = InetAddress.getByName(bindAddress);
        httpServer = HttpServer.create(new InetSocketAddress(address, port), 0);
        httpServer.createContext("/players", this::handlePlayersRequest);
        httpExecutor = Executors.newFixedThreadPool(2);
        httpServer.setExecutor(httpExecutor);
        httpServer.start();
        getLogger().info("Read-only LuckPerms endpoint listening on " + bindAddress + ":" + port + "/players");
    }

    private void updateOnlinePlayers() {
        LuckPerms luckPerms = LuckPermsProvider.get();
        List<OnlinePlayer> snapshot = new ArrayList<>();
        for (Player player : getServer().getOnlinePlayers()) {
            User user = luckPerms.getUserManager().getUser(player.getUniqueId());
            String primaryGroup = user == null ? "default" : user.getPrimaryGroup();
            snapshot.add(new OnlinePlayer(player.getName(), primaryGroup));
        }
        onlinePlayers = List.copyOf(snapshot);
    }

    private void handlePlayersRequest(HttpExchange exchange) throws IOException {
        addCorsHeaders(exchange);
        String method = exchange.getRequestMethod();
        if (method.equals("OPTIONS")) {
            exchange.sendResponseHeaders(204, -1);
            exchange.close();
            return;
        }
        if (!method.equals("GET")) {
            exchange.getResponseHeaders().set("Allow", "GET, OPTIONS");
            sendResponse(exchange, 405, "{\"error\":\"method_not_allowed\"}");
            return;
        }
        if (!exchange.getRequestURI().getPath().equals("/players")) {
            sendResponse(exchange, 404, "{\"error\":\"not_found\"}");
            return;
        }

        exchange.getResponseHeaders().set("Cache-Control", "no-store");
        sendResponse(exchange, 200, createPlayersJson());
    }

    private void addCorsHeaders(HttpExchange exchange) {
        String requestOrigin = exchange.getRequestHeaders().getFirst("Origin");
        if (allowedOrigin.equals("*") || allowedOrigin.equals(requestOrigin)) {
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", allowedOrigin);
        }
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
        exchange.getResponseHeaders().set("Vary", "Origin");
    }

    private String createPlayersJson() {
        StringBuilder json = new StringBuilder("{\"players\":{");
        boolean first = true;
        for (OnlinePlayer player : onlinePlayers) {
            if (!first) {
                json.append(',');
            }
            first = false;
            json.append(escapeJson(player.name()))
                    .append(":{\"rank\":")
                    .append(escapeJson(player.rank()));
            String color = rankColors.get(player.rank().toLowerCase(Locale.ROOT));
            if (color != null) {
                json.append(",\"color\":").append(escapeJson(color));
            }
            json.append('}');
        }
        return json.append("}}").toString();
    }

    private static String escapeJson(String value) {
        StringBuilder escaped = new StringBuilder(value.length() + 2).append('"');
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            switch (character) {
                case '"' -> escaped.append("\\\"");
                case '\\' -> escaped.append("\\\\");
                case '\b' -> escaped.append("\\b");
                case '\f' -> escaped.append("\\f");
                case '\n' -> escaped.append("\\n");
                case '\r' -> escaped.append("\\r");
                case '\t' -> escaped.append("\\t");
                default -> {
                    if (character < 0x20) {
                        escaped.append(String.format("\\u%04x", (int) character));
                    } else {
                        escaped.append(character);
                    }
                }
            }
        }
        return escaped.append('"').toString();
    }

    private static void sendResponse(HttpExchange exchange, int status, String body) throws IOException {
        byte[] response = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(status, response.length);
        try (var output = exchange.getResponseBody()) {
            output.write(response);
        }
    }

    private record OnlinePlayer(String name, String rank) {
    }
}
