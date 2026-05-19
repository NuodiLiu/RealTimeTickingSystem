package realtimeticketing.stepdefinitions;

import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import net.serenitybdd.screenplay.Actor;
import net.serenitybdd.screenplay.actions.Click;
import net.serenitybdd.screenplay.ensure.Ensure;
import net.serenitybdd.screenplay.matchers.WebElementStateMatchers;
import net.serenitybdd.screenplay.questions.Text;
import net.serenitybdd.screenplay.waits.WaitUntil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import realtimeticketing.pageobjects.DashboardPage;
import realtimeticketing.pageobjects.HeaderComponent;
import realtimeticketing.questions.CurrentUrl;

import static net.serenitybdd.screenplay.matchers.WebElementStateMatchers.isVisible;

public class DashboardStepDefinitions {

    private static final Logger LOGGER = LoggerFactory.getLogger(DashboardStepDefinitions.class);

    @Then("{actor} should see the three dashboard sections")
    public void should_see_the_three_dashboard_sections(Actor actor) {
        LOGGER.info("{} verifies the three dashboard sections are present", actor.getName());
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.QUEUE_SECTION_HEADING, isVisible()).forNoMoreThan(30).seconds(),
                Ensure.that(DashboardPage.QUEUE_SECTION_HEADING).isDisplayed(),
                Ensure.that(DashboardPage.ACTIVE_CASES_HEADING).isDisplayed(),
                Ensure.that(DashboardPage.DEVICES_HEADING).isDisplayed()
        );
    }

    @Then("{actor} should see the Take Next button")
    public void should_see_the_take_next_button(Actor actor) {
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.TAKE_NEXT_BUTTON, isVisible()).forNoMoreThan(15).seconds(),
                Ensure.that(DashboardPage.TAKE_NEXT_BUTTON).isDisplayed(),
                Ensure.that(Text.of(DashboardPage.TAKE_NEXT_BUTTON)).containsIgnoringCase("Take Next")
        );
    }

    @Then("{actor} should see a queue counter")
    public void should_see_a_queue_counter(Actor actor) {
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.QUEUE_COUNT_TEXT, isVisible()).forNoMoreThan(15).seconds(),
                Ensure.that(Text.of(DashboardPage.QUEUE_COUNT_TEXT)).matches("\\d+\\s+cases waiting")
        );
    }

    @Then("{actor} should see the device sublists for Feedback and Registration")
    public void should_see_the_device_sublists(Actor actor) {
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.FEEDBACK_DEVICES_HEADING, isVisible()).forNoMoreThan(15).seconds(),
                Ensure.that(DashboardPage.FEEDBACK_DEVICES_HEADING).isDisplayed(),
                Ensure.that(DashboardPage.REGISTRATION_DEVICES_HEADING).isDisplayed()
        );
    }

    @Then("{actor} should see the Pair Device button")
    public void should_see_the_pair_device_button(Actor actor) {
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.PAIR_DEVICE_BUTTON, isVisible()).forNoMoreThan(15).seconds(),
                Ensure.that(DashboardPage.PAIR_DEVICE_BUTTON).isDisplayed()
        );
    }

    @Then("{actor} should see the header with their name")
    public void should_see_the_header_with_their_name(Actor actor) {
        actor.attemptsTo(
                WaitUntil.the(HeaderComponent.HEADER, isVisible()).forNoMoreThan(15).seconds(),
                Ensure.that(HeaderComponent.USER_DROPDOWN_BUTTON).isDisplayed(),
                Ensure.that(HeaderComponent.LOGO_IMAGE).isDisplayed()
        );
    }

    @When("{actor} opens the user dropdown")
    public void opens_the_user_dropdown(Actor actor) {
        actor.attemptsTo(
                WaitUntil.the(HeaderComponent.USER_DROPDOWN_BUTTON, WebElementStateMatchers.isClickable())
                        .forNoMoreThan(15).seconds(),
                Click.on(HeaderComponent.USER_DROPDOWN_BUTTON)
        );
    }

    @Then("{actor} should see a Logout option")
    public void should_see_a_logout_option(Actor actor) {
        actor.attemptsTo(
                WaitUntil.the(HeaderComponent.LOGOUT_BUTTON, isVisible()).forNoMoreThan(10).seconds(),
                Ensure.that(HeaderComponent.LOGOUT_BUTTON).isDisplayed()
        );
    }

    @When("{actor} clicks the Logout option")
    public void clicks_the_logout_option(Actor actor) {
        actor.attemptsTo(Click.on(HeaderComponent.LOGOUT_BUTTON));
    }

    @Then("{actor} should be returned to the login page")
    public void should_be_returned_to_the_login_page(Actor actor) {
        actor.attemptsTo(
                Ensure.that(actor.asksFor(CurrentUrl.is())).contains("/login")
        );
    }

    @Then("{actor} should see the Export to Excel button")
    public void should_see_the_export_to_excel_button(Actor actor) {
        actor.attemptsTo(
                WaitUntil.the(HeaderComponent.EXPORT_TO_EXCEL_BUTTON, isVisible()).forNoMoreThan(15).seconds(),
                Ensure.that(HeaderComponent.EXPORT_TO_EXCEL_BUTTON).isDisplayed()
        );
    }

    @Then("{actor} should not see the Export to Excel button")
    public void should_not_see_the_export_to_excel_button(Actor actor) {
        actor.attemptsTo(
                Ensure.that(HeaderComponent.EXPORT_TO_EXCEL_BUTTON).isNotDisplayed()
        );
    }
}
