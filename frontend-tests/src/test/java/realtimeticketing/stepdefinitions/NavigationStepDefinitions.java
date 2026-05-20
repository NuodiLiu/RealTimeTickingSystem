package realtimeticketing.stepdefinitions;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import net.serenitybdd.screenplay.Actor;
import net.serenitybdd.screenplay.abilities.BrowseTheWeb;
import net.serenitybdd.screenplay.ensure.Ensure;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import realtimeticketing.questions.CurrentUrl;
import realtimeticketing.tasks.NavigateTo;

import java.time.Duration;

public class NavigationStepDefinitions {

    private static final Logger LOGGER = LoggerFactory.getLogger(NavigationStepDefinitions.class);

    @Given("{actor} opens the login page")
    public void opens_the_login_page(Actor actor) {
        LOGGER.info("{} opens the login page", actor.getName());
        actor.attemptsTo(NavigateTo.theLoginPage());
    }

    @Given("{actor} opens the dashboard page")
    public void opens_the_dashboard_page(Actor actor) {
        LOGGER.info("{} opens the dashboard page", actor.getName());
        actor.attemptsTo(NavigateTo.theDashboardPage());
    }

    @Given("{actor} opens the public display page")
    public void opens_the_public_display_page(Actor actor) {
        LOGGER.info("{} opens the public display page", actor.getName());
        actor.attemptsTo(NavigateTo.thePublicDisplayPage());
    }

    @When("{actor} opens the home page")
    public void opens_the_home_page(Actor actor) {
        LOGGER.info("{} opens the home page", actor.getName());
        actor.attemptsTo(NavigateTo.theHomePage());
    }

    @Then("{actor} should be redirected to the {string} path")
    public void should_be_redirected_to_path(Actor actor, String expectedPath) {
        // AuthGuard / home redirect is asynchronous — wait up to 15s for the
        // URL to settle on the expected path before asserting.
        new WebDriverWait(BrowseTheWeb.as(actor).getDriver(), Duration.ofSeconds(15))
                .until(ExpectedConditions.urlContains(expectedPath));

        String currentUrl = actor.asksFor(CurrentUrl.is());
        LOGGER.info("Current URL: {}", currentUrl);
        actor.attemptsTo(
                Ensure.that(currentUrl).contains(expectedPath)
        );
    }
}
