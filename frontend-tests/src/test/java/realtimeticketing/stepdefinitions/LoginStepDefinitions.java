package realtimeticketing.stepdefinitions;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import net.serenitybdd.model.environment.EnvironmentSpecificConfiguration;
import net.serenitybdd.screenplay.Actor;
import net.serenitybdd.screenplay.ensure.Ensure;
import net.serenitybdd.screenplay.matchers.WebElementStateMatchers;
import net.serenitybdd.screenplay.questions.Text;
import net.serenitybdd.screenplay.waits.WaitUntil;
import net.thucydides.model.environment.SystemEnvironmentVariables;
import net.thucydides.model.util.EnvironmentVariables;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import realtimeticketing.authentication.Login;
import realtimeticketing.pageobjects.HeaderComponent;
import realtimeticketing.pageobjects.LoginPage;
import realtimeticketing.questions.CurrentUrl;
import realtimeticketing.questions.PageTitle;
import realtimeticketing.tasks.NavigateTo;

import static net.serenitybdd.screenplay.matchers.WebElementStateMatchers.isVisible;

public class LoginStepDefinitions {

    private static final Logger LOGGER = LoggerFactory.getLogger(LoginStepDefinitions.class);

    private final EnvironmentVariables environmentVariables = SystemEnvironmentVariables.createEnvironmentVariables();
    private final String frontendUrl = EnvironmentSpecificConfiguration.from(environmentVariables)
            .getProperty("frontend.url");

    private final String microsoftUsername = System.getProperty("usernameMS", System.getenv("MS_USERNAME"));
    private final String microsoftPassword = System.getProperty("passwordMS", System.getenv("MS_PASSWORD"));

    @Given("{actor} is on the ticketing login page")
    public void is_on_the_ticketing_login_page(Actor actor) {
        LOGGER.info("{} is on the ticketing login page", actor.getName());
        LOGGER.info("frontend.url: {}", frontendUrl);
        actor.attemptsTo(NavigateTo.theLoginPage());
        actor.attemptsTo(
                WaitUntil.the(LoginPage.HEADING, isVisible()).forNoMoreThan(20).seconds()
        );
    }

    @Then("{actor} should see the login page elements")
    public void should_see_the_login_page_elements(Actor actor) {
        actor.attemptsTo(
                Ensure.that(LoginPage.HEADING).isDisplayed(),
                Ensure.that(Text.of(LoginPage.HEADING)).contains("Real-Time Ticketing System"),
                Ensure.that(LoginPage.SUBTITLE).isDisplayed(),
                Ensure.that(LoginPage.MICROSOFT_LOGIN_BUTTON).isDisplayed(),
                Ensure.that(LoginPage.SECURE_FOOTER).isDisplayed()
        );
    }

    @Then("{actor} should see the Microsoft sign-in button")
    public void should_see_the_microsoft_sign_in_button(Actor actor) {
        actor.attemptsTo(
                WaitUntil.the(LoginPage.MICROSOFT_LOGIN_BUTTON, isVisible()).forNoMoreThan(10).seconds(),
                Ensure.that(LoginPage.MICROSOFT_LOGIN_BUTTON).isEnabled(),
                Ensure.that(Text.of(LoginPage.MICROSOFT_LOGIN_BUTTON)).containsIgnoringCase("Microsoft")
        );
    }

    @Then("{actor} should see the {string} error message")
    public void should_see_the_error_message(Actor actor, String expectedMessage) {
        actor.attemptsTo(
                WaitUntil.the(LoginPage.ERROR_BANNER, isVisible()).forNoMoreThan(10).seconds(),
                Ensure.that(Text.of(LoginPage.ERROR_BANNER)).contains(expectedMessage)
        );
    }

    @When("{actor} navigates to the login page with error {string}")
    public void navigates_to_the_login_page_with_error(Actor actor, String errorCode) {
        String url = stripTrailingSlash(frontendUrl) + "/login?error=" + errorCode;
        LOGGER.info("Opening: {}", url);
        actor.attemptsTo(net.serenitybdd.screenplay.actions.Open.url(url));
        actor.attemptsTo(
                WaitUntil.the(LoginPage.HEADING, isVisible()).forNoMoreThan(15).seconds()
        );
    }

    @Given("{actor} signs in with Microsoft using the configured credentials")
    public void signs_in_with_microsoft_using_configured_credentials(Actor actor) {
        if (microsoftUsername == null || microsoftPassword == null) {
            throw new IllegalStateException(
                    "Microsoft SSO credentials not provided. Pass -DusernameMS=... -DpasswordMS=... " +
                    "or set MS_USERNAME / MS_PASSWORD environment variables.");
        }
        actor.attemptsTo(NavigateTo.theLoginPage());
        actor.attemptsTo(Login.withMicrosoftSSO(microsoftUsername, microsoftPassword));
    }

    @Given("{actor} is logged in as {string}")
    public void is_logged_in_as(Actor actor, String role) {
        LOGGER.info("{} logs in via the test-login bypass as {}", actor.getName(), role);
        actor.attemptsTo(NavigateTo.theTestLoginAs(role));
        actor.attemptsTo(
                WaitUntil.the(HeaderComponent.HEADER, isVisible()).forNoMoreThan(60).seconds()
        );
    }

    @Then("{actor} should land on the dashboard")
    public void should_land_on_the_dashboard(Actor actor) {
        actor.attemptsTo(
                WaitUntil.the(HeaderComponent.HEADER, isVisible()).forNoMoreThan(60).seconds(),
                Ensure.that(actor.asksFor(CurrentUrl.is())).contains("/dashboard")
        );
    }

    @Then("{actor} should see the page title contain {string}")
    public void should_see_the_page_title_contain(Actor actor, String fragment) {
        actor.attemptsTo(
                Ensure.that(actor.asksFor(PageTitle.is())).contains(fragment)
        );
    }

    private static String stripTrailingSlash(String url) {
        if (url == null) return "";
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
