package realtimeticketing.pageobjects;

import net.serenitybdd.screenplay.targets.Target;
import org.openqa.selenium.By;

public class LoginPage {

    public static final Target HEADING = Target.the("login heading")
            .locatedBy("//h1[contains(., 'Real-Time Ticketing System')]");

    public static final Target SUBTITLE = Target.the("login subtitle")
            .located(By.xpath("//p[contains(., 'Sign in with your Microsoft account')]"));

    public static final Target MICROSOFT_LOGIN_BUTTON = Target.the("Continue with Microsoft button")
            .located(By.xpath("//button[contains(., 'Continue with Microsoft') or contains(., 'Redirecting to Microsoft')]"));

    public static final Target ERROR_BANNER = Target.the("login error banner")
            .located(By.cssSelector("div.bg-red-50 p"));

    public static final Target SECURE_FOOTER = Target.the("secure footer hint")
            .located(By.xpath("//p[contains(., 'Secure authentication powered by Microsoft Azure AD')]"));
}
