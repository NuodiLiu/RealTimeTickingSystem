package realtimeticketing.stepdefinitions;

import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import net.serenitybdd.screenplay.Actor;
import net.serenitybdd.screenplay.actors.OnStage;
import net.serenitybdd.screenplay.ensure.Ensure;
import net.serenitybdd.screenplay.waits.WaitUntil;
import realtimeticketing.pageobjects.AuthCallbackPage;
import realtimeticketing.pageobjects.LoginPage;
import realtimeticketing.tasks.NavigateTo;

import static net.serenitybdd.screenplay.matchers.WebElementStateMatchers.isVisible;

public class AuthCallbackStepDefinitions {

    @Then("the login error banner should not be visible")
    public void login_error_banner_should_not_be_visible() {
        Actor actor = OnStage.theActorInTheSpotlight();
        actor.attemptsTo(
                Ensure.that(LoginPage.ERROR_BANNER_CONTAINER).isNotDisplayed()
        );
    }

    @When("{actor} opens the auth callback page without parameters")
    public void opens_auth_callback_no_params(Actor actor) {
        actor.attemptsTo(NavigateTo.theAuthCallback());
    }

    @When("{actor} opens the auth callback page with error {string}")
    public void opens_auth_callback_with_error(Actor actor, String errorCode) {
        actor.attemptsTo(NavigateTo.theAuthCallbackWithError(errorCode));
    }

    @Then("{actor} should see the Authentication Failed UI")
    public void should_see_auth_failed_ui(Actor actor) {
        actor.attemptsTo(
                WaitUntil.the(AuthCallbackPage.FAILURE_HEADING, isVisible()).forNoMoreThan(10).seconds(),
                Ensure.that(AuthCallbackPage.FAILURE_HEADING).isDisplayed(),
                Ensure.that(AuthCallbackPage.RETURN_TO_LOGIN_BUTTON).isDisplayed()
        );
    }

    @Then("{actor} should see the no-token message")
    public void should_see_no_token_message(Actor actor) {
        actor.attemptsTo(
                Ensure.that(AuthCallbackPage.NO_TOKEN_MESSAGE).isDisplayed()
        );
    }

    @Then("{actor} should see the generic authentication-failed message")
    public void should_see_generic_auth_failed_message(Actor actor) {
        actor.attemptsTo(
                Ensure.that(AuthCallbackPage.AUTH_FAILED_MESSAGE).isDisplayed()
        );
    }
}
