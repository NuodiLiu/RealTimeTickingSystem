package realtimeticketing.kiosk;

import io.appium.java_client.ios.IOSDriver;
import io.appium.java_client.ios.options.XCUITestOptions;
import io.appium.java_client.ios.options.wda.ProcessArguments;
import net.serenitybdd.model.environment.EnvironmentSpecificConfiguration;
import net.thucydides.model.environment.SystemEnvironmentVariables;
import net.thucydides.model.util.EnvironmentVariables;
import realtimeticketing.utils.BackendAPI;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Lifecycle wrapper around an Appium {@link IOSDriver} talking to a local
 * Appium server (default :4723) and a booted iPad simulator running the
 * KioskApp .app. One instance per @CrossEnd scenario; {@link #close()} ends
 * the driver session but leaves the simulator + Appium server running so
 * subsequent scenarios don't pay the boot cost.
 *
 * Reads the following from serenity.conf (override per-env if needed):
 *   kiosk.appium.url    default http://127.0.0.1:4723
 *   kiosk.sim.udid      a specific simulator UDID (auto-detected if blank)
 *   kiosk.app.path      absolute path to KioskApp.app for iOS simulator
 *
 * The driver injects real backend credentials via the launch env
 * UITEST_REAL_CREDS, so the kiosk authenticates against the same backend the
 * staff browser is using.
 */
public final class KioskDriver implements AutoCloseable {

    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private final IOSDriver driver;
    private final BackendAPI.TestDeviceCreds creds;

    private KioskDriver(IOSDriver driver, BackendAPI.TestDeviceCreds creds) {
        this.driver = driver;
        this.creds = creds;
    }

    public IOSDriver driver() { return driver; }
    public BackendAPI.TestDeviceCreds creds() { return creds; }

    /**
     * Launch KioskApp on the simulator *without* pre-pairing. Used by the
     * true-QR pairing scenario, where the iPad itself drives /pair/complete
     * via the simulateScanButton. The provided deviceName is propagated into
     * UITEST_DEVICE_NAME so the iPad sends it instead of UIDevice.current.name,
     * which keeps cleanup scoped to E2E_Kiosk_* rows.
     */
    public static KioskDriver launchUnpaired(String deviceNameOverride) {
        EnvironmentVariables env = SystemEnvironmentVariables.createEnvironmentVariables();
        String appiumUrlStr = orDefault(EnvironmentSpecificConfiguration.from(env).getOptionalProperty("kiosk.appium.url"),
                "http://127.0.0.1:4723");
        String simUdid = orDefault(EnvironmentSpecificConfiguration.from(env).getOptionalProperty("kiosk.sim.udid"),
                "");
        String appPath = orDefault(EnvironmentSpecificConfiguration.from(env).getOptionalProperty("kiosk.app.path"),
                "/tmp/kioskapp-derived/Build/Products/Debug-iphonesimulator/KioskApp.app");
        String backendUrl = EnvironmentSpecificConfiguration.from(env).getProperty("backend.url");

        requireAppiumUp(appiumUrlStr);
        if (!Path.of(appPath).toFile().exists()) {
            throw new IllegalStateException("KioskApp.app not found at " + appPath);
        }

        Map<String, Object> envVars = new HashMap<>();
        envVars.put("API_BASE_URL", backendUrl);
        envVars.put("UITEST_DEVICE_NAME", deviceNameOverride);
        ProcessArguments processArgs = new ProcessArguments(List.of("-uiTesting"), envVars);

        XCUITestOptions opts = new XCUITestOptions()
                .setApp(appPath)
                .setNoReset(true)
                .setForceAppLaunch(true)
                .setShouldTerminateApp(true)
                .setNewCommandTimeout(Duration.ofMinutes(5))
                .setWdaStartupRetries(2)
                .setWdaLaunchTimeout(Duration.ofMinutes(2));
        if (!simUdid.isBlank()) opts.setUdid(simUdid);
        else opts.setDeviceName("iPad (A16)");
        opts.setProcessArguments(processArgs);

        try {
            IOSDriver d = new IOSDriver(URI.create(appiumUrlStr).toURL(), opts);
            // No backend creds — the iPad will create the device itself via
            // /pair/complete. We synthesise a "creds" object so the cleanup
            // hook can wipe by name.
            BackendAPI.TestDeviceCreds creds = new BackendAPI.TestDeviceCreds(
                    "", "", "", deviceNameOverride, "PENDING");
            return new KioskDriver(d, creds);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to start unpaired IOSDriver: " + e.getMessage(), e);
        }
    }

    /**
     * Pair a test device on the backend, launch KioskApp on the simulator
     * with those credentials, and return a ready-to-use driver.
     */
    public static KioskDriver launchWithPairedDevice(String mode) {
        EnvironmentVariables env = SystemEnvironmentVariables.createEnvironmentVariables();
        String appiumUrlStr = orDefault(EnvironmentSpecificConfiguration.from(env).getOptionalProperty("kiosk.appium.url"),
                "http://127.0.0.1:4723");
        String simUdid = orDefault(EnvironmentSpecificConfiguration.from(env).getOptionalProperty("kiosk.sim.udid"),
                "");
        String appPath = orDefault(EnvironmentSpecificConfiguration.from(env).getOptionalProperty("kiosk.app.path"),
                "/tmp/kioskapp-derived/Build/Products/Debug-iphonesimulator/KioskApp.app");
        String backendUrl = EnvironmentSpecificConfiguration.from(env).getProperty("backend.url");

        requireAppiumUp(appiumUrlStr);
        Path appFile = Path.of(appPath);
        if (!appFile.toFile().exists()) {
            throw new IllegalStateException("KioskApp.app not found at " + appPath
                    + " — build first: xcodebuild -project KioskApp/KioskApp.xcodeproj -scheme KioskApp "
                    + "-configuration Debug -sdk iphonesimulator -derivedDataPath /tmp/kioskapp-derived -arch arm64 build");
        }

        BackendAPI.TestDeviceCreds creds = BackendAPI.pairTestDevice(mode);

        Map<String, Object> envVars = new HashMap<>();
        envVars.put("UITEST_REAL_CREDS", creds.toKioskCredsJson());
        envVars.put("API_BASE_URL", backendUrl);
        ProcessArguments processArgs = new ProcessArguments(List.of("-uiTesting"), envVars);

        XCUITestOptions opts = new XCUITestOptions()
                .setApp(appPath)
                // noReset=true would keep app data across sessions, but it also
                // means launchEnvironment from a new session doesn't reach the
                // already-running process — the kiosk would launch with stale
                // creds. forceAppLaunch ensures the .app process is killed and
                // restarted with the new UITEST_REAL_CREDS each scenario.
                .setNoReset(true)
                .setForceAppLaunch(true)
                .setShouldTerminateApp(true)
                .setNewCommandTimeout(Duration.ofMinutes(5))
                .setWdaStartupRetries(2)
                .setWdaLaunchTimeout(Duration.ofMinutes(2));
        if (!simUdid.isBlank()) {
            opts.setUdid(simUdid);
        } else {
            // Let XCUITest pick the first booted iPad; the smoke test will
            // assert we ended up on the right device before exercising it.
            opts.setDeviceName("iPad (A16)");
        }
        opts.setProcessArguments(processArgs);

        IOSDriver d;
        try {
            d = new IOSDriver(URI.create(appiumUrlStr).toURL(), opts);
        } catch (Exception e) {
            // If launching the driver fails, the backend already created a
            // device row — wipe it so we don't leak rows on every failed run.
            try { BackendAPI.clearTestDevices(); } catch (Exception ignored) {}
            throw new IllegalStateException("Failed to start IOSDriver via " + appiumUrlStr + ": " + e.getMessage(), e);
        }
        return new KioskDriver(d, creds);
    }

    @Override
    public void close() {
        try { driver.quit(); } catch (Exception ignored) {}
    }

    private static String orDefault(java.util.Optional<String> v, String fallback) {
        return v.isPresent() && !v.get().isBlank() ? v.get() : fallback;
    }

    private static void requireAppiumUp(String appiumUrl) {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(appiumUrl + "/status"))
                .timeout(Duration.ofSeconds(3))
                .GET()
                .build();
        try {
            HttpResponse<String> res = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) {
                throw new IllegalStateException("Appium /status returned " + res.statusCode() + " at " + appiumUrl);
            }
        } catch (Exception e) {
            throw new IllegalStateException("Appium server not reachable at " + appiumUrl
                    + " — start with `appium --port 4723` before running @CrossEnd scenarios", e);
        }
    }
}
