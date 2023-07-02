import { ClientDisplayableError, isErrorResponse, AsymmetricMessageServerHash } from '@standardnotes/responses'
import { AsymmetricMessageServerInterface } from '@standardnotes/api'

export class GetInboundAsymmetricMessages {
  constructor(private messageServer: AsymmetricMessageServerInterface) {}

  async execute(): Promise<AsymmetricMessageServerHash[] | ClientDisplayableError> {
    const response = await this.messageServer.getMessages()

    if (isErrorResponse(response)) {
      return ClientDisplayableError.FromError(response.data.error)
    }

    return response.data.messages
  }
}