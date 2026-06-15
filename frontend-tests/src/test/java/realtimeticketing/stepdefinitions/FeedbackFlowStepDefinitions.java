package realtimeticketing.stepdefinitions;

import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import net.serenitybdd.screenplay.Actor;
import net.serenitybdd.screenplay.actors.OnStage;
import net.serenitybdd.screenplay.ensure.Ensure;
import net.serenitybdd.screenplay.questions.Text;
import net.serenitybdd.screenplay.waits.WaitUntil;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.interactions.Actions;
import net.serenitybdd.screenplay.abilities.BrowseTheWeb;
import realtimeticketing.pageobjects.DashboardPage;

import static net.serenitybdd.screenplay.matchers.WebElementStateMatchers.isVisible;
import static realtimeticketing.utils.BackendAPI.TEST_DATA_PREFIX;

public class FeedbackFlowStepDefinitions {

    @Then("the FEEDBACK button for {string} should be disabled")
    public void feedback_button_should_be_disabled(String studentName) {
        Actor actor = OnStage.theActorInTheSpotlight();
        String prefixed = TEST_DATA_PREFIX + studentName;
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.activeFeedbackButtonFor(prefixed), isVisible()).forNoMoreThan(15).seconds(),
                Ensure.that(DashboardPage.activeFeedbackButtonFor(prefixed)).isDisabled()
        );
    }

    @When("{actor} hovers the FEEDBACK button for {string}")
    public void hovers_feedback_button(Actor actor, String studentName) {
        String prefixed = TEST_DATA_PREFIX + studentName;
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.activeFeedbackButtonFor(prefixed), isVisible()).forNoMoreThan(15).seconds()
        );
        WebElement btn = DashboardPage.activeFeedbackButtonFor(prefixed).resolveFor(actor);
        new Actions(BrowseTheWeb.as(actor).getDriver()).moveToElement(btn).perform();
        // Tooltip is delayed 500ms by design; wait until it appears in the DOM.
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.TOOLTIP_BUBBLE, isVisible()).forNoMoreThan(5).seconds()
        );
    }

    @Then("the tooltip should explain a feedback device is required")
    public void tooltip_explains_device_required() {
        Actor actor = OnStage.theActorInTheSpotlight();
        String text = actor.asksFor(Text.of(DashboardPage.TOOLTIP_BUBBLE));
        actor.attemptsTo(
                Ensure.that(text.toLowerCase()).containsIgnoringCase("device")
        );
    }
}
