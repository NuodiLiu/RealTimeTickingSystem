package realtimeticketing.pageobjects;

import net.serenitybdd.screenplay.targets.Target;
import org.openqa.selenium.By;

/**
 * ExcelExportModal — opened from Header's "Export to Excel" button when
 * staff role is ADMIN. Shows date filters, a live preview row count, and
 * an export button that is disabled until a date range yields totalCases>0.
 */
public class ExcelExportModal {

    public static final Target HEADER = Target.the("Export Cases to Excel header")
            .located(By.xpath("//h2[normalize-space()='Export Cases to Excel']"));

    // The X button is in the modal header; scope by its proximity to the
    // modal heading to disambiguate from any other Close buttons on the page.
    public static final Target CLOSE_X_BUTTON = Target.the("Modal X close button")
            .located(By.xpath("//h2[normalize-space()='Export Cases to Excel']/ancestor::div[1]//button[@aria-label='Close']"));

    public static final Target CANCEL_BUTTON = Target.the("Modal Cancel button")
            .located(By.xpath("//button[normalize-space()='Cancel']"));

    // The header's "Export to Excel" trigger button uses plain text content;
    // the modal's footer button wraps the label in a <span>. Match only the
    // modal variant to avoid the always-enabled header button.
    public static final Target EXPORT_BUTTON = Target.the("Modal Export to Excel button")
            .located(By.xpath("//button[.//span[normalize-space()='Export to Excel']]"));

    public static final Target NO_FILTER_HINT = Target.the("Select filters hint in footer")
            .located(By.xpath("//*[normalize-space()='Select filters to see exportable data']"));
}
