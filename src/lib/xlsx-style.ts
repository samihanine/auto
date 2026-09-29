import type ExcelJS from "exceljs";
import type { FieldSchema, OptionColor } from "./schemas";

const ROW_HEIGHT = 28;
const COLUMN_WIDTH = 28;
const ID_WIDTH = 8;
const HEADER_FILL = "F3F4F6";
const BORDER = { style: "thin", color: { argb: "FFD1D5DB" } } as const;
/** Rows covered by validation/colors beyond the data, for rows added directly in Excel. */
const SPARE_ROWS = 1000;

/** Pastel fill + readable font, close to the app badges. */
const COLORS: Record<OptionColor, { fill: string; font: string }> = {
  cyan: { fill: "CFFAFE", font: "155E75" },
  green: { fill: "DCFCE7", font: "166534" },
  yellow: { fill: "FEF9C3", font: "854D0E" },
  red: { fill: "FEE2E2", font: "991B1B" },
  purple: { fill: "F3E8FF", font: "6B21A8" },
  blue: { fill: "DBEAFE", font: "1E40AF" },
  gray: { fill: "F3F4F6", font: "374151" },
  orange: { fill: "FFEDD5", font: "9A3412" },
  pink: { fill: "FCE7F3", font: "9D174D" },
  brown: { fill: "EFE3D3", font: "5C3D1E" },
  black: { fill: "1F2937", font: "FFFFFF" },
  white: { fill: "FFFFFF", font: "111827" },
  lime: { fill: "ECFCCB", font: "3F6212" },
  teal: { fill: "CCFBF1", font: "115E59" },
  indigo: { fill: "E0E7FF", font: "3730A3" },
  violet: { fill: "EDE9FE", font: "5B21B6" },
};

const quote = (text: string) => text.replace(/"/g, '""');

/** Uniform sizes, gray header, cell borders, option dropdowns and option colors. */
export function styleSheet(
  sheet: ExcelJS.Worksheet,
  headers: string[],
  columnOf: (header: string) => FieldSchema | undefined,
  rowCount: number,
) {
  const lastRow = rowCount + 1 + SPARE_ROWS;
  let priority = 0; // must be unique across the sheet
  for (let r = 1; r <= rowCount + 1; r++) sheet.getRow(r).height = ROW_HEIGHT;
  sheet.properties.defaultRowHeight = ROW_HEIGHT;

  headers.forEach((header, index) => {
    const excelColumn = sheet.getColumn(index + 1);
    const column = columnOf(header);
    excelColumn.width = column?.name === "id" ? ID_WIDTH : COLUMN_WIDTH;
    if (!column) return;

    excelColumn.alignment = { vertical: "middle", wrapText: column.dataType === "text" };
    if (column.dataType === "date") excelColumn.numFmt = "yyyy-mm-dd";
    if (column.dataType !== "option" || !column.options.length) return;

    const letter = excelColumn.letter;
    const range = `${letter}2:${letter}${lastRow}`;
    const names = column.options.map((option) => option.name);

    // Excel list sources are comma-separated and limited to 255 characters.
    const list = names.join(",");
    if (!names.some((name) => name.includes(",")) && list.length <= 255)
      // `dataValidations` exists at runtime but is missing from exceljs typings.
      (sheet as unknown as { dataValidations: { add: (range: string, v: ExcelJS.DataValidation) => void } }).dataValidations.add(range, {
        type: "list",
        allowBlank: true,
        formulae: [`"${quote(list)}"`],
        // Multiple values ("A; B") can't pass a list check: offer the dropdown without blocking.
        showErrorMessage: !column.multiple,
        errorTitle: "Invalid option",
        error: `Choose one of: ${names.join(", ")}`,
      });

    const cell = `$${letter}2`;
    sheet.addConditionalFormatting({
      ref: range,
      rules: column.options.map((option) => ({
        type: "expression",
        priority: ++priority,
        formulae: [
          column.multiple
            ? `ISNUMBER(SEARCH("; ${quote(option.name)};","; "&${cell}&";"))`
            : `${cell}="${quote(option.name)}"`,
        ],
        style: {
          fill: { type: "pattern", pattern: "solid", bgColor: { argb: `FF${COLORS[option.color].fill}` } },
          font: { color: { argb: `FF${COLORS[option.color].font}` } },
        },
      })),
    });
  });

  frameTable(sheet, headers.length, Math.max(rowCount, 1) + 1);
}

/** Light gray header and thin borders around every cell of the table. */
function frameTable(sheet: ExcelJS.Worksheet, columnCount: number, lastRow: number) {
  for (let row = 1; row <= lastRow; row++)
    for (let col = 1; col <= columnCount; col++) {
      const cell = sheet.getRow(row).getCell(col);
      cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
      if (row === 1)
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${HEADER_FILL}` } };
    }
}
