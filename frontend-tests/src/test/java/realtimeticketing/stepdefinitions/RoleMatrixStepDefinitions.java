package realtimeticketing.stepdefinitions;

import io.cucumber.java.en.Then;
import net.serenitybdd.screenplay.Actor;
import net.serenitybdd.screenplay.actors.OnStage;
import net.serenitybdd.screenplay.ensure.Ensure;
import net.serenitybdd.screenplay.targets.Target;
import net.serenitybdd.screenplay.waits.WaitUntil;
import org.openqa.selenium.By;
import realtimeticketing.pageobjects.DashboardPage;
import realtimeticketing.pageobjects.HeaderComponent;

import static net.serenitybdd.screenplay.matchers.WebElementStateMatchers.isVisible;

public class RoleMatrixStepDefinitions {

    @Then("the dashboard button {string} should be {word}")
    public void dashboard_button_visibility(String buttonName, String visibility) {
        Actor actor = OnStage.theActorInTheSpotlight();
        Target target = resolveButton(buttonName);
        boolean shouldBeVisible = visibility.equalsIgnoreCase("visible");
        if (shouldBeVisible) {
            actor.attemptsTo(
                    WaitUntil.the(target, isVisible()).forNoMoreThan(15).seconds(),
                    Ensure.that(target).isDisplayed()
            );
        } else {
            actor.attemptsTo(
                    Ensure.that(target).isNotDisplayed()
            );
        }
    }

    private Target resolveButton(String buttonName) {
        switch (buttonName) {
            case "TAKE NEXT":
                return DashboardPage.TAKE_NEXT_BUTTON;
            case "Pair Device":
                return DashboardPage.PAIR_DEVICE_BUTTON;
            case "Export to Excel":
                return HeaderComponent.EXPORT_TO_EXCEL_BUTTON;
            default:
                return Target.the("ad-hoc button " + buttonName)
                        .located(By.xpath("//button[normalize-space()='" + buttonName + "']"));
        }
    }
}
