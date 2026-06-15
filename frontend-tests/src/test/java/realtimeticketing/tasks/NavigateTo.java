package realtimeticketing.tasks;

import net.serenitybdd.model.environment.EnvironmentSpecificConfiguration;
import net.serenitybdd.screenplay.Performable;
import net.serenitybdd.screenplay.Task;
import net.serenitybdd.screenplay.actions.Open;
import net.thucydides.model.environment.SystemEnvironmentVariables;
import net.thucydides.model.util.EnvironmentVariables;

public class NavigateTo {

    private static String baseUrl() {
        EnvironmentVariables env = SystemEnvironmentVariables.createEnvironmentVariables();
        return EnvironmentSpecificConfiguration.from(env).getProperty("frontend.url");
    }

    private static String backendUrl() {
        EnvironmentVariables env = SystemEnvironmentVariables.createEnvironmentVariables();
        return EnvironmentSpecificConfiguration.from(env).getProperty("backend.url");
    }

    /**
     * Test-only login bypass: hits the backend's /auth/test-login endpoint,
     * which signs an App JWT and redirects through the frontend callback to
     * the dashboard — skipping the real Microsoft login page entirely.
     */
    public static Performable theTestLoginAs(String role) {
        return Task.where("{0} logs in via the test-login bypass as " + role,
                Open.url(stripTrailingSlash(backendUrl()) + "/auth/test-login?role=" + role));
    }

    public static Performable theLoginPage() {
        return Task.where("{0} opens the login page",
                Open.url(stripTrailingSlash(baseUrl()) + "/login"));
    }

    public static Performable theDashboardPage() {
        return Task.where("{0} opens the dashboard page",
                Open.url(stripTrailingSlash(baseUrl()) + "/dashboard"));
    }

    public static Performable thePublicDisplayPage() {
        return Task.where("{0} opens the public display page",
                Open.url(stripTrailingSlash(baseUrl()) + "/public-display"));
    }

    public static Performable theHomePage() {
        return Task.where("{0} opens the home page",
                Open.url(stripTrailingSlash(baseUrl()) + "/"));
    }

    public static Performable theAuthCallback() {
        return Task.where("{0} opens the auth callback page with no parameters",
                Open.url(stripTrailingSlash(baseUrl()) + "/auth/callback"));
    }

    public static Performable theAuthCallbackWithError(String errorCode) {
        return Task.where("{0} opens the auth callback page with error=" + errorCode,
                Open.url(stripTrailingSlash(baseUrl()) + "/auth/callback?error=" + errorCode));
    }

    public static Performable thePath(String path) {
        String normalised = path.startsWith("/") ? path : "/" + path;
        return Task.where("{0} opens " + normalised,
                Open.url(stripTrailingSlash(baseUrl()) + normalised));
    }

    private static String stripTrailingSlash(String url) {
        if (url == null) return "";
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
