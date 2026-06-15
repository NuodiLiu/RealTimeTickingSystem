package realtimeticketing.pageobjects;

import net.serenitybdd.screenplay.targets.Target;
import org.openqa.selenium.By;

public class DashboardPage {

    public static final Target QUEUE_SECTION_HEADING = Target.the("Queue section heading")
            .located(By.xpath("//section//h2[normalize-space()='Queue']"));

    public static final Target QUEUE_COUNT_TEXT = Target.the("Queue count text")
            .located(By.xpath("//section[.//h2[normalize-space()='Queue']]//p[contains(., 'cases waiting')]"));

    public static final Target TAKE_NEXT_BUTTON = Target.the("Take Next button")
            .located(By.xpath("//button[normalize-space()='TAKE NEXT']"));

    public static final Target ACTIVE_CASES_HEADING = Target.the("My Active Cases section heading")
            .located(By.xpath("//h2[normalize-space()='My Active Cases']"));

    public static final Target DEVICES_HEADING = Target.the("iPad Devices section heading")
            .located(By.xpath("//section//h2[normalize-space()='iPad Devices']"));

    public static final Target PAIR_DEVICE_BUTTON = Target.the("Pair Device button")
            .located(By.xpath("//button[normalize-space()='Pair Device' or normalize-space()='Pair iPad']"));

    public static final Target FEEDBACK_DEVICES_HEADING = Target.the("Feedback Devices heading")
            .located(By.xpath("//h3[contains(., 'Feedback Devices')]"));

    public static final Target REGISTRATION_DEVICES_HEADING = Target.the("Registration Devices heading")
            .located(By.xpath("//h3[contains(., 'Registration Devices')]"));

    public static final Target QUEUE_EMPTY_LABEL = Target.the("Queue empty state label")
            .located(By.xpath("//section[.//h2[normalize-space()='Queue']]//*[contains(., 'No cases in queue')]"));

    public static final Target CASE_CARDS = Target.the("case cards in queue")
            .locatedBy("//section[.//h2[normalize-space()='Queue']]//*[@data-testid='case-card' or contains(@class,'case-card')]");

    // Empty-state messages (rendered by the shared EmptyState component as
    // dashed-border boxes containing the literal label text).
    public static final Target QUEUE_EMPTY_MESSAGE = Target.the("Queue empty state message")
            .located(By.xpath("//section[.//h2[normalize-space()='Queue']]//*[contains(normalize-space(.), 'No cases in queue')]"));

    public static final Target ACTIVE_CASES_EMPTY_MESSAGE = Target.the("Active cases empty state message")
            .located(By.xpath("//section[.//h2[normalize-space()='My Active Cases']]//*[contains(normalize-space(.), 'You have no active cases')]"));

    // Concrete row lookups by student name. Queue rows render the name in a
    // div, active rows in a similar layout - we scope by ancestor section to
    // be unambiguous.
    public static Target queueRowFor(String studentName) {
        return Target.the("queue row for " + studentName)
                .located(By.xpath("//section[.//h2[normalize-space()='Queue']]//div[contains(@class,'rounded-md') and contains(@class,'border')][.//div[contains(normalize-space(.), '" + studentName + "')]]"));
    }

    public static Target activeRowFor(String studentName) {
        return Target.the("active case row for " + studentName)
                .located(By.xpath("//section[.//h2[normalize-space()='My Active Cases']]//div[contains(@class,'rounded-md') and contains(@class,'border')][.//div[contains(normalize-space(.), '" + studentName + "')]]"));
    }

    public static Target queueTakeButtonFor(String studentName) {
        return Target.the("Queue row TAKE button for " + studentName)
                .located(By.xpath("//section[.//h2[normalize-space()='Queue']]//div[contains(@class,'rounded-md')][.//div[contains(normalize-space(.), '" + studentName + "')]]//button[normalize-space()='TAKE']"));
    }

    public static Target activeResolveButtonFor(String studentName) {
        return Target.the("Active row RESOLVE button for " + studentName)
                .located(By.xpath("//section[.//h2[normalize-space()='My Active Cases']]//div[contains(@class,'rounded-md')][.//div[contains(normalize-space(.), '" + studentName + "')]]//button[normalize-space()='RESOLVE' or normalize-space()='PROCESSING...']"));
    }

    public static Target activeEscalateButtonFor(String studentName) {
        return Target.the("Active row ESCALATE button for " + studentName)
                .located(By.xpath("//section[.//h2[normalize-space()='My Active Cases']]//div[contains(@class,'rounded-md')][.//div[contains(normalize-space(.), '" + studentName + "')]]//button[starts-with(normalize-space(.), 'ESCALATE')]"));
    }

    public static Target escalationOption(String studentName, String department) {
        return Target.the("Escalation option " + department + " for " + studentName)
                .located(By.xpath("//section[.//h2[normalize-space()='My Active Cases']]//div[contains(@class,'rounded-md')][.//div[contains(normalize-space(.), '" + studentName + "')]]//button[normalize-space()='" + department + "']"));
    }

    /**
     * Selectors for the iPad Devices section's individual device cards. The
     * deployed frontend renders the device name in an h3 inside a bordered
     * rounded-md div; once the data-testid additions ship, prefer those.
     */
    public static Target deviceCardByName(String deviceName) {
        return Target.the("device card for " + deviceName)
                .located(By.xpath("//section[.//h2[normalize-space()='iPad Devices']]//div[contains(@class,'rounded-md') and contains(@class,'border')][.//h3[contains(normalize-space(.), '" + deviceName + "')]]"));
    }

    /** The clickable inner div that fires onSelect. */
    public static Target deviceCardSelectArea(String deviceName) {
        return Target.the("device card select area for " + deviceName)
                .located(By.xpath("//section[.//h2[normalize-space()='iPad Devices']]//div[contains(@class,'rounded-md') and contains(@class,'border')][.//h3[contains(normalize-space(.), '" + deviceName + "')]]/div[contains(@class,'min-w-0') and contains(@class,'flex-1')]"));
    }

    public static Target deviceCardActionsButton(String deviceName) {
        return Target.the("device card '⋮' actions button for " + deviceName)
                .located(By.xpath("//section[.//h2[normalize-space()='iPad Devices']]//div[contains(@class,'rounded-md') and contains(@class,'border')][.//h3[contains(normalize-space(.), '" + deviceName + "')]]//button[@title='Device actions']"));
    }

    public static final Target DEVICE_ACTION_UNPAIR = Target.the("Unpair Device menu item")
            .located(By.xpath("//button[normalize-space()='Unpair Device']"));

    public static Target deviceActionSwitchTo(String mode) {
        return Target.the("Switch to " + mode + " menu item")
                .located(By.xpath("//button[normalize-space()='Switch to " + mode + "']"));
    }

    /**
     * "Override Device" confirmation button inside the react-hot-toast that
     * appears when Staff tries to send Feedback to a device already serving
     * another case. The toast also has a "Cancel" sibling.
     */
    public static final Target OVERRIDE_CONFIRM_BUTTON = Target.the("Override Device confirm button")
            .located(By.xpath("//button[normalize-space()='Override Device']"));

    public static final Target OVERRIDE_CANCEL_BUTTON = Target.the("Override Device cancel button")
            .located(By.xpath("//button[normalize-space()='Cancel'][../button[normalize-space()='Override Device']]"));

    public static Target activeFeedbackButtonFor(String studentName) {
        return Target.the("Active row FEEDBACK button for " + studentName)
                .located(By.xpath("//section[.//h2[normalize-space()='My Active Cases']]//div[contains(@class,'rounded-md')][.//div[contains(normalize-space(.), '" + studentName + "')]]//button[normalize-space()='FEEDBACK' or normalize-space()='PENDING' or normalize-space()='PROCESSING...']"));
    }

    /**
     * The Tooltip component renders into document.body via createPortal as a
     * dark-grey rounded element with pointer-events:none. It only appears
     * 500ms after mouseenter, so step definitions must wait.
     */
    public static final Target TOOLTIP_BUBBLE = Target.the("Tooltip bubble")
            .located(By.xpath("//div[contains(@class,'bg-gray-800') and contains(@class,'rounded')]"));

    public static Target escalatedBadgeFor(String studentName, String department) {
        return Target.the("Escalated badge for " + studentName + " -> " + department)
                .located(By.xpath("//section[.//h2[normalize-space()='My Active Cases']]//div[contains(@class,'rounded-md')][.//div[contains(normalize-space(.), '" + studentName + "')]]//span[contains(normalize-space(.), 'Escalated to " + department + "')]"));
    }
}
