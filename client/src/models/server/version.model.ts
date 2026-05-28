export interface VersionModel {
  version: string
  isNode: boolean
  os: string
  update: {
    synced: boolean
    updateAvailable: boolean
    airGapped: boolean
  }
}
