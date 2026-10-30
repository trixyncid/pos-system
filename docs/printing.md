# Printing

Kitchen tickets and receipts print with no dialog, on LAN ESC/POS printers. One Android tablet runs the app inside Capacitor as the **Print Station**.

```
Any tablet ─POST send─▶ API ─PrintJob(s) routed category→printer─▶ WS "print" stream
                                                                       │
            Android Print Station (Capacitor) ◀────────────────────────┘
              encoder → ESC/POS bytes → TCP :9100 → LAN printer → ACK printed / failed
```

## Why this design

- A browser cannot open a raw TCP socket, and iPad Safari has no Bluetooth API. `window.print()` always shows a dialog, and most thermal printers don't support AirPrint.
- A cloud API cannot reach a printer on the restaurant's LAN. The Print Station sits on that LAN and pulls jobs over the WebSocket the API already has.

## Pieces

- `PrintTransport` (frontend, M5): `connect()`, `print(bytes)`, `status()`.
  - `PreviewTransport`: renders the ticket on screen, used in dev and mock mode.
  - `CapacitorTcpTransport`: native raw socket on the Print Station (M10).
  - `WebBluetoothTransport`: optional, BLE printers on Android Chrome.
- Ticket templates (kitchen, bar, receipt, shift report) are pure functions that turn data into `@point-of-sale/receipt-printer-encoder` commands, so they can be unit tested.
- `PrintJob` rows are keyed by UUID. An unacknowledged job is retried, and reprints are explicit and audited.
- When the station misses heartbeats, every tablet shows a banner.

## Hardware notes

- Give each printer a fixed IP (a DHCP reservation on the router).
- Use 80mm paper for the kitchen. 58mm is fine for the snack bar receipt.
- Test with the actual printer models before rollout. Codepage support for Indonesian text varies.
