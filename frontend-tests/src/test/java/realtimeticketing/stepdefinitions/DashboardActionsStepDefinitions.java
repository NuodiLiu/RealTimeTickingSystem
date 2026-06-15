package realtimeticketing.stepdefinitions;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import net.serenitybdd.screenplay.Actor;
import net.serenitybdd.screenplay.actions.Click;
import net.serenitybdd.screenplay.ensure.Ensure;
import net.serenitybdd.screenplay.matchers.WebElementStateMatchers;
import net.serenitybdd.screenplay.waits.WaitUntil;
import realtimeticketing.pageobjects.DashboardPage;
import realtimeticketing.tasks.NavigateTo;
import realtimeticketing.utils.BackendAPI;

import static net.serenitybdd.screenplay.matchers.WebElementStateMatchers.isNotCurrentlyVisible;
import static net.serenitybdd.screenplay.matchers.WebElementStateMatchers.isVisible;

import static realtimeticketing.utils.BackendAPI.TEST_DATA_PREFIX;

public class DashboardActionsStepDefinitions {

    @Given("the test-case queue has been cleared")
    public void the_test_case_queue_has_been_cleared() {
        BackendAPI.clearTestCases();
    }

    @Given("a queued case {string} with category {string}")
    public void a_queued_case_with_category(String studentName, String category) {
        BackendAPI.seedQueuedCase(studentName, category, null);
    }

    @Given("Staff reloads the dashboard")
    public void staff_reloads_the_dashboard() {
        Actor actor = net.serenitybdd.screenplay.actors.OnStage.theActorInTheSpotlight();
        actor.attemptsTo(NavigateTo.theDashboardPage());
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.QUEUE_SECTION_HEADING, isVisible()).forNoMoreThan(30).seconds()
        );
    }

    @Then("{actor} should see the empty-queue message")
    public void should_see_the_empty_queue_message(Actor actor) {
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.QUEUE_EMPTY_MESSAGE, isVisible()).forNoMoreThan(15).seconds(),
                Ensure.that(DashboardPage.QUEUE_EMPTY_MESSAGE).isDisplayed()
        );
    }

    @Then("{actor} should see the empty active-cases message")
    public void should_see_the_empty_active_cases_message(Actor actor) {
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.ACTIVE_CASES_EMPTY_MESSAGE, isVisible()).forNoMoreThan(15).seconds(),
                Ensure.that(DashboardPage.ACTIVE_CASES_EMPTY_MESSAGE).isDisplayed()
        );
    }

    @When("{actor} clicks TAKE NEXT")
    public void clicks_take_next(Actor actor) {
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.TAKE_NEXT_BUTTON, WebElementStateMatchers.isClickable())
                        .forNoMoreThan(15).seconds(),
                Click.on(DashboardPage.TAKE_NEXT_BUTTON)
        );
    }

    @When("{actor} clicks TAKE on the queue card for {string}")
    public void clicks_take_for(Actor actor, String studentName) {
        String prefixed = TEST_DATA_PREFIX + studentName;
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.queueTakeButtonFor(prefixed), WebElementStateMatchers.isClickable())
                        .forNoMoreThan(15).seconds(),
                Click.on(DashboardPage.queueTakeButtonFor(prefixed))
        );
    }

    @Then("{string} should appear in My Active Cases")
    public void should_appear_in_my_active_cases(String studentName) {
        Actor actor = net.serenitybdd.screenplay.actors.OnStage.theActorInTheSpotlight();
        String prefixed = TEST_DATA_PREFIX + studentName;
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.activeRowFor(prefixed), isVisible()).forNoMoreThan(15).seconds(),
                Ensure.that(DashboardPage.activeRowFor(prefixed)).isDisplayed()
        );
    }

    @Then("{string} should no longer be in My Active Cases")
    public void should_not_be_in_my_active_cases(String studentName) {
        Actor actor = net.serenitybdd.screenplay.actors.OnStage.theActorInTheSpotlight();
        String prefixed = TEST_DATA_PREFIX + studentName;
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.activeRowFor(prefixed), isNotCurrentlyVisible()).forNoMoreThan(15).seconds()
        );
    }

    @Then("{string} should no longer be in the Queue")
    public void should_not_be_in_queue(String studentName) {
        Actor actor = net.serenitybdd.screenplay.actors.OnStage.theActorInTheSpotlight();
        String prefixed = TEST_DATA_PREFIX + studentName;
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.queueRowFor(prefixed), isNotCurrentlyVisible()).forNoMoreThan(15).seconds()
        );
    }

    @Then("{string} should still be in the Queue")
    public void should_still_be_in_queue(String studentName) {
        Actor actor = net.serenitybdd.screenplay.actors.OnStage.theActorInTheSpotlight();
        String prefixed = TEST_DATA_PREFIX + studentName;
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.queueRowFor(prefixed), isVisible()).forNoMoreThan(15).seconds(),
                Ensure.that(DashboardPage.queueRowFor(prefixed)).isDisplayed()
        );
    }

    @When("{actor} clicks RESOLVE on the active case for {string}")
    public void clicks_resolve_for(Actor actor, String studentName) {
        String prefixed = TEST_DATA_PREFIX + studentName;
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.activeResolveButtonFor(prefixed), WebElementStateMatchers.isClickable())
                        .forNoMoreThan(15).seconds(),
                Click.on(DashboardPage.activeResolveButtonFor(prefixed))
        );
    }

    @When("{actor} opens the escalation dropdown for {string}")
    public void opens_escalation_dropdown_for(Actor actor, String studentName) {
        String prefixed = TEST_DATA_PREFIX + studentName;
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.activeEscalateButtonFor(prefixed), WebElementStateMatchers.isClickable())
                        .forNoMoreThan(15).seconds(),
                Click.on(DashboardPage.activeEscalateButtonFor(prefixed))
        );
    }

    @When("{actor} selects {string} as the escalation department for {string}")
    public void selects_escalation_department(Actor actor, String department, String studentName) {
        String prefixed = TEST_DATA_PREFIX + studentName;
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.escalationOption(prefixed, department), WebElementStateMatchers.isClickable())
                        .forNoMoreThan(10).seconds(),
                Click.on(DashboardPage.escalationOption(prefixed, department))
        );
    }

    @Then("the active case for {string} should show the badge {string}")
    public void active_case_should_show_badge(String studentName, String badgeText) {
        Actor actor = net.serenitybdd.screenplay.actors.OnStage.theActorInTheSpotlight();
        String prefixed = TEST_DATA_PREFIX + studentName;
        // Extract the department from the expected badge text "Escalated to X"
        String department = badgeText.replaceFirst("(?i)^Escalated to ", "").trim();
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.escalatedBadgeFor(prefixed, department), isVisible()).forNoMoreThan(10).seconds(),
                Ensure.that(DashboardPage.escalatedBadgeFor(prefixed, department)).isDisplayed()
        );
    }
}
