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
  /**
   * Parent origins we are allowed to communicate with.
   */
  #allowedOrigins: string[]

  constructor(
    public chainId: string,
    allowedParentOrigins: string[]
  ) {
    this.#allowedOrigins = allowedParentOrigins
  }

  async getAccounts(): Promise<readonly AccountData[]> {
    return callParentMethod<readonly AccountData[]>(
      {
        method: 'getAccounts',
        params: [],
        chainId: this.chainId,
        signerType: 'direct',
      },
      this.#allowedOrigins
    )
  }

  async signDirect(
    signerAddress: string,
    signDoc: DirectSignResponse['signed']
  ): Promise<DirectSignResponse> {
    return callParentMethod<DirectSignResponse>(
      {
        method: 'signDirect',
        params: [signerAddress, signDoc],
        chainId: this.chainId,
        signerType: 'direct',
      },
      this.#allowedOrigins
    )
  }
}

export class CosmiframeAminoSigner implements OfflineAminoSigner {
  /**
   * Parent origins we are allowed to communicate with.
   */
  #allowedOrigins: string[]

  constructor(
    public chainId: string,
    allowedParentOrigins: string[]
  ) {
    this.#allowedOrigins = allowedParentOrigins
  }

  async getAccounts(): Promise<readonly AccountData[]> {
    return callParentMethod<readonly AccountData[]>(
      {
        method: 'getAccounts',
        params: [],
        chainId: this.chainId,
        signerType: 'amino',
      },
      this.#allowedOrigins
    )
  }

  async signAmino(
    signerAddress: string,
    signDoc: StdSignDoc
  ): Promise<AminoSignResponse> {
    return callParentMethod<AminoSignResponse>(
      {
        method: 'signAmino',
        params: [signerAddress, signDoc],
        chainId: this.chainId,
        signerType: 'amino',
      },
      this.#allowedOrigins
    )
  }
}

export class CosmiframeEitherSigner
  implements OfflineDirectSigner, OfflineAminoSigner
{
  /**
   * Parent origins we are allowed to communicate with.
   */
  #allowedOrigins: string[]

  constructor(
    public chainId: string,
    allowedParentOrigins: string[]
  ) {
    this.#allowedOrigins = allowedParentOrigins
  }

  async getAccounts(): Promise<readonly AccountData[]> {
    // Try amino first, falling back to direct.
    try {
      return await callParentMethod<readonly AccountData[]>(
        {
          method: 'getAccounts',
          params: [],
          chainId: this.chainId,
          signerType: 'amino',
        },
        this.#allowedOrigins
      )
    } catch {
      return await callParentMethod<readonly AccountData[]>(
        {
          method: 'getAccounts',
          params: [],
          chainId: this.chainId,
          signerType: 'direct',
        },
        this.#allowedOrigins
      )
    }
  }

  async signDirect(
    signerAddress: string,
    signDoc: DirectSignResponse['signed']
  ): Promise<DirectSignResponse> {
    return callParentMethod<DirectSignResponse>(
      {
        method: 'signDirect',
        params: [signerAddress, signDoc],
        chainId: this.chainId,
        signerType: 'direct',
      },
      this.#allowedOrigins
    )
  }

  async signAmino(
    signerAddress: string,
    signDoc: StdSignDoc
  ): Promise<AminoSignResponse> {
    return callParentMethod<AminoSignResponse>(
      {
        method: 'signAmino',
        params: [signerAddress, signDoc],
        chainId: this.chainId,
        signerType: 'amino',
      },
      this.#allowedOrigins
    )
  }
}
