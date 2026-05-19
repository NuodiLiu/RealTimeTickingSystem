package realtimeticketing.utils;

import io.cucumber.datatable.DataTable;

import java.util.List;
import java.util.Map;

public final class DataTableUtils {

    private DataTableUtils() {
    }

    public static List<Map<String, String>> processDataTable(DataTable dataTable) {
        return dataTable.asMaps(String.class, String.class);
    }
}
