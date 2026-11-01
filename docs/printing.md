# Printing

Kitchen tickets, bills, receipts and shift reports print with no dialog on ESC/POS thermal printers (Iware XS-80BT, 80 mm). The **cashier PC** is the print station: the POS running there prints the whole queue in the background, through a small **print agent** on the same PC.

```
Any tablet ─POST send─▶ API ─PrintJob per station (kitchen / bar / cashier)─▶ WS "print" stream
                                                                                    │
  Cashier PC: POS in Chrome (PrintRunner, on every screen) ◀────────────────────────┘
     ticket layout → ESC/POS bytes → print agent (127.0.0.1:9123) → printer → ACK printed / failed
```

## Why this design

- A browser cannot open a raw connection to a printer, and `window.print()` can't choose a printer per job. The agent is a tiny local program that can.
- A cloud API cannot reach printers on the outlet's LAN. The cashier PC sits on that LAN and pulls jobs over the WebSocket the API already has.
- The ticket layouts stay in the frontend (`features/printing/lib/tickets.ts`), so the on-screen preview is exactly what prints.

## Pieces

- **API:** `PrintJob` rows, routed by station (`backend/printing`). Receipts and bills go to `cashier`; kitchen and bar tickets by the category's station. Reprints are explicit and audited.
- **PrintRunner** (`features/printing/components/print-runner.tsx`): mounted for every signed-in screen. It runs only on the device switched on as the printer (**Print station → Cetak dari perangkat ini**) and only for a user with `print_station`. It prints queued jobs oldest first, one at a time, and acknowledges each one.
- **Device settings** (`features/printing/lib/device.ts`, saved in that browser): on/off, transport, agent address, stations printed here, each station's printer, cash drawer.
- **Transports** (`features/printing/lib/transport.ts`):
  - `AgentTransport`: the cashier PC. Sends bytes to the agent with the station's printer.
  - `PreviewTransport`: development and the demo site. Tickets only show on screen.
- **Print agent** (`print-agent/`): see its [README](../print-agent/README.md). LAN printers on port 9100, or Windows-shared USB printers.
- **Cash drawer:** cash receipts add the ESC/POS drawer pulse. The drawer plugs into the cashier printer (RJ-11).

## Failures

- **Agent not running** (not started yet, restarting): jobs stay queued and print by themselves once it answers again. The Print station page shows the agent as offline.
- **Printer unreachable or out of paper:** the job is marked failed with the reason. The Print station page shows it with **Coba lagi**.
- **Device turned off as printer:** the page says so. Jobs wait in the queue for the device that prints.

## Setting up the printers

1. Give each printer a fixed IP (a DHCP reservation on the router), e.g. kitchen `192.168.1.50`, cashier `192.168.1.51`.
2. On the cashier PC, open **Print station**:
   - turn on **Cetak dari perangkat ini**,
   - choose **Print agent**,
   - type each station's printer address and press **Cek**,
   - then **Tes** to print a test page.
3. A USB-only printer: share it in Windows and enter `share:<share name>` (see the agent README).

## Hardware notes

- 80 mm paper, 48 characters per line. Auto-cutter on.
- Keep the kitchen printer away from heat, grease and steam.
- Test the real printers before opening day. Codepage support for accented text varies.
