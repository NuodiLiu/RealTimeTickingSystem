package realtimeticketing.pageobjects;

import net.serenitybdd.screenplay.targets.Target;
import org.openqa.selenium.By;

public class HeaderComponent {

    public static final Target HEADER = Target.the("page header")
            .located(By.cssSelector("header"));

    public static final Target USER_DROPDOWN_BUTTON = Target.the("user dropdown trigger")
            .located(By.xpath("//header//button[contains(., 'Hello')]"));

    public static final Target USER_GREETING_NAME = Target.the("greeting name")
            .located(By.xpath("//header//button[contains(., 'Hello')]/span/b"));

    public static final Target LOGOUT_BUTTON = Target.the("logout button")
            .located(By.xpath("//header//button[normalize-space()='Logout']"));

    public static final Target EXPORT_TO_EXCEL_BUTTON = Target.the("Export to Excel button")
            .located(By.xpath("//header//button[normalize-space()='Export to Excel']"));

    public static final Target LOGO_IMAGE = Target.the("UNSW College logo")
            .located(By.cssSelector("header img[alt='UNSW College Logo']"));
}
