import {
  AminoSignResponse,
  OfflineAminoSigner,
  StdSignDoc,
} from '@cosmjs/amino'
import {
  AccountData,
  DirectSignResponse,
  OfflineDirectSigner,
} from '@cosmjs/proto-signing'

import { callParentMethod } from './utils'

export class CosmiframeDirectSigner implements OfflineDirectSigner {
  constructor(public chainId: string) {}

  async getAccounts(): Promise<readonly AccountData[]> {
    return callParentMethod<readonly AccountData[]>({
      method: 'getAccounts',
      params: [],
      chainId: this.chainId,
      signerType: 'direct',
    })
  }

  async signDirect(
    signerAddress: string,
    signDoc: DirectSignResponse['signed']
  ): Promise<DirectSignResponse> {
    return callParentMethod<DirectSignResponse>({
      method: 'signDirect',
      params: [signerAddress, signDoc],
      chainId: this.chainId,
      signerType: 'direct',
    })
  }
}

export class CosmiframeAminoSigner implements OfflineAminoSigner {
  constructor(public chainId: string) {}

  async getAccounts(): Promise<readonly AccountData[]> {
    return callParentMethod<readonly AccountData[]>({
      method: 'getAccounts',
      params: [],
      chainId: this.chainId,
      signerType: 'amino',
    })
  }

  async signAmino(
    signerAddress: string,
    signDoc: StdSignDoc
  ): Promise<AminoSignResponse> {
    return callParentMethod<AminoSignResponse>({
      method: 'signAmino',
      params: [signerAddress, signDoc],
      chainId: this.chainId,
      signerType: 'amino',
    })
  }
}

export class CosmiframeEitherSigner
  implements OfflineDirectSigner, OfflineAminoSigner
{
  constructor(public chainId: string) {}

  async getAccounts(): Promise<readonly AccountData[]> {
    // Try amino first, falling back to direct.
    try {
      return await callParentMethod<readonly AccountData[]>({
        method: 'getAccounts',
        params: [],
        chainId: this.chainId,
        signerType: 'amino',
      })
    } catch {
      return await callParentMethod<readonly AccountData[]>({
        method: 'getAccounts',
        params: [],
        chainId: this.chainId,
        signerType: 'direct',
      })
    }
  }

  async signDirect(
    signerAddress: string,
    signDoc: DirectSignResponse['signed']
  ): Promise<DirectSignResponse> {
    return callParentMethod<DirectSignResponse>({
      method: 'signDirect',
      params: [signerAddress, signDoc],
      chainId: this.chainId,
      signerType: 'direct',
    })
  }

  async signAmino(
    signerAddress: string,
    signDoc: StdSignDoc
  ): Promise<AminoSignResponse> {
    return callParentMethod<AminoSignResponse>({
      method: 'signAmino',
      params: [signerAddress, signDoc],
      chainId: this.chainId,
      signerType: 'amino',
    })
  }
}
