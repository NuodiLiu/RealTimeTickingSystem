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
}
