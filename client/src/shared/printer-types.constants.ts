import prusaLinkLogo from '@/assets/prusa-link-logo.svg'

// Printer type constant. The fork only supports PrusaLink; the historical
// codes 0/1/3 (OctoPrint/Moonraker/Bambu) were stripped along with their
// backend adapters.
export const PrusaLinkType = 2

export function isPrusaLinkType(printerType?: number) {
  return printerType === PrusaLinkType
}

export function getPrinterTypeName(printerType?: number) {
  if (isPrusaLinkType(printerType)) {
    return 'PrusaLink'
  }
  return 'Unknown'
}

/**
 * Get the printer type logo based on file metadata.
 * Returns the PrusaLink logo for any recognised Prusa-family hardware; other
 * vendors are intentionally not represented in this fork.
 */
export function getPrinterTypeLogo(
  metadata: { printerModel?: string; [key: string]: any } | Record<string, any>,
  fileFormat?: string
): string | undefined {
  const printerModel = metadata?.printerModel?.toLowerCase() || ''

  if (
    printerModel.includes('prusa') ||
    printerModel.includes('mk3') ||
    printerModel.includes('mk4') ||
    printerModel.includes('mini') ||
    printerModel.includes('xl') ||
    printerModel.includes('core one') ||
    fileFormat === 'bgcode'
  ) {
    return prusaLinkLogo
  }

  return undefined
}

// Printer types array for dropdowns. Single-entry now that PrusaLink is the
// only supported vendor — kept as an array so existing call sites continue
// to iterate.
export const PRINTER_TYPES = [
  { name: getPrinterTypeName(PrusaLinkType), value: PrusaLinkType }
] as const
