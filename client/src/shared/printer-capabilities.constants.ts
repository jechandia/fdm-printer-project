import { PrusaLinkType } from './printer-types.constants'

export interface PrinterCapabilities {
  hasSerialConnection: boolean      // Can connect/disconnect via serial/USB
  canSyncName: boolean               // Can sync name from FDM Monster to printer
  hasWebInterface: boolean           // Has accessible web interface to redirect to
  hasEmergencyStop: boolean          // Has emergency/quick stop (more aggressive than normal stop)
  hasPrinterControl: boolean         // Can control printer remotely (pause, resume, etc.)
  /**
   * Whether the printer adapter exposes manual head movement (jog / home).
   * PrusaLink rejects these because the HTTP API has no equivalent endpoint,
   * so the printer-controls dialog hides the XY/Z pad instead of letting
   * the user trigger a 500.
   */
  hasManualMovement: boolean
}

const PRUSALINK_CAPABILITIES: PrinterCapabilities = {
  hasSerialConnection: false,
  canSyncName: false,
  hasWebInterface: true,
  hasEmergencyStop: false,
  hasPrinterControl: false,        // PrusaLink doesn't support remote control
  hasManualMovement: false         // No jog/home over PrusaLink's HTTP API
}

const CAPABILITIES_MAP: Record<number, PrinterCapabilities> = {
  [PrusaLinkType]: PRUSALINK_CAPABILITIES
}

export function hasSerialConnection(printerType: number): boolean {
  return CAPABILITIES_MAP[printerType]?.hasSerialConnection ?? false
}

export function canSyncName(printerType: number): boolean {
  return CAPABILITIES_MAP[printerType]?.canSyncName ?? false
}

export function hasWebInterface(printerType: number): boolean {
  return CAPABILITIES_MAP[printerType]?.hasWebInterface ?? false
}

export function hasEmergencyStop(printerType: number): boolean {
  return CAPABILITIES_MAP[printerType]?.hasEmergencyStop ?? false
}

export function hasPrinterControl(printerType: number): boolean {
  return CAPABILITIES_MAP[printerType]?.hasPrinterControl ?? false
}

export function hasManualMovement(printerType: number): boolean {
  return CAPABILITIES_MAP[printerType]?.hasManualMovement ?? false
}
