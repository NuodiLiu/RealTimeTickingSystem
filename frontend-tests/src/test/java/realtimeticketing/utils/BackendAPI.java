package realtimeticketing.utils;

import net.serenitybdd.model.environment.EnvironmentSpecificConfiguration;
import net.thucydides.model.environment.SystemEnvironmentVariables;
import net.thucydides.model.util.EnvironmentVariables;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Thin HTTP client for backend test-only endpoints used by the E2E suite.
 *
 * Backed by /auth/test-seed-case and /auth/test-seed-cases, both guarded by
 * NODE_ENV !== 'production' AND TEST_AUTH_ENABLED === 'true'. If those flags
 * are off the endpoints 404 and helper methods throw — pointing tests at the
 * wrong environment fails loudly instead of silently passing.
 *
 * All seeded rows use the prefix "E2E_" on studentName so cleanup is scoped.
 */
public final class BackendAPI {

    public static final String TEST_DATA_PREFIX = "E2E_";

    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private BackendAPI() {}

    private static String backendUrl() {
        EnvironmentVariables env = SystemEnvironmentVariables.createEnvironmentVariables();
        String url = EnvironmentSpecificConfiguration.from(env).getProperty("backend.url");
        if (url == null || url.isBlank()) {
            throw new IllegalStateException("backend.url is not set in serenity.conf for the active environment");
        }
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    /**
     * Seed a queued StudentCase. studentName is automatically prefixed with
     * "E2E_" so cleanup can find it. Returns the new case id.
     */
    public static String seedQueuedCase(String studentName, String category, String zID) {
        String prefixed = studentName.startsWith(TEST_DATA_PREFIX) ? studentName : TEST_DATA_PREFIX + studentName;
        String body = String.format(
                "{\"studentName\":%s,\"category\":%s,\"zID\":%s}",
                quote(prefixed), quote(category), zID == null ? "null" : quote(zID));
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(backendUrl() + "/auth/test-seed-case"))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        HttpResponse<String> res = send(req);
        if (res.statusCode() != 201) {
            throw new IllegalStateException("seedQueuedCase failed: HTTP " + res.statusCode() + " " + res.body());
        }
        return extractStringField(res.body(), "id");
    }

    /**
     * Delete every StudentCase whose studentName starts with the suite's prefix.
     *
     * Returns -1 if the endpoint is not deployed (404) — non-fatal so that
     * scenarios which only need to *assert* an empty queue can still run
     * against an environment that hasn't shipped the seed endpoints yet.
     * Throws on any other error to keep real failures loud.
     */
    public static int clearTestCases() {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(backendUrl() + "/auth/test-seed-cases?prefix=" + TEST_DATA_PREFIX))
                .timeout(Duration.ofSeconds(15))
                .DELETE()
                .build();
        HttpResponse<String> res = send(req);
        if (res.statusCode() == 404) {
            return -1;
        }
        if (res.statusCode() != 200) {
            throw new IllegalStateException("clearTestCases failed: HTTP " + res.statusCode() + " " + res.body());
        }
        String n = extractStringField(res.body(), "deleted");
        return n == null ? 0 : Integer.parseInt(n);
    }

    /** Hit /health — returns true if 200. Used as a guard before scenarios that need the backend. */
    public static boolean isHealthy() {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(backendUrl() + "/health"))
                .timeout(Duration.ofSeconds(5))
                .GET()
                .build();
        try {
            HttpResponse<String> res = CLIENT.send(req, HttpResponse.BodyHandlers.ofString());
            return res.statusCode() == 200;
        } catch (Exception e) {
            return false;
        }
    }

    private static HttpResponse<String> send(HttpRequest req) {
        try {
            return CLIENT.send(req, HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            throw new IllegalStateException("HTTP call failed: " + req.uri(), e);
        }
    }

    private static String quote(String s) {
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    /**
     * Minimal field extractor — avoids pulling in Jackson/Gson just for two
     * keys. Works for top-level "key":"value" or "key":number patterns.
     */
    private static String extractStringField(String json, String key) {
        if (json == null) return null;
        String marker = "\"" + key + "\":";
        int i = json.indexOf(marker);
        if (i < 0) return null;
        i += marker.length();
        while (i < json.length() && Character.isWhitespace(json.charAt(i))) i++;
        if (i >= json.length()) return null;
        if (json.charAt(i) == '"') {
            int end = json.indexOf('"', i + 1);
            return end < 0 ? null : json.substring(i + 1, end);
        }
        int end = i;
        while (end < json.length() && "0123456789-.eE".indexOf(json.charAt(end)) >= 0) end++;
        return json.substring(i, end);
    }
}
