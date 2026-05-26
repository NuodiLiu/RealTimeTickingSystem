package realtimeticketing.pageobjects;

import net.serenitybdd.screenplay.targets.Target;
import org.openqa.selenium.By;

/**
 * /auth/callback handles the post-SSO token exchange. On error or missing
 * token, it shows an "Authentication Failed" header, then router.push's
 * /login after 3 seconds. Tests below assert the transient state then the
 * eventual redirect URL.
 */
public class AuthCallbackPage {

    public static final Target FAILURE_HEADING = Target.the("Authentication Failed heading")
            .located(By.xpath("//h2[normalize-space()='Authentication Failed']"));

    public static final Target NO_TOKEN_MESSAGE = Target.the("No authentication token message")
            .located(By.xpath("//p[contains(normalize-space(.), 'No authentication token received')]"));

    public static final Target AUTH_FAILED_MESSAGE = Target.the("Authentication failed message")
            .located(By.xpath("//p[contains(normalize-space(.), 'Authentication failed')]"));

    public static final Target RETURN_TO_LOGIN_BUTTON = Target.the("Return to Login button")
            .located(By.xpath("//button[normalize-space()='Return to Login']"));
}
