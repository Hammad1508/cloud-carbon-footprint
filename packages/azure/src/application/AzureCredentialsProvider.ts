/*
 * © 2021 Thoughtworks, Inc.
 */

import {
  AzureCliCredential,  // ✅ Added for CLI authentication
  ClientCertificateCredential,
  ClientSecretCredential,
  DefaultAzureCredential,
  WorkloadIdentityCredential,
} from '@azure/identity'
import { SecretManagerServiceClient } from '@google-cloud/secret-manager'

import { configLoader } from '@cloud-carbon-footprint/common'

export default class AzureCredentialsProvider {
  static async create(): Promise<
    | AzureCliCredential
    | ClientCertificateCredential
    | ClientSecretCredential
    | WorkloadIdentityCredential
    | DefaultAzureCredential
  > {
    // ✅ Use Azure CLI authentication if enabled
    if (configLoader().AZURE.authentication.useCli) {
      console.log('🔹 Using Azure CLI authentication...')
      return new AzureCliCredential()
    }

    const clientId = configLoader().AZURE.authentication.clientId
    const clientSecret = configLoader().AZURE.authentication.clientSecret
    const tenantId = configLoader().AZURE.authentication.tenantId
    const certificatePath = configLoader().AZURE.authentication.certificatePath

    switch (configLoader().AZURE.authentication.mode) {
      case 'GCP':
        const clientIdFromGoogle = await this.getGoogleSecret(clientId)
        const clientSecretFromGoogle = await this.getGoogleSecret(clientSecret)
        const tenantIdFromGoogle = await this.getGoogleSecret(tenantId)
        return new ClientSecretCredential(
          tenantIdFromGoogle,
          clientIdFromGoogle,
          clientSecretFromGoogle,
        )
      case 'WORKLOAD_IDENTITY':
        return new WorkloadIdentityCredential({
          tenantId: tenantId,
          clientId: clientId,
        })
      case 'CERTIFICATE':
        return new ClientCertificateCredential(
          tenantId,
          clientId,
          certificatePath,
        )
      case 'MANAGED_IDENTITY':
        return new DefaultAzureCredential()
      default:
        return new ClientSecretCredential(tenantId, clientId, clientSecret)
    }
  }

  static async getGoogleSecret(secretName: string): Promise<string> {
    const client = new SecretManagerServiceClient()
    const name = `projects/${
      configLoader().GCP.BILLING_PROJECT_NAME
    }/secrets/${secretName}/versions/latest`

    const [version] = await client.accessSecretVersion({
      name: name,
    })
    return version.payload.data.toString()
  }
}
