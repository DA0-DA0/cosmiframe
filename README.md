# cosmiframe

Cosmiframe assists in establishing a Cosmos wallet connection through an iframe.
An outer (parent) window can act as a wallet for an iframe.

## Installation

```bash
npm install @dao-dao/cosmiframe @cosmjs/amino @cosmjs/proto-signing
```

## App integration

Integrating Cosmiframe to allow your app to be used inside iframes on other apps
is very straightforward. To retrieve an offline signer for use in a signing
client, which you would normally get from a wallet, get it from the `Cosmiframe`
client instead:

```ts
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { Cosmiframe } from '@dao-dao/cosmiframe'

const signer = new Cosmiframe().getOfflineSigner('cosmoshub-4')
const client = await SigningCosmWasmClient.connectWithSigner(
  'https://rpc...',
  signer
)

await client.sendTokens(...)
await client.execute(...)
```

If you are used to interacting with Keplr's interface, which is shared by many
wallets, you can retrieve a client that conforms to Keplr's interface and simply
proxies requests to the parent. Then, any parents that add support for functions
defined in Keplr's interface should be supported:

```ts
import { Cosmiframe } from '@dao-dao/cosmiframe'

const keplr = new Cosmiframe().getKeplrClient()

// Connect

await keplr.experimentalSuggestChain(...)
await keplr.enable('cosmoshub-4')
const key = await keplr.getKey('cosmoshub-4')

// Get signing client

const signer = await keplr.getOfflineSignerOnlyAmino('cosmoshub-4')
const client = await SigningCosmWasmClient.connectWithSigner(
  'https://rpc...',
  signer
)

await client.sendTokens(...)
await client.execute(...)
```

Because wallet interfaces vary slightly depending on wallet and adapter library,
it's up to the parent to properly support and redirect requests. Some parents
may pass requests directly through to a connected wallet, and some may handle
message signature requests manually, wrapping them with other messages.

## Example

This example allows an iframe to interact with Keplr connected in the parent.
The first step is performed in the parent app, and the second step is performed
in the iframe app.

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
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'
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
// the `getOfflineSigner`, `getOfflineSignerAmino`, and `getOfflineSignerDirect`
// functions, which wrap the proxy calls above and implements the necessary
// interfaces.
const directAndAminoSigner = cosmiframe.getOfflineSigner('cosmoshub-4')
const directSigner = cosmiframe.getOfflineSignerDirect('cosmoshub-4')
const aminoSigner = cosmiframe.getOfflineSignerAmino('cosmoshub-4')

const signingClient = await SigningCosmWasmClient.connectWithSigner(
  'https://rpc...',
  aminoSigner
)

// If you're familiar with Keplr's interface...
const keplr = cosmiframe.getKeplrClient()

await keplr.experimentalSuggestChain(...)
await keplr.enable('cosmoshub-4')
const key = await keplr.getKey('cosmoshub-4')
```
