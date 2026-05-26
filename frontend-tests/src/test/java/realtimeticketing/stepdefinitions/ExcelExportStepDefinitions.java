package realtimeticketing.stepdefinitions;

import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import net.serenitybdd.screenplay.Actor;
import net.serenitybdd.screenplay.actions.Click;
import net.serenitybdd.screenplay.actors.OnStage;
import net.serenitybdd.screenplay.ensure.Ensure;
import net.serenitybdd.screenplay.matchers.WebElementStateMatchers;
import net.serenitybdd.screenplay.waits.WaitUntil;
import realtimeticketing.pageobjects.ExcelExportModal;
import realtimeticketing.pageobjects.HeaderComponent;

import static net.serenitybdd.screenplay.matchers.WebElementStateMatchers.isNotCurrentlyVisible;
import static net.serenitybdd.screenplay.matchers.WebElementStateMatchers.isVisible;

public class ExcelExportStepDefinitions {

    @When("{actor} clicks the Export to Excel button")
    public void clicks_export_button(Actor actor) {
        actor.attemptsTo(
                WaitUntil.the(HeaderComponent.EXPORT_TO_EXCEL_BUTTON, WebElementStateMatchers.isClickable())
                        .forNoMoreThan(15).seconds(),
                Click.on(HeaderComponent.EXPORT_TO_EXCEL_BUTTON)
        );
    }

    @Then("{actor} should see the Export Cases to Excel modal")
    public void should_see_export_modal(Actor actor) {
        actor.attemptsTo(
                WaitUntil.the(ExcelExportModal.HEADER, isVisible()).forNoMoreThan(10).seconds(),
                Ensure.that(ExcelExportModal.HEADER).isDisplayed(),
                Ensure.that(ExcelExportModal.CANCEL_BUTTON).isDisplayed()
        );
    }

    @Then("the export modal should hint that filters must be selected")
    public void hint_filters_required() {
        Actor actor = OnStage.theActorInTheSpotlight();
        actor.attemptsTo(
                WaitUntil.the(ExcelExportModal.NO_FILTER_HINT, isVisible()).forNoMoreThan(5).seconds(),
                Ensure.that(ExcelExportModal.NO_FILTER_HINT).isDisplayed()
        );
    }

    @Then("the Export to Excel modal button should be disabled")
    public void export_button_disabled() {
        Actor actor = OnStage.theActorInTheSpotlight();
        actor.attemptsTo(
                WaitUntil.the(ExcelExportModal.EXPORT_BUTTON, isVisible()).forNoMoreThan(5).seconds(),
                Ensure.that(ExcelExportModal.EXPORT_BUTTON).isDisabled()
        );
    }

    @When("{actor} clicks Cancel on the export modal")
    public void clicks_cancel(Actor actor) {
        actor.attemptsTo(
                WaitUntil.the(ExcelExportModal.CANCEL_BUTTON, WebElementStateMatchers.isClickable())
                        .forNoMoreThan(10).seconds(),
                Click.on(ExcelExportModal.CANCEL_BUTTON)
        );
    }

    @When("{actor} clicks the X close button on the export modal")
    public void clicks_x_close(Actor actor) {
        actor.attemptsTo(
                WaitUntil.the(ExcelExportModal.CLOSE_X_BUTTON, WebElementStateMatchers.isClickable())
                        .forNoMoreThan(10).seconds(),
                Click.on(ExcelExportModal.CLOSE_X_BUTTON)
        );
    }

    @Then("the export modal should no longer be visible")
    public void export_modal_dismissed() {
        Actor actor = OnStage.theActorInTheSpotlight();
        actor.attemptsTo(
                WaitUntil.the(ExcelExportModal.HEADER, isNotCurrentlyVisible()).forNoMoreThan(5).seconds()
        );
    }
}
