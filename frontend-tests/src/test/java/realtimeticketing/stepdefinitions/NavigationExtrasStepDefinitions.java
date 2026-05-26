package realtimeticketing.stepdefinitions;

import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import net.serenitybdd.screenplay.Actor;
import net.serenitybdd.screenplay.abilities.BrowseTheWeb;
import net.serenitybdd.screenplay.ensure.Ensure;
import org.openqa.selenium.support.ui.WebDriverWait;
import realtimeticketing.tasks.NavigateTo;

import java.time.Duration;

public class NavigationExtrasStepDefinitions {

    @When("{actor} opens the path {string}")
    public void opens_the_path(Actor actor, String path) {
        actor.attemptsTo(NavigateTo.thePath(path));
    }

    @Then("{actor} should see the Next.js 404 page")
    public void should_see_404(Actor actor) {
        // Next.js default 404 renders the literal "404" digits along with a
        // "This page could not be found" caption. Either marker is sufficient
        // — accept either to stay tolerant of a future custom not-found page
        // that keeps the same intent.
        String body = BrowseTheWeb.as(actor).getDriver().findElement(org.openqa.selenium.By.tagName("body")).getText();
        actor.attemptsTo(
                Ensure.that(body.contains("404") || body.toLowerCase().contains("could not be found")).isTrue()
        );
    }

    @When("{actor} presses the browser back button")
    public void presses_back(Actor actor) {
        BrowseTheWeb.as(actor).getDriver().navigate().back();
        // The browser briefly reports an empty URL during the history pop.
        // Wait for a real navigation to settle before the next step asserts
        // against the URL.
        new WebDriverWait(BrowseTheWeb.as(actor).getDriver(), Duration.ofSeconds(15))
                .until(driver -> {
                    String url = driver.getCurrentUrl();
                    return url != null && !url.isEmpty() && !url.equals("about:blank");
                });
    }

    @Then("{actor} should not be on the dashboard")
    public void should_not_be_on_dashboard(Actor actor) {
        // After logout + back, AuthGuard should have re-evaluated and pushed
        // back to /login. We give it a little time then assert we are *not*
        // on /dashboard rather than insisting on /login, since the back stack
        // could legitimately put us on /auth/callback briefly.
        new WebDriverWait(BrowseTheWeb.as(actor).getDriver(), Duration.ofSeconds(10))
                .until(driver -> !String.valueOf(driver.getCurrentUrl()).contains("/dashboard"));
        String url = BrowseTheWeb.as(actor).getDriver().getCurrentUrl();
        actor.attemptsTo(
                Ensure.that(url).doesNotContain("/dashboard")
        );
    }
}
