# cosmiframe

Cosmiframe assists in establishing a Cosmos wallet connection through an iframe.
An outer (parent) window can act as a wallet for an iframe.

## Installation

```bash
npm install @dao-dao/cosmiframe @cosmjs/amino @cosmjs/proto-signing
```

## Usage

This example allows an iframe to interact with Keplr connected in the parent.

1. Begin listening from the parent window:

```ts
import { Cosmiframe } from '@dao-dao/cosmiframe'

const cosmiframe = new Cosmiframe()

cosmiframe.listen({
  iframe: document.getElementById('iframe'),
  target: window.keplr,
  getOfflineSignerDirect: window.keplr.getOfflineSigner.bind(window.keplr),
  getOfflineSignerAmino: window.keplr.getOfflineSignerOnlyAmino.bind(
    window.keplr
  ),
})
```

2. Request method calls from the iframe:

```ts
import { Cosmiframe } from '@dao-dao/cosmiframe'

const cosmiframe = new Cosmiframe()

// `cosmiframe.p` can be used to proxy any method call to the `target` set by
// the parent. This should call Keplr's `enable` function. This proxying only
// works for methods that accept and receive JSON-serializable parameters and
// results. Since most wallet messages are requests for signatures, this covers
// most cases.
await cosmiframe.p.enable('cosmoshub-4')

// In most cases, you will need an instance of an offline signer to pass to
// another signing client, such as SigningCosmWasmClient. This is done through
// the `getOfflineSignerAmino` and `getOfflineSignerDirect` functions, which
// wrap the proxy calls above and implements the necessary interfaces.
const directSigner = cosmiframe.getOfflineSignerDirect('cosmoshub-4')
const aminoSigner = cosmiframe.getOfflineSignerAmino('cosmoshub-4')

const signingClient = await SigningCosmWasmClient.connectWithSigner(
  'https://rpc...',
  directSigner
)
```
