package realtimeticketing.pageobjects;

import net.serenitybdd.screenplay.targets.Target;
import org.openqa.selenium.By;

public class SSO_SignIn {
    public static final Target EMAIL_INPUT = Target.the("SSO email field")
            .located(By.cssSelector("input[type='email']#i0116"));

    public static final Target PASSWORD_INPUT = Target.the("SSO password field")
            .located(By.cssSelector("input[type='password']#i0118"));

    public static final Target STAY_SIGNED_IN_NO = Target.the("'Stay signed in?' No button")
            .located(By.cssSelector("#idBtn_Back"));
}
