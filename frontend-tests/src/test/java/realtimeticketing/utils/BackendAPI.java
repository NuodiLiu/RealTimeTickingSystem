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

    /**
     * Bundle returned by /auth/test-pair-device. Mirrors the JSON shape and
     * is consumed by the kiosk's UITEST_REAL_CREDS hook (after re-encoding).
     */
    public static final class TestDeviceCreds {
        public final String deviceId;
        public final String apiKey;
        public final String wsToken;
        public final String deviceName;
        public final String mode;

        public TestDeviceCreds(String deviceId, String apiKey, String wsToken, String deviceName, String mode) {
            this.deviceId = deviceId;
            this.apiKey = apiKey;
            this.wsToken = wsToken;
            this.deviceName = deviceName;
            this.mode = mode;
        }

        /**
         * JSON the iOS side decodes into DeviceCredentials. Only the three
         * fields the kiosk's UITestSupport reads are emitted — wsToken and
         * deviceName are kept on the Java side for backend calls / cleanup.
         */
        public String toKioskCredsJson() {
            return String.format("{\"deviceId\":%s,\"apiKey\":%s,\"mode\":%s}",
                    quote(deviceId), quote(apiKey), quote(mode));
        }
    }

    /** Pair a brand-new kiosk device via /auth/test-pair-device. */
    public static TestDeviceCreds pairTestDevice(String mode) {
        String body = String.format("{\"mode\":%s}", quote(mode));
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(backendUrl() + "/auth/test-pair-device"))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        HttpResponse<String> res = send(req);
        if (res.statusCode() != 201) {
            throw new IllegalStateException("pairTestDevice failed: HTTP " + res.statusCode() + " " + res.body());
        }
        String body2 = res.body();
        return new TestDeviceCreds(
                extractStringField(body2, "deviceId"),
                extractStringField(body2, "apiKey"),
                extractStringField(body2, "wsToken"),
                extractStringField(body2, "deviceName"),
                extractStringField(body2, "mode"));
    }

    /** Delete every kiosk device whose name starts with the suite's prefix. */
    public static int clearTestDevices() {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(backendUrl() + "/auth/test-pair-devices?prefix=E2E_Kiosk_"))
                .timeout(Duration.ofSeconds(15))
                .DELETE()
                .build();
        HttpResponse<String> res = send(req);
        if (res.statusCode() == 404) {
            return -1;
        }
        if (res.statusCode() != 200) {
            throw new IllegalStateException("clearTestDevices failed: HTTP " + res.statusCode() + " " + res.body());
        }
        String n = extractStringField(res.body(), "deleted");
        return n == null ? 0 : Integer.parseInt(n);
    }

    /**
     * Follow the /auth/test-login redirect and pull the App JWT out of the
     * /auth/callback?token=… URL. Used by cross-end scenarios that need to
     * call staff-authenticated endpoints directly without driving the browser.
     */
    public static String staffJwt(String role) {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(backendUrl() + "/auth/test-login?role=" + role))
                .timeout(Duration.ofSeconds(15))
                .GET()
                .build();
        try {
            // Default HttpClient follows redirects only on NEVER. Build a one-off
            // client that follows so we can read the final URL.
            HttpClient followClient = HttpClient.newBuilder()
                    .followRedirects(HttpClient.Redirect.ALWAYS)
                    .connectTimeout(Duration.ofSeconds(10))
                    .build();
            HttpResponse<String> res = followClient.send(req, HttpResponse.BodyHandlers.ofString());
            String url = res.uri().toString();
            int idx = url.indexOf("token=");
            if (idx < 0) {
                throw new IllegalStateException("staffJwt: no token in redirect URL: " + url);
            }
            String token = url.substring(idx + "token=".length());
            int amp = token.indexOf('&');
            if (amp >= 0) token = token.substring(0, amp);
            return java.net.URLDecoder.decode(token, java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("staffJwt failed", e);
        }
    }

    /** Hit POST /cases/take-next as the given staff. Returns the taken case id. */
    public static String takeNextCase(String jwt) {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(backendUrl() + "/cases/take-next"))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + jwt)
                .POST(HttpRequest.BodyPublishers.ofString("{}"))
                .build();
        HttpResponse<String> res = send(req);
        if (res.statusCode() != 200) {
            throw new IllegalStateException("takeNextCase failed: HTTP " + res.statusCode() + " " + res.body());
        }
        return extractStringField(res.body(), "id");
    }

    /**
     * Walk the staff-visible status buckets and return the bucket name (upper
     * case) for the case whose studentName matches {@code studentName}, or
     * null if not found anywhere.
     */
    public static String findCaseStatusByStudentName(String jwt, String studentName) {
        String[] buckets = { "queued", "in_progress", "resolved_pending_feedback", "resolved" };
        String needle = "\"studentName\":\"" + studentName + "\"";
        for (String bucket : buckets) {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(backendUrl() + "/cases?status=" + bucket))
                    .timeout(Duration.ofSeconds(5))
                    .header("Authorization", "Bearer " + jwt)
                    .GET()
                    .build();
            try {
                HttpResponse<String> res = CLIENT.send(req, HttpResponse.BodyHandlers.ofString());
                if (res.statusCode() == 200 && res.body().contains(needle)) {
                    return bucket.toUpperCase();
                }
            } catch (Exception ignored) {}
        }
        return null;
    }

    /**
     * Fetch a case's current status via /cases?status=… buckets. Returns null
     * if the case isn't found in any of the staff-visible buckets. Used by
     * cross-end scenarios to verify backend state transitions independently
     * of the dashboard UI's refresh timing.
     */
    public static String caseStatus(String jwt, String caseId) {
        String[] buckets = { "queued", "in_progress", "resolved_pending_feedback", "resolved" };
        for (String bucket : buckets) {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(backendUrl() + "/cases?status=" + bucket))
                    .timeout(Duration.ofSeconds(5))
                    .header("Authorization", "Bearer " + jwt)
                    .GET()
                    .build();
            try {
                HttpResponse<String> res = CLIENT.send(req, HttpResponse.BodyHandlers.ofString());
                if (res.statusCode() == 200 && res.body().contains("\"id\":\"" + caseId + "\"")) {
                    return bucket.toUpperCase();
                }
            } catch (Exception ignored) {}
        }
        return null;
    }

    /**
     * Poll /device/by-mode/FEEDBACK until the given device reports BUSY,
     * up to {@code timeoutSeconds}. The dashboard's "Override?" confirmation
     * only fires when its in-memory device state has status==BUSY, which lags
     * the backend by SignalR latency + smart-update debounce. Returns true if
     * we saw BUSY before the timeout.
     */
    public static boolean waitForDeviceBusy(String jwt, String deviceId, int timeoutSeconds) {
        long deadline = System.currentTimeMillis() + (timeoutSeconds * 1000L);
        while (System.currentTimeMillis() < deadline) {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(backendUrl() + "/device/by-mode/FEEDBACK"))
                    .timeout(Duration.ofSeconds(5))
                    .header("Authorization", "Bearer " + jwt)
                    .GET()
                    .build();
            try {
                HttpResponse<String> res = CLIENT.send(req, HttpResponse.BodyHandlers.ofString());
                if (res.statusCode() == 200 && res.body().contains("\"deviceId\":\"" + deviceId + "\"")
                        && res.body().contains("\"status\":\"BUSY\"")) {
                    return true;
                }
            } catch (Exception ignored) {}
            try { Thread.sleep(500); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        }
        return false;
    }

    /** Hit POST /feedback/send to push a SHOW_FEEDBACK SignalR event to the device. */
    public static void sendFeedback(String jwt, String caseId, String deviceId) {
        String body = String.format("{\"caseId\":%s,\"deviceId\":%s}", quote(caseId), quote(deviceId));
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(backendUrl() + "/feedback/send"))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + jwt)
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        HttpResponse<String> res = send(req);
        if (res.statusCode() != 200) {
            throw new IllegalStateException("sendFeedback failed: HTTP " + res.statusCode() + " " + res.body());
        }
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
