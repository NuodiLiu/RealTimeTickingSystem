package realtimeticketing.stepdefinitions;

import io.cucumber.java.en.Then;
import net.serenitybdd.screenplay.Actor;
import net.serenitybdd.screenplay.ensure.Ensure;
import net.serenitybdd.screenplay.questions.Text;
import net.serenitybdd.screenplay.waits.WaitUntil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import realtimeticketing.pageobjects.PublicDisplayPage;

import static net.serenitybdd.screenplay.matchers.WebElementStateMatchers.isVisible;

public class PublicDisplayStepDefinitions {

    private static final Logger LOGGER = LoggerFactory.getLogger(PublicDisplayStepDefinitions.class);

    @Then("{actor} should see the Help Desk Queue banner")
    public void should_see_the_help_desk_queue_banner(Actor actor) {
        LOGGER.info("{} verifies Help Desk Queue banner", actor.getName());
        actor.attemptsTo(
                WaitUntil.the(PublicDisplayPage.BANNER_HEADING, isVisible()).forNoMoreThan(30).seconds(),
                Ensure.that(PublicDisplayPage.BANNER_HEADING).isDisplayed(),
                Ensure.that(Text.of(PublicDisplayPage.BANNER_HEADING)).isEqualTo("Help Desk Queue"),
                Ensure.that(PublicDisplayPage.QUEUE_COUNT_LABEL).isDisplayed(),
                Ensure.that(PublicDisplayPage.QUEUE_COUNT_VALUE).isDisplayed()
        );
    }

    @Then("{actor} should see a non-negative queue count")
    public void should_see_a_non_negative_queue_count(Actor actor) {
        String countText = actor.asksFor(Text.of(PublicDisplayPage.QUEUE_COUNT_VALUE)).trim();
        LOGGER.info("Queue count text: '{}'", countText);
        int count = Integer.parseInt(countText);
        actor.attemptsTo(
                Ensure.that(count).isGreaterThanOrEqualTo(0)
        );
    }

    @Then("{actor} should see either the empty queue message or at least one queue card")
    public void should_see_either_empty_or_at_least_one_card(Actor actor) {
        boolean emptyShown = PublicDisplayPage.EMPTY_HEADING.resolveFor(actor).isCurrentlyVisible();
        boolean cardsShown = !PublicDisplayPage.QUEUE_CARDS.resolveAllFor(actor).isEmpty();
        LOGGER.info("emptyShown={}, cardsShown={}", emptyShown, cardsShown);
        actor.attemptsTo(
                Ensure.that(emptyShown || cardsShown).isTrue()
        );
    }
}
