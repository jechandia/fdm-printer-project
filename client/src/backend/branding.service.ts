import { BaseService } from '@/backend/base.service'
import { ServerApi } from '@/backend/server.api'

export type LogoFormat = 'png' | 'svg'

export interface BrandingLogoStatus {
  customLogoEnabled: boolean
  format: LogoFormat | null
  size: number | null
  uploadedAt: string | null
}

export class BrandingService extends BaseService {
  static async getStatus(): Promise<BrandingLogoStatus> {
    return this.get<BrandingLogoStatus>(ServerApi.brandingLogoRoute)
  }

  static async uploadLogo(file: File): Promise<BrandingLogoStatus> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await this.postUpload<FormData>(
      ServerApi.brandingLogoRoute,
      formData as unknown as FormData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return response.data as BrandingLogoStatus
  }

  static async deleteLogo(): Promise<BrandingLogoStatus> {
    return this.delete<BrandingLogoStatus>(ServerApi.brandingLogoRoute)
  }

  /** Stable URL for the source-of-truth logo file (for previews). */
  static getLogoFileUrl(cacheBust?: string | number): string {
    const url = `${ServerApi.brandingLogoRoute}/file`
    return cacheBust ? `${url}?v=${cacheBust}` : url
  }
}
