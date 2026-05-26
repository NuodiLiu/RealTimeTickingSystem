package realtimeticketing.stepdefinitions;

import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import net.serenitybdd.screenplay.Actor;
import net.serenitybdd.screenplay.actors.OnStage;
import net.serenitybdd.screenplay.ensure.Ensure;
import net.serenitybdd.screenplay.questions.Text;
import net.serenitybdd.screenplay.waits.WaitUntil;
import realtimeticketing.pageobjects.PublicDisplayPage;
import realtimeticketing.tasks.NavigateTo;

import static net.serenitybdd.screenplay.matchers.WebElementStateMatchers.isVisible;
import static realtimeticketing.utils.BackendAPI.TEST_DATA_PREFIX;

public class PublicDisplayExtrasStepDefinitions {

    @Then("the header queue count should equal the number of queue cards")
    public void header_count_equals_cards() {
        Actor actor = OnStage.theActorInTheSpotlight();
        actor.attemptsTo(
                WaitUntil.the(PublicDisplayPage.QUEUE_COUNT_VALUE, isVisible()).forNoMoreThan(15).seconds()
        );
        String headerText = actor.asksFor(Text.of(PublicDisplayPage.QUEUE_COUNT_VALUE)).trim();
        int headerCount = Integer.parseInt(headerText);
        int cardCount = PublicDisplayPage.QUEUE_CARDS.resolveAllFor(actor).size();
        actor.attemptsTo(
                Ensure.that(headerCount).isEqualTo(cardCount)
        );
    }

    @When("{actor} reloads the public display page")
    public void reloads_public_display(Actor actor) {
        actor.attemptsTo(NavigateTo.thePublicDisplayPage());
    }

    @Then("a queue card for {string} should be visible")
    public void queue_card_for_should_be_visible(String studentName) {
        Actor actor = OnStage.theActorInTheSpotlight();
        String prefixed = TEST_DATA_PREFIX + studentName;
        actor.attemptsTo(
                WaitUntil.the(PublicDisplayPage.queueCardForName(prefixed), isVisible()).forNoMoreThan(15).seconds(),
                Ensure.that(PublicDisplayPage.queueCardForName(prefixed)).isDisplayed()
        );
    }
}
