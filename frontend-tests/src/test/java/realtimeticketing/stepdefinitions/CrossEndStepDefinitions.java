package realtimeticketing.stepdefinitions;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import net.serenitybdd.screenplay.Actor;
import net.serenitybdd.screenplay.actions.Click;
import net.serenitybdd.screenplay.actors.OnStage;
import net.serenitybdd.screenplay.matchers.WebElementStateMatchers;
import net.serenitybdd.screenplay.waits.WaitUntil;
import realtimeticketing.kiosk.KioskApp;
import realtimeticketing.kiosk.KioskDriver;
import realtimeticketing.pageobjects.DashboardPage;
import realtimeticketing.utils.BackendAPI;

import java.time.Duration;

import static net.serenitybdd.screenplay.matchers.WebElementStateMatchers.isVisible;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class CrossEndStepDefinitions {

    /**
     * Holds the per-scenario kiosk driver so multiple steps can share it.
     * @After tag hook in {@link Hooks} closes the driver and wipes the
     * device row.
     */
    public static final class KioskContext {
        public KioskDriver driver;
        public KioskApp app;
        public String staffJwt;
        public String takenCaseId;
    }

    public static final ThreadLocal<KioskContext> CONTEXT = ThreadLocal.withInitial(KioskContext::new);

    @Given("a Feedback iPad simulator paired via the backend")
    public void pair_feedback_ipad() {
        KioskContext ctx = CONTEXT.get();
        ctx.driver = KioskDriver.launchWithPairedDevice("FEEDBACK");
        ctx.app = new KioskApp(ctx.driver.driver());
    }

    @Given("a Registration iPad simulator paired via the backend")
    public void pair_registration_ipad() {
        KioskContext ctx = CONTEXT.get();
        ctx.driver = KioskDriver.launchWithPairedDevice("REGISTRATION");
        ctx.app = new KioskApp(ctx.driver.driver());
    }

    @Then("the iPad should show the feedback cover within {int} seconds")
    public void ipad_shows_feedback_cover(int seconds) {
        KioskContext ctx = CONTEXT.get();
        boolean visible = ctx.app.isVisible(KioskApp.FEEDBACK_COVER_TITLE, Duration.ofSeconds(seconds));
        assertTrue(visible, "feedback.coverTitle not visible within " + seconds + "s");
    }

    @Given("a queued case {string} with category {string} exists")
    public void seed_case_exists(String studentName, String category) {
        BackendAPI.seedQueuedCase(studentName, category, null);
    }

    @When("the staff backend takes the next queued case")
    public void backend_takes_next_case() {
        KioskContext ctx = CONTEXT.get();
        if (ctx.staffJwt == null) ctx.staffJwt = BackendAPI.staffJwt("STAFF");
        ctx.takenCaseId = BackendAPI.takeNextCase(ctx.staffJwt);
    }

    @When("the staff backend sends feedback to the paired kiosk")
    public void backend_sends_feedback() {
        KioskContext ctx = CONTEXT.get();
        if (ctx.staffJwt == null) ctx.staffJwt = BackendAPI.staffJwt("STAFF");
        BackendAPI.sendFeedback(ctx.staffJwt, ctx.takenCaseId, ctx.driver.creds().deviceId);
    }

    @Then("the iPad should show the feedback form within {int} seconds")
    public void ipad_shows_feedback_form(int seconds) {
        KioskContext ctx = CONTEXT.get();
        boolean visible = ctx.app.isVisible(KioskApp.FEEDBACK_FORM_TITLE, Duration.ofSeconds(seconds));
        assertTrue(visible, "feedback.formTitle not visible within " + seconds + "s");
    }

    // ---------------------------------------------------------------------
    // Two-sided UI steps for the full feedback round-trip
    // ---------------------------------------------------------------------

    @When("Staff selects the paired test kiosk from the device list")
    public void staff_selects_paired_kiosk() {
        KioskContext ctx = CONTEXT.get();
        Actor actor = OnStage.theActorInTheSpotlight();
        String deviceName = ctx.driver.creds().deviceName;
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.deviceCardByName(deviceName), isVisible())
                        .forNoMoreThan(15).seconds(),
                Click.on(DashboardPage.deviceCardSelectArea(deviceName))
        );
    }

    @When("Staff clicks FEEDBACK on the active case for {string}")
    public void staff_clicks_feedback_on_active(String studentName) {
        Actor actor = OnStage.theActorInTheSpotlight();
        String prefixed = BackendAPI.TEST_DATA_PREFIX + studentName;
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.activeFeedbackButtonFor(prefixed), WebElementStateMatchers.isClickable())
                        .forNoMoreThan(15).seconds(),
                Click.on(DashboardPage.activeFeedbackButtonFor(prefixed))
        );
    }

    @When("the iPad rates {int} stars")
    public void ipad_rates_n_stars(int n) {
        KioskContext ctx = CONTEXT.get();
        ctx.app.tap(KioskApp.feedbackStar(n), Duration.ofSeconds(10));
    }

    @When("the iPad taps Submit Feedback")
    public void ipad_taps_submit() {
        KioskContext ctx = CONTEXT.get();
        ctx.app.tap(KioskApp.FEEDBACK_SUBMIT_BUTTON, Duration.ofSeconds(10));
    }

    @Then("the iPad should show the thank-you confirmation within {int} seconds")
    public void ipad_shows_thank_you(int seconds) {
        KioskContext ctx = CONTEXT.get();
        boolean visible = ctx.app.isVisible(KioskApp.FEEDBACK_THANK_YOU, Duration.ofSeconds(seconds));
        assertTrue(visible, "feedback.thankYou not visible within " + seconds + "s");
    }

    @When("the iPad taps Close on the feedback form")
    public void ipad_taps_close() {
        KioskContext ctx = CONTEXT.get();
        ctx.app.tap(KioskApp.FEEDBACK_CLOSE_BUTTON, Duration.ofSeconds(10));
        // Give the FEEDBACK_CANCELLED SignalR send time to round-trip before
        // the view tears down. vm.cancel() is fire-and-forget in a Task; the
        // simulator's WebSocket can stall under load if we don't wait.
        try { Thread.sleep(2000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }

    @Then("the backend should record case for {string} with status {word} within {int} seconds")
    public void backend_case_has_status(String studentName, String expectedStatus, int seconds) {
        KioskContext ctx = CONTEXT.get();
        if (ctx.staffJwt == null) ctx.staffJwt = BackendAPI.staffJwt("STAFF");
        String prefixed = BackendAPI.TEST_DATA_PREFIX + studentName;
        // The dashboard exposes case ids per status bucket; we don't know the
        // case id but we can locate it by name via the queued/in-progress
        // listings, then verify the bucket it ends up in matches.
        long deadline = System.currentTimeMillis() + (seconds * 1000L);
        String observed = null;
        while (System.currentTimeMillis() < deadline) {
            observed = BackendAPI.findCaseStatusByStudentName(ctx.staffJwt, prefixed);
            if (observed != null && observed.equalsIgnoreCase(expectedStatus)) return;
            try { Thread.sleep(1000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        }
        assertTrue(expectedStatus.equalsIgnoreCase(observed),
                "Expected case for " + studentName + " to be " + expectedStatus + " within " + seconds + "s, but was " + observed);
    }

    @Then("the active case for {string} should disappear from My Active Cases within {int} seconds")
    public void active_case_disappears(String studentName, int seconds) {
        Actor actor = OnStage.theActorInTheSpotlight();
        String prefixed = BackendAPI.TEST_DATA_PREFIX + studentName;
        // The dashboard's queue list refreshes via SignalR + polling; tolerate
        // both paths by polling the DOM until the active row is gone (or the
        // empty-state message appears).
        long deadline = System.currentTimeMillis() + (seconds * 1000L);
        while (System.currentTimeMillis() < deadline) {
            boolean stillThere = !DashboardPage.activeRowFor(prefixed).resolveAllFor(actor).isEmpty();
            if (!stillThere) return;
            try { Thread.sleep(1000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        }
        assertTrue(DashboardPage.activeRowFor(prefixed).resolveAllFor(actor).isEmpty(),
                "Active case for " + studentName + " did not disappear within " + seconds + "s");
    }

    @Then("the iPad should return to the feedback cover within {int} seconds")
    public void ipad_returns_to_cover(int seconds) {
        KioskContext ctx = CONTEXT.get();
        boolean visible = ctx.app.isVisible(KioskApp.FEEDBACK_COVER_TITLE, Duration.ofSeconds(seconds));
        assertTrue(visible, "feedback.coverTitle not visible within " + seconds + "s — kiosk did not return to cover after submit");
    }

    // ---------------------------------------------------------------------
    // QR pairing two-sided UI flow
    // ---------------------------------------------------------------------

    @Given("an unpaired Registration iPad simulator is on the pairing screen")
    public void unpaired_ipad_on_pairing_screen() {
        KioskContext ctx = CONTEXT.get();
        // Per-scenario name so multiple runs don't conflict and cleanup is scoped.
        String deviceName = "E2E_Kiosk_QRPair_" + java.util.UUID.randomUUID().toString().substring(0, 8);
        ctx.driver = KioskDriver.launchUnpaired(deviceName);
        ctx.app = new KioskApp(ctx.driver.driver());
        ctx.app.waitVisible(KioskApp.PAIRING_SCAN_BUTTON, Duration.ofSeconds(20));
    }

    @When("the iPad selects Registration mode")
    public void ipad_selects_registration_mode() {
        KioskContext ctx = CONTEXT.get();
        ctx.app.tap(KioskApp.PAIRING_MODE_REGISTRATION, Duration.ofSeconds(10));
    }

    @When("the iPad selects Feedback mode")
    public void ipad_selects_feedback_mode() {
        KioskContext ctx = CONTEXT.get();
        ctx.app.tap(KioskApp.PAIRING_MODE_FEEDBACK, Duration.ofSeconds(10));
    }

    @When("the iPad taps Scan QR Code to Pair")
    public void ipad_taps_scan_button() throws InterruptedException {
        KioskContext ctx = CONTEXT.get();
        ctx.app.tap(KioskApp.PAIRING_SCAN_BUTTON, Duration.ofSeconds(10));
        // Camera permission alert may appear on first launch; auto-accept.
        try {
            org.openqa.selenium.WebElement allow = ctx.driver.driver()
                    .findElement(io.appium.java_client.AppiumBy.iOSNsPredicateString(
                            "type == 'XCUIElementTypeButton' AND (label == 'OK' OR label == 'Allow' OR label == 'Allow While Using App')"));
            if (allow != null) allow.click();
        } catch (Exception ignored) {
            // permission already granted or no alert
        }
    }

    @When("the iPad taps Simulate QR Scan")
    public void ipad_taps_simulate_scan() {
        KioskContext ctx = CONTEXT.get();
        ctx.app.tap(io.appium.java_client.AppiumBy.accessibilityId("pairing.simulateScanButton"), Duration.ofSeconds(15));
    }

    @Then("the iPad should show the registration screen within {int} seconds")
    public void ipad_shows_registration_within(int seconds) {
        KioskContext ctx = CONTEXT.get();
        boolean visible = ctx.app.isVisible(KioskApp.REGISTRATION_TITLE, Duration.ofSeconds(seconds));
        assertTrue(visible, "registration.title not visible within " + seconds + "s after pairing");
    }

    // ---------------------------------------------------------------------
    // Registration flow (iPad fills form, staff queue receives the case)
    // ---------------------------------------------------------------------

    @When("the iPad enters student name {string} and zID {string}")
    public void ipad_enters_name_and_zid(String studentName, String zid) {
        KioskContext ctx = CONTEXT.get();
        org.openqa.selenium.WebElement zidField = ctx.app.waitVisible(KioskApp.REGISTRATION_ZID_FIELD, Duration.ofSeconds(15));
        zidField.click();
        zidField.sendKeys(zid);
        org.openqa.selenium.WebElement nameField = ctx.app.waitVisible(KioskApp.REGISTRATION_NAME_FIELD, Duration.ofSeconds(5));
        nameField.click();
        nameField.sendKeys(studentName);
    }

    @When("the iPad accepts the privacy policy")
    public void ipad_accepts_privacy() {
        KioskContext ctx = CONTEXT.get();
        ctx.app.tap(KioskApp.REGISTRATION_PRIVACY_CHECK, Duration.ofSeconds(10));
    }

    @When("the iPad taps Submit Registration")
    public void ipad_taps_submit_registration() {
        KioskContext ctx = CONTEXT.get();
        ctx.app.tap(KioskApp.REGISTRATION_SUBMIT_BUTTON, Duration.ofSeconds(10));
    }

    @Then("the iPad should show the registration success message within {int} seconds")
    public void ipad_shows_registration_success(int seconds) {
        KioskContext ctx = CONTEXT.get();
        boolean visible = ctx.app.isVisible(KioskApp.REGISTRATION_SUCCESS_TITLE, Duration.ofSeconds(seconds));
        assertTrue(visible, "registration.successTitle not visible within " + seconds + "s");
    }

    // ---------------------------------------------------------------------
    // Override flow (staff retargets a busy kiosk to a different case)
    // ---------------------------------------------------------------------

    @Then("the dashboard recognises the paired kiosk as busy within {int} seconds")
    public void dashboard_recognises_busy(int seconds) {
        KioskContext ctx = CONTEXT.get();
        if (ctx.staffJwt == null) ctx.staffJwt = BackendAPI.staffJwt("STAFF");
        boolean busy = BackendAPI.waitForDeviceBusy(ctx.staffJwt, ctx.driver.creds().deviceId, seconds);
        assertTrue(busy, "device " + ctx.driver.creds().deviceId + " did not reach BUSY state within " + seconds + "s");
    }

    @Then("Staff should see the Override Device confirmation")
    public void staff_sees_override_toast() {
        Actor actor = OnStage.theActorInTheSpotlight();
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.OVERRIDE_CONFIRM_BUTTON, WebElementStateMatchers.isClickable())
                        .forNoMoreThan(10).seconds()
        );
    }

    @When("Staff confirms the override")
    public void staff_confirms_override() {
        Actor actor = OnStage.theActorInTheSpotlight();
        actor.attemptsTo(Click.on(DashboardPage.OVERRIDE_CONFIRM_BUTTON));
    }

    @When("Staff cancels the override")
    public void staff_cancels_override() {
        Actor actor = OnStage.theActorInTheSpotlight();
        actor.attemptsTo(Click.on(DashboardPage.OVERRIDE_CANCEL_BUTTON));
    }

    // ---------------------------------------------------------------------
    // Unpair / mode-change two-sided UI flows
    // ---------------------------------------------------------------------

    @When("Staff opens the actions menu for the paired test kiosk")
    public void staff_opens_actions_menu() {
        Actor actor = OnStage.theActorInTheSpotlight();
        KioskContext ctx = CONTEXT.get();
        String deviceName = ctx.driver.creds().deviceName;
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.deviceCardActionsButton(deviceName), WebElementStateMatchers.isClickable())
                        .forNoMoreThan(15).seconds(),
                Click.on(DashboardPage.deviceCardActionsButton(deviceName))
        );
    }

    @When("Staff clicks Unpair Device on the menu")
    public void staff_clicks_unpair() {
        Actor actor = OnStage.theActorInTheSpotlight();
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.DEVICE_ACTION_UNPAIR, WebElementStateMatchers.isClickable())
                        .forNoMoreThan(10).seconds(),
                Click.on(DashboardPage.DEVICE_ACTION_UNPAIR)
        );
    }

    @When("Staff clicks Switch to {word} on the menu")
    public void staff_clicks_switch_to(String mode) {
        Actor actor = OnStage.theActorInTheSpotlight();
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.deviceActionSwitchTo(mode), WebElementStateMatchers.isClickable())
                        .forNoMoreThan(10).seconds(),
                Click.on(DashboardPage.deviceActionSwitchTo(mode))
        );
    }

    @Then("the iPad should return to the pairing screen within {int} seconds")
    public void ipad_returns_to_pairing(int seconds) {
        KioskContext ctx = CONTEXT.get();
        boolean visible = ctx.app.isVisible(KioskApp.PAIRING_SCAN_BUTTON, Duration.ofSeconds(seconds));
        assertTrue(visible, "pairing.scanButton not visible within " + seconds + "s — kiosk did not return to pairing screen after unpair");
    }

    @Then("the staff queue should list a case for {string} within {int} seconds")
    public void staff_queue_lists_case(String studentName, int seconds) {
        Actor actor = OnStage.theActorInTheSpotlight();
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.queueRowFor(studentName), isVisible())
                        .forNoMoreThan(seconds).seconds()
        );
    }

    /**
     * Actor-explicit variants of the queue/public-display assertions, needed
     * by the three-screen-sync scenario where StaffBrowser and Visitor are
     * separate actors each with their own ChromeDriver.
     */
    @io.cucumber.java.en.Then("{actor} should see a queue case for {string} within {int} seconds")
    public void actor_sees_queue_case(Actor actor, String studentName, int seconds) {
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.queueRowFor(studentName), isVisible())
                        .forNoMoreThan(seconds).seconds()
        );
    }

    @io.cucumber.java.en.Then("{actor} should see a queue card for {string} within {int} seconds")
    public void actor_sees_queue_card(Actor actor, String studentName, int seconds) {
        // Try the realtime push path first; if it doesn't deliver inside
        // headless Chrome (same WebSocket flakiness Section H mitigates),
        // fall back to a single page reload so we still verify backend ->
        // public-queue API -> render works end-to-end.
        org.openqa.selenium.support.ui.WebDriverWait wait =
                new org.openqa.selenium.support.ui.WebDriverWait(
                        net.serenitybdd.screenplay.abilities.BrowseTheWeb.as(actor).getDriver(),
                        Duration.ofSeconds(seconds / 2));
        try {
            wait.until(d -> !realtimeticketing.pageobjects.PublicDisplayPage
                    .queueCardForName(studentName).resolveAllFor(actor).isEmpty());
        } catch (Exception ignored) {
            net.serenitybdd.screenplay.abilities.BrowseTheWeb.as(actor).getDriver().navigate().refresh();
        }
        actor.attemptsTo(
                WaitUntil.the(realtimeticketing.pageobjects.PublicDisplayPage.queueCardForName(studentName), isVisible())
                        .forNoMoreThan(seconds).seconds()
        );
    }

    @Then("the staff dashboard should list the freshly paired test kiosk within {int} seconds")
    public void staff_sees_new_device(int seconds) {
        Actor actor = OnStage.theActorInTheSpotlight();
        KioskContext ctx = CONTEXT.get();
        String deviceName = ctx.driver.creds().deviceName;
        // Dashboard polls + SignalR pushes; either path resolves the card.
        actor.attemptsTo(
                WaitUntil.the(DashboardPage.deviceCardByName(deviceName), isVisible())
                        .forNoMoreThan(seconds).seconds()
        );
    }
}
