import { BaseService } from '@/backend/base.service'
import { ExportYamlModel } from '@/models/server/export-yaml.model'
import { downloadFileByBlob } from '@/utils/download-file.util'
import { getHttpClient } from '@/shared/http-client'

export class ServerPrivateService extends BaseService {
  public static async downloadYamlExport(input: ExportYamlModel) {
    const client = await getHttpClient()
    const response = await client.request<any>({
      method: 'POST',
      url: 'api/v2/server/yaml-export',
      data: input,
      responseType: 'arraybuffer'
    })
    downloadFileByBlob(
      response.data as ArrayBuffer,
      'export-prusahero-' + Date.now() + '.yaml'
    )
  }

  public static async uploadAndImportYaml(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return await this.postUpload(
      'api/v2/server/yaml-import',
      formData,
      {}
    )
  }

  public static async downloadLogDump() {
    const client = await getHttpClient()
    const response = await client.request<any>({
      method: 'POST',
      url: `api/v2/server/dump-prusahero-logs`,
      responseType: 'arraybuffer'
    })
    downloadFileByBlob(
      response.data as ArrayBuffer,
      'logs-prusahero-' + Date.now() + '.zip'
    )
  }

  public static async clearLogFilesOlderThanWeek() {
    const path = `api/v2/server/clear-outdated-prusahero-logs`
    return await this.delete(path)
  }
}
