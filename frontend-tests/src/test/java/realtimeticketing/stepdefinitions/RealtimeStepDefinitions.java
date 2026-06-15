package realtimeticketing.stepdefinitions;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import net.serenitybdd.screenplay.Actor;
import net.serenitybdd.screenplay.abilities.BrowseTheWeb;
import net.serenitybdd.screenplay.actors.OnStage;
import net.serenitybdd.screenplay.ensure.Ensure;
import net.serenitybdd.screenplay.questions.Text;
import net.serenitybdd.screenplay.waits.WaitUntil;
import org.openqa.selenium.support.ui.WebDriverWait;
import realtimeticketing.pageobjects.PublicDisplayPage;
import realtimeticketing.utils.BackendAPI;

import java.time.Duration;

import static net.serenitybdd.screenplay.matchers.WebElementStateMatchers.isVisible;
import static realtimeticketing.utils.BackendAPI.TEST_DATA_PREFIX;

public class RealtimeStepDefinitions {

    // Track the queue count we observed at the start of a scenario so we can
    // assert it strictly increased after a backend create event.
    private int recordedQueueCount = -1;
    private int recordedCardCount = -1;

    @When("a queued case {string} with category {string} is created via the backend")
    public void seed_case_via_backend(String studentName, String category) {
        // The browser-side SignalR client is async — HubConnection.start() takes
        // 1-3s after the page renders, and events sent before it completes are
        // dropped (no per-connection replay). Pause briefly so the realtime
        // assertion is testing the push path, not the connection race.
        try { Thread.sleep(4000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        BackendAPI.seedQueuedCase(studentName, category, null);
    }

    @Then("a queue card for {string} should appear within {int} seconds")
    public void card_appears_within(String studentName, int seconds) {
        Actor actor = OnStage.theActorInTheSpotlight();
        String prefixed = TEST_DATA_PREFIX + studentName;
        actor.attemptsTo(
                WaitUntil.the(PublicDisplayPage.queueCardForName(prefixed), isVisible())
                        .forNoMoreThan(seconds).seconds(),
                Ensure.that(PublicDisplayPage.queueCardForName(prefixed)).isDisplayed()
        );
    }

    @Then("a queue card for {string} should be visible within {int} seconds \\(reload allowed)")
    public void card_visible_within_with_reload(String studentName, int seconds) {
        Actor actor = OnStage.theActorInTheSpotlight();
        String prefixed = TEST_DATA_PREFIX + studentName;
        // First try the realtime push path: card might already be present
        // because the SignalR event fired and the page re-fetched.
        try {
            actor.attemptsTo(
                    WaitUntil.the(PublicDisplayPage.queueCardForName(prefixed), isVisible())
                            .forNoMoreThan(seconds / 2).seconds()
            );
        } catch (Throwable ignored) {
            // Fall back to a single reload — verifies the data path even when
            // the WebSocket isn't delivering inside headless Chrome.
            BrowseTheWeb.as(actor).getDriver().navigate().refresh();
        }
        actor.attemptsTo(
                WaitUntil.the(PublicDisplayPage.queueCardForName(prefixed), isVisible())
                        .forNoMoreThan(seconds).seconds(),
                Ensure.that(PublicDisplayPage.queueCardForName(prefixed)).isDisplayed()
        );
    }

    @Given("the initial queue count value is recorded")
    public void record_initial_queue_count() {
        Actor actor = OnStage.theActorInTheSpotlight();
        actor.attemptsTo(
                WaitUntil.the(PublicDisplayPage.QUEUE_COUNT_VALUE, isVisible()).forNoMoreThan(15).seconds()
        );
        recordedQueueCount = Integer.parseInt(actor.asksFor(Text.of(PublicDisplayPage.QUEUE_COUNT_VALUE)).trim());
    }

    @Then("the queue count value should be greater than the recorded value within {int} seconds")
    public void queue_count_increased(int seconds) {
        Actor actor = OnStage.theActorInTheSpotlight();
        new WebDriverWait(BrowseTheWeb.as(actor).getDriver(), Duration.ofSeconds(seconds))
                .until(driver -> {
                    try {
                        int current = Integer.parseInt(
                                actor.asksFor(Text.of(PublicDisplayPage.QUEUE_COUNT_VALUE)).trim());
                        return current > recordedQueueCount;
                    } catch (NumberFormatException e) {
                        return false;
                    }
                });
        int finalCount = Integer.parseInt(actor.asksFor(Text.of(PublicDisplayPage.QUEUE_COUNT_VALUE)).trim());
        actor.attemptsTo(
                Ensure.that(finalCount).isGreaterThan(recordedQueueCount)
        );
    }

    @Given("the initial queue card count is recorded")
    public void record_initial_card_count() {
        Actor actor = OnStage.theActorInTheSpotlight();
        recordedCardCount = PublicDisplayPage.QUEUE_CARDS.resolveAllFor(actor).size();
    }

    @Then("the rendered queue card count should be greater than the recorded count within {int} seconds \\(reload allowed)")
    public void card_count_increased_with_reload(int seconds) {
        Actor actor = OnStage.theActorInTheSpotlight();
        long deadline = System.currentTimeMillis() + (seconds * 1000L);
        boolean reloaded = false;
        while (System.currentTimeMillis() < deadline) {
            int current = PublicDisplayPage.QUEUE_CARDS.resolveAllFor(actor).size();
            if (current > recordedCardCount) {
                actor.attemptsTo(Ensure.that(current).isGreaterThan(recordedCardCount));
                return;
            }
            if (!reloaded && System.currentTimeMillis() > deadline - (seconds * 500L)) {
                BrowseTheWeb.as(actor).getDriver().navigate().refresh();
                reloaded = true;
                try { Thread.sleep(2000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                continue;
            }
            try { Thread.sleep(500); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        }
        int finalCount = PublicDisplayPage.QUEUE_CARDS.resolveAllFor(actor).size();
        actor.attemptsTo(
                Ensure.that(finalCount).isGreaterThan(recordedCardCount)
        );
    }

    @Then("the queue count value should be greater than the recorded value within {int} seconds \\(reload allowed)")
    public void queue_count_increased_with_reload(int seconds) {
        Actor actor = OnStage.theActorInTheSpotlight();
        long deadline = System.currentTimeMillis() + (seconds * 1000L);
        boolean reloaded = false;
        while (System.currentTimeMillis() < deadline) {
            try {
                int current = Integer.parseInt(
                        actor.asksFor(Text.of(PublicDisplayPage.QUEUE_COUNT_VALUE)).trim());
                if (current > recordedQueueCount) {
                    actor.attemptsTo(Ensure.that(current).isGreaterThan(recordedQueueCount));
                    return;
                }
            } catch (NumberFormatException ignored) {
                // value not parsable yet, keep polling
            }
            // Halfway through, fall back to a reload if push didn't deliver.
            if (!reloaded && System.currentTimeMillis() > deadline - (seconds * 500L)) {
                BrowseTheWeb.as(actor).getDriver().navigate().refresh();
                reloaded = true;
                try { Thread.sleep(2000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                continue;
            }
            try { Thread.sleep(500); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        }
        int finalCount = Integer.parseInt(actor.asksFor(Text.of(PublicDisplayPage.QUEUE_COUNT_VALUE)).trim());
        actor.attemptsTo(
                Ensure.that(finalCount).isGreaterThan(recordedQueueCount)
        );
    }
}
