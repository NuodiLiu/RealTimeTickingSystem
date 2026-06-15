package realtimeticketing.stepdefinitions;

import io.cucumber.java.After;
import io.cucumber.java.Before;
import net.serenitybdd.screenplay.actors.OnStage;
import net.serenitybdd.screenplay.actors.OnlineCast;
import realtimeticketing.utils.BackendAPI;

public class Hooks {

    @Before
    public void setTheStage() {
        OnStage.setTheStage(new OnlineCast());
    }

    // Wipe any previously-seeded E2E rows before and after scenarios tagged
    // @SeedsData. Pre-wipe protects against state leaked by a previous failed
    // run; post-wipe keeps the env clean for human inspection.
    @Before("@SeedsData")
    public void clearSeededBefore() {
        BackendAPI.clearTestCases();
    }

    @After("@SeedsData")
    public void clearSeededAfter() {
        BackendAPI.clearTestCases();
    }

    /**
     * @CrossEnd scenarios spin up an iOS simulator session via Appium that
     * must be released even on failure — otherwise WebDriverAgent stays
     * attached and the next run can't acquire the device.
     */
    @Before("@CrossEnd")
    public void clearCrossEndBefore() {
        BackendAPI.clearTestDevices();
    }

    @After("@CrossEnd")
    public void clearCrossEndAfter() {
        try {
            CrossEndStepDefinitions.KioskContext ctx = CrossEndStepDefinitions.CONTEXT.get();
            if (ctx.driver != null) {
                ctx.driver.close();
            }
        } finally {
            CrossEndStepDefinitions.CONTEXT.remove();
            BackendAPI.clearTestDevices();
        }
    }
}
