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

import { Origin } from './types'
import { callParentMethod } from './utils'

export class CosmiframeDirectSigner implements OfflineDirectSigner {
  /**
   * Parent origins we are allowed to communicate with.
   */
  #allowedOrigins: Origin[]

  constructor(
    public chainId: string,
    allowedParentOrigins: Origin[]
  ) {
    this.#allowedOrigins = allowedParentOrigins
  }

  async getAccounts(): Promise<readonly AccountData[]> {
    return (
      await callParentMethod<readonly AccountData[]>(
        {
          method: 'getAccounts',
          params: [],
          chainId: this.chainId,
          signerType: 'direct',
        },
        this.#allowedOrigins
      )
    ).result
  }

  async signDirect(
    signerAddress: string,
    signDoc: DirectSignResponse['signed']
  ): Promise<DirectSignResponse> {
    return (
      await callParentMethod<DirectSignResponse>(
        {
          method: 'signDirect',
          params: [signerAddress, signDoc],
          chainId: this.chainId,
          signerType: 'direct',
        },
        this.#allowedOrigins
      )
    ).result
  }
}

export class CosmiframeAminoSigner implements OfflineAminoSigner {
  /**
   * Parent origins we are allowed to communicate with.
   */
  #allowedOrigins: Origin[]

  constructor(
    public chainId: string,
    allowedParentOrigins: Origin[]
  ) {
    this.#allowedOrigins = allowedParentOrigins
  }

  async getAccounts(): Promise<readonly AccountData[]> {
    return (
      await callParentMethod<readonly AccountData[]>(
        {
          method: 'getAccounts',
          params: [],
          chainId: this.chainId,
          signerType: 'amino',
        },
        this.#allowedOrigins
      )
    ).result
  }

  async signAmino(
    signerAddress: string,
    signDoc: StdSignDoc
  ): Promise<AminoSignResponse> {
    return (
      await callParentMethod<AminoSignResponse>(
        {
          method: 'signAmino',
          params: [signerAddress, signDoc],
          chainId: this.chainId,
          signerType: 'amino',
        },
        this.#allowedOrigins
      )
    ).result
  }
}

export class CosmiframeEitherSigner
  implements OfflineDirectSigner, OfflineAminoSigner
{
  /**
   * Parent origins we are allowed to communicate with.
   */
  #allowedOrigins: Origin[]

  constructor(
    public chainId: string,
    allowedParentOrigins: Origin[]
  ) {
    this.#allowedOrigins = allowedParentOrigins
  }

  async getAccounts(): Promise<readonly AccountData[]> {
    // Try amino first, falling back to direct.
    try {
      return (
        await callParentMethod<readonly AccountData[]>(
          {
            method: 'getAccounts',
            params: [],
            chainId: this.chainId,
            signerType: 'amino',
          },
          this.#allowedOrigins
        )
      ).result
    } catch {
      return (
        await callParentMethod<readonly AccountData[]>(
          {
            method: 'getAccounts',
            params: [],
            chainId: this.chainId,
            signerType: 'direct',
          },
          this.#allowedOrigins
        )
      ).result
    }
  }

  async signDirect(
    signerAddress: string,
    signDoc: DirectSignResponse['signed']
  ): Promise<DirectSignResponse> {
    return (
      await callParentMethod<DirectSignResponse>(
        {
          method: 'signDirect',
          params: [signerAddress, signDoc],
          chainId: this.chainId,
          signerType: 'direct',
        },
        this.#allowedOrigins
      )
    ).result
  }

  async signAmino(
    signerAddress: string,
    signDoc: StdSignDoc
  ): Promise<AminoSignResponse> {
    return (
      await callParentMethod<AminoSignResponse>(
        {
          method: 'signAmino',
          params: [signerAddress, signDoc],
          chainId: this.chainId,
          signerType: 'amino',
        },
        this.#allowedOrigins
      )
    ).result
  }
}
