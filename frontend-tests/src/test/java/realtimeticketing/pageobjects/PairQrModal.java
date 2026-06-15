package realtimeticketing.pageobjects;

import net.serenitybdd.screenplay.targets.Target;
import org.openqa.selenium.By;

/**
 * QRGeneratorModal opened from the Dashboard's "Pair Device" button. The
 * modal renders the QR via canvas → dataURL on an <img alt="Pairing QR">,
 * and shows a "Scan this code on the iPad to pair" caption while pairing.
 */
public class PairQrModal {

    public static final Target SCAN_PROMPT = Target.the("Scan this code on the iPad caption")
            .located(By.xpath("//*[contains(normalize-space(.), 'Scan this code on the iPad to pair')]"));

    public static final Target QR_IMAGE = Target.the("Pairing QR image")
            .located(By.cssSelector("img[alt='Pairing QR']"));

    public static final Target CLOSE_BUTTON = Target.the("Close button on the pairing modal")
            .located(By.xpath("//button[normalize-space()='Close']"));

    public static final Target ERROR_MESSAGE = Target.the("Pairing modal error message")
            .located(By.xpath("//*[contains(@class,'text-[#D03E16]')]"));
}
