package realtimeticketing.kiosk;

import io.appium.java_client.AppiumBy;
import io.appium.java_client.ios.IOSDriver;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.openqa.selenium.support.ui.ExpectedConditions;

import java.time.Duration;

/**
 * Page-object equivalent for KioskApp's accessibility identifiers. Wraps the
 * driver so step defs don't need to import Appium classes directly. Locators
 * use AppiumBy.accessibilityId, which maps to SwiftUI's
 * .accessibilityIdentifier(...) modifiers in the iOS app.
 */
public final class KioskApp {

    public static final By PAIRING_SCAN_BUTTON      = AppiumBy.accessibilityId("pairing.scanButton");
    public static final By PAIRING_MODE_FEEDBACK    = AppiumBy.accessibilityId("pairing.mode.FEEDBACK");
    public static final By PAIRING_MODE_REGISTRATION = AppiumBy.accessibilityId("pairing.mode.REGISTRATION");

    public static final By REGISTRATION_TITLE       = AppiumBy.accessibilityId("registration.title");

    public static final By FEEDBACK_COVER_TITLE     = AppiumBy.accessibilityId("feedback.coverTitle");
    public static final By FEEDBACK_FORM_TITLE      = AppiumBy.accessibilityId("feedback.formTitle");
    public static final By FEEDBACK_SUBMIT_BUTTON   = AppiumBy.accessibilityId("feedback.submitButton");
    public static final By FEEDBACK_CLOSE_BUTTON    = AppiumBy.accessibilityId("feedback.closeButton");
    public static final By FEEDBACK_THANK_YOU       = AppiumBy.accessibilityId("feedback.thankYou");

    public static By feedbackStar(int n) {
        return AppiumBy.accessibilityId("feedback.star." + n);
    }

    public static final By REGISTRATION_ZID_FIELD        = AppiumBy.accessibilityId("registration.zidField");
    public static final By REGISTRATION_NAME_FIELD       = AppiumBy.accessibilityId("registration.nameField");
    public static final By REGISTRATION_PRIVACY_CHECK    = AppiumBy.accessibilityId("registration.privacyCheckbox");
    public static final By REGISTRATION_SUBMIT_BUTTON    = AppiumBy.accessibilityId("registration.submitButton");
    public static final By REGISTRATION_SUCCESS_TITLE    = AppiumBy.accessibilityId("registration.successTitle");

    private final IOSDriver driver;

    public KioskApp(IOSDriver driver) { this.driver = driver; }

    public boolean isVisible(By locator, Duration timeout) {
        try {
            new WebDriverWait(driver, timeout)
                    .until(ExpectedConditions.visibilityOfElementLocated(locator));
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public WebElement waitVisible(By locator, Duration timeout) {
        return new WebDriverWait(driver, timeout)
                .until(ExpectedConditions.visibilityOfElementLocated(locator));
    }

    public void tap(By locator, Duration timeout) {
        waitVisible(locator, timeout).click();
    }
}
