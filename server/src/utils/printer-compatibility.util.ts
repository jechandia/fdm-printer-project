import { type PrinterType, PrusaLinkType } from "@/services/printer-api.interface";
import type { FileFormatType } from "@/entities/print-job.entity";

/**
 * Compatibility matrix between file formats and printer types.
 *
 *   - `.gcode`  : plain text G-code, accepted by PrusaLink on the legacy Einsy
 *                 boards (MK3 / MK2.5).
 *   - `.bgcode` : Prusa binary G-code, only consumed by PrusaLink-flashed Buddy
 *                 firmware (MK4, MK3.9, XL, MINI+, Core One).
 */
const COMPATIBILITY: Record<FileFormatType, ReadonlyArray<PrinterType>> = {
  gcode: [PrusaLinkType],
  bgcode: [PrusaLinkType],
  // 3MF is a slicer container format (PrusaSlicer / BambuStudio); PrusaLink
  // can't print it directly. Kept here because the analysis pipeline still
  // recognises .3mf as a known file format.
  "3mf": [],
};

const PRINTER_TYPE_LABEL: Record<PrinterType, string> = {
  [PrusaLinkType]: "PrusaLink",
};

/**
 * Returns `true` when a printer of `printerType` is able to print a file of
 * `fileFormat`.
 */
export function isPrinterCompatibleWithFileFormat(
  printerType: PrinterType,
  fileFormat: FileFormatType | string | null | undefined,
): boolean {
  if (!fileFormat) return false;

  const allowed = COMPATIBILITY[fileFormat as FileFormatType];
  if (!allowed) return false;

  return allowed.includes(printerType);
}

/**
 * Returns a human-readable explanation when a printer and a file format are
 * incompatible, or `null` when they are compatible.
 */
export function getIncompatibilityReason(
  printerType: PrinterType,
  fileFormat: FileFormatType | string | null | undefined,
): string | null {
  if (!fileFormat) {
    return "File format is unknown — analyze the file before assigning it to a printer.";
  }

  if (!(fileFormat in COMPATIBILITY)) {
    return `Unsupported file format "${fileFormat}".`;
  }

  if (isPrinterCompatibleWithFileFormat(printerType, fileFormat)) {
    return null;
  }

  const accepted = COMPATIBILITY[fileFormat as FileFormatType].map((t) => PRINTER_TYPE_LABEL[t]).join(", ");
  const printerLabel = PRINTER_TYPE_LABEL[printerType] ?? `type ${printerType}`;
  return `Files in "${fileFormat}" format cannot be printed on a ${printerLabel} printer. Compatible printer types: ${accepted}.`;
}

/**
 * Returns the printer types able to accept a given file format.
 */
export function getCompatiblePrinterTypes(
  fileFormat: FileFormatType | string | null | undefined,
): ReadonlyArray<PrinterType> {
  if (!fileFormat) return [];
  return COMPATIBILITY[fileFormat as FileFormatType] ?? [];
}

/**
 * Returns the file formats a printer type can natively accept.
 */
export function getCompatibleFileFormats(printerType: PrinterType): FileFormatType[] {
  return (Object.keys(COMPATIBILITY) as FileFormatType[]).filter((fmt) => COMPATIBILITY[fmt].includes(printerType));
}

export { PRINTER_TYPE_LABEL };
