# 402.inspector

A browser-based debugger for the [x402](https://www.x402.org/) payment protocol. Point it at an x402-protected endpoint, inspect the `402 Payment Required` challenge, sign a payment with your wallet, and replay the request — all while watching the raw request/response headers.

## Features

- Send `GET`/`POST`/`PUT`/`DELETE` requests to any x402 endpoint with custom headers and body.
- Inspect the full `402 Payment Required` challenge (payment requirements, decoded headers).
- Build and sign payment payloads with the official [`@x402`](https://www.npmjs.com/org/x402) client, which auto-selects the v1/v2 scheme.
- Connect an EVM wallet (EIP-712 signing) to authorize payments.
- View verbatim upstream response headers, including x402-specific ones (`payment-required`, `payment-response`, etc.).
- Live activity log of each step in the request/payment flow.

## Getting started

Requires Node.js >= 18.

```bash
pnpm install   # or npm install
pnpm start     # or npm start
```

Then open http://localhost:3000.
