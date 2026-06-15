package realtimeticketing.pageobjects;

import net.serenitybdd.screenplay.targets.Target;
import org.openqa.selenium.By;

public class PublicDisplayPage {

    public static final Target BANNER_HEADING = Target.the("Help Desk Queue banner heading")
            .located(By.xpath("//header//h1[normalize-space()='Help Desk Queue']"));

    public static final Target QUEUE_COUNT_LABEL = Target.the("'Students in Queue' label")
            .located(By.xpath("//header//*[normalize-space()='Students in Queue']"));

    public static final Target QUEUE_COUNT_VALUE = Target.the("queue count value")
            .located(By.xpath("//header//*[normalize-space()='Students in Queue']/following-sibling::*[1]"));

    public static final Target EMPTY_HEADING = Target.the("empty queue heading")
            .located(By.xpath("//*[normalize-space()='Queue is empty']"));

    public static final Target EMPTY_SUBTEXT = Target.the("empty queue subtext")
            .located(By.xpath("//*[normalize-space()='No students currently waiting']"));

    public static final Target QUEUE_CARDS = Target.the("queue cards")
            .locatedBy("//main//div[contains(@class,'rounded-lg') and contains(@class,'shadow-md')]");

    /** Card headings carry the student name (or "Student N" fallback). */
    public static final Target QUEUE_CARD_NAME_HEADINGS = Target.the("Queue card name headings")
            .locatedBy("//main//div[contains(@class,'rounded-lg') and contains(@class,'shadow-md')]//h3");

    public static Target queueCardForName(String studentName) {
        return Target.the("queue card containing " + studentName)
                .located(By.xpath("//main//div[contains(@class,'rounded-lg') and contains(@class,'shadow-md')][.//h3[contains(normalize-space(.), '" + studentName + "')]]"));
    }
}
