# cosmiframe

Cosmiframe assists in establishing a Cosmos wallet connection through an iframe.
An outer (parent) window can act as a wallet for an iframe.

## Installation

```bash
npm install @dao-dao/cosmiframe @cosmjs/amino @cosmjs/proto-signing
```

## Security

It is very important to trust the outer app, since supporting this functionality
opens up the possibility for the outer app to manipulate messages before asking
the user to sign them.

At the end of the day, everything still needs to be approved by a wallet, so a
malicious app wrapping your app only has so much power, but relying on user
intelligence as a line of defense is definitely not a good idea, especially
because most users don't have the tools to validate that the smart contract
messages they're seeing are correct.

Cosmiframe enforces security by requiring you to specify allowed origins in the
constructor on client instantiation (seen in the examples below). Though it's
possible to work around this, I urge you not to. I made it slightly harder than
just passing in `'*'` in the constructor, which is the best I can do (and I'm
not telling you how 😡). Don't be lazy and risk your user's money.

All requests verify origin on message sending and receiving, which should
automatically prevent any messages being sent to or received from an origin you
haven't explicitly allowed. If you want to perform an additional security check
which also validates that Cosmiframe is in fact listening from one of the
allowed origins, you can use `isReady` from the client.

```ts
import { Cosmiframe } from '@dao-dao/cosmiframe'

const client = new Cosmiframe([
  'https://daodao.zone',
  'https://dao.daodao.zone',
])

// If this is true, we know that:
// - The current app is being used in an iframe.
// - The parent window is running Cosmiframe.
// - The parent window is one of the allowed origins above.
const readyAndSafeToUse = await client.isReady()
```

## App integration

Integrating Cosmiframe to allow your app to be used inside iframes on another
app or apps is very straightforward. To retrieve an offline signer for use in a
signing client, which you would normally get from a wallet, get it from the
`Cosmiframe` client instead:

```ts
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { Cosmiframe } from '@dao-dao/cosmiframe'

const signer = new Cosmiframe([
  "https://daodao.zone",
  "https://dao.daodao.zone",
]).getOfflineSigner("cosmoshub-4")

const client = await SigningCosmWasmClient.connectWithSigner(
  'https://rpc...',
  signer
)

await client.sendTokens(...)
await client.execute(...)
```

If you are used to interacting with Keplr's interface (e.g. maybe you've created
a wallet adapter system based on Keplr's functions), which is shared by many
wallets, you can retrieve a client that conforms to Keplr's interface and simply
proxies requests to the parent. Then, any parent that adds support for functions
defined in Keplr's interface should be supported:

```ts
import { Cosmiframe } from '@dao-dao/cosmiframe'

const keplr = new Cosmiframe([
  "https://daodao.zone",
  "https://dao.daodao.zone",
]).getKeplrClient()

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

This example allows an iframe to interact with Keplr connected to DAO DAO (this
is unrelated to the Keplr-like client support mentioned above). The first step
is performed in the parent app (DAO DAO), and the second step is performed in
the iframe app.

1. Begin listening from the parent window:

```ts
import { Cosmiframe } from '@dao-dao/cosmiframe'

Cosmiframe.listen({
  iframe: document.getElementById('iframe'),
  target: window.keplr,
  getOfflineSignerDirect: window.keplr.getOfflineSigner.bind(window.keplr),
  getOfflineSignerAmino: window.keplr.getOfflineSignerOnlyAmino.bind(
    window.keplr
  ),
  // Pass some metadata for the iframe to display about the parent.
  metadata: {
    name: 'DAO DAO',
    imageUrl: 'https://daodao.zone/daodao.png',
  },
})
```

2. Request method calls from the iframe:

```ts
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { Cosmiframe } from '@dao-dao/cosmiframe'

const cosmiframe = new Cosmiframe([
  "https://daodao.zone",
  "https://dao.daodao.zone",
])

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
