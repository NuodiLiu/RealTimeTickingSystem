package realtimeticketing.stepdefinitions;

import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import net.serenitybdd.screenplay.Actor;
import net.serenitybdd.screenplay.actions.Click;
import net.serenitybdd.screenplay.ensure.Ensure;
import net.serenitybdd.screenplay.matchers.WebElementStateMatchers;
import net.serenitybdd.screenplay.waits.WaitUntil;
import realtimeticketing.pageobjects.DashboardPage;
import realtimeticketing.pageobjects.PairQrModal;

import static net.serenitybdd.screenplay.matchers.WebElementStateMatchers.isNotCurrentlyVisible;
import static net.serenitybdd.screenplay.matchers.WebElementStateMatchers.isVisible;

public class DevicesStepDefinitions {

    @When("{actor} clicks the Pair Device button")
    public void clicks_pair_device_button(Actor actor) {
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.PAIR_DEVICE_BUTTON, WebElementStateMatchers.isClickable())
                        .forNoMoreThan(15).seconds(),
                Click.on(DashboardPage.PAIR_DEVICE_BUTTON)
        );
    }

    @Then("{actor} should see the pairing QR modal")
    public void should_see_pairing_qr_modal(Actor actor) {
        actor.attemptsTo(
                WaitUntil.the(PairQrModal.SCAN_PROMPT, isVisible()).forNoMoreThan(10).seconds(),
                Ensure.that(PairQrModal.SCAN_PROMPT).isDisplayed(),
                Ensure.that(PairQrModal.CLOSE_BUTTON).isDisplayed()
        );
    }

    @Then("{actor} should see a pairing QR image within {int} seconds")
    public void should_see_pairing_qr_image(Actor actor, int seconds) {
        actor.attemptsTo(
                WaitUntil.the(PairQrModal.QR_IMAGE, isVisible()).forNoMoreThan(seconds).seconds(),
                Ensure.that(PairQrModal.QR_IMAGE).isDisplayed()
        );
    }

    @When("{actor} clicks the Close button on the pairing modal")
    public void clicks_close_on_pairing_modal(Actor actor) {
        actor.attemptsTo(
                WaitUntil.the(PairQrModal.CLOSE_BUTTON, WebElementStateMatchers.isClickable())
                        .forNoMoreThan(10).seconds(),
                Click.on(PairQrModal.CLOSE_BUTTON)
        );
    }

    @Then("the pairing QR modal should no longer be visible")
    public void pairing_qr_modal_no_longer_visible() {
        Actor actor = net.serenitybdd.screenplay.actors.OnStage.theActorInTheSpotlight();
        actor.attemptsTo(
                WaitUntil.the(PairQrModal.SCAN_PROMPT, isNotCurrentlyVisible()).forNoMoreThan(5).seconds()
        );
    }
}
