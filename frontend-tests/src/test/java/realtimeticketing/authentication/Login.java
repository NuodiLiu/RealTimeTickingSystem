package realtimeticketing.authentication;

import net.serenitybdd.screenplay.Performable;
import net.serenitybdd.screenplay.Task;
import net.serenitybdd.screenplay.actions.Click;
import net.serenitybdd.screenplay.actions.Enter;
import net.serenitybdd.screenplay.matchers.WebElementStateMatchers;
import net.serenitybdd.screenplay.waits.WaitUntil;
import org.openqa.selenium.Keys;
import realtimeticketing.pageobjects.LoginPage;
import realtimeticketing.pageobjects.SSO_SignIn;

public class Login {

    public static Performable withMicrosoftSSO(String username, String password) {
        return Task.where("{0} signs in with Microsoft SSO",
                WaitUntil.the(LoginPage.MICROSOFT_LOGIN_BUTTON, WebElementStateMatchers.isClickable())
                        .forNoMoreThan(30).seconds(),
                Click.on(LoginPage.MICROSOFT_LOGIN_BUTTON),

                WaitUntil.the(SSO_SignIn.EMAIL_INPUT, WebElementStateMatchers.isClickable())
                        .forNoMoreThan(60).seconds(),
                Enter.theValue(username).into(SSO_SignIn.EMAIL_INPUT).thenHit(Keys.ENTER),

                WaitUntil.the(SSO_SignIn.PASSWORD_INPUT, WebElementStateMatchers.isClickable())
                        .forNoMoreThan(60).seconds(),
                Enter.theValue(password).into(SSO_SignIn.PASSWORD_INPUT).thenHit(Keys.ENTER)
        );
    }
}
