# Yi Ci Pang print agent

A small background program for the cashier PC. The POS (in Chrome) sends it each ticket as ESC/POS bytes, and it passes them to the printer: a LAN printer on raw port 9100, or a USB printer shared in Windows. A browser cannot open a raw connection to a printer; this program can.

```
POS in Chrome ──fetch──▶ http://127.0.0.1:9123 (agent) ──TCP :9100──▶ kitchen printer (LAN)
                                                      └─────────────▶ cashier printer (LAN, or \\localhost\SHARE for USB)
```

## Build

```bash
bun install            # nothing to install today; no dependencies
bun test               # agent tests with a stand-in printer
bun run build:win      # dist/yicipang-print-agent.exe (Windows x64, no runtime needed)
```

Run it locally with `bun run dev`.

## Install on the cashier PC

Put `yicipang-print-agent.exe` beside `scripts/windows/setup-cashier-pc.ps1` and run:

```powershell
powershell -ExecutionPolicy Bypass -File setup-cashier-pc.ps1 -Url https://pos.yicipang.example -Agent
```

That copies the agent to `%LOCALAPPDATA%\YiCiPang\agent`, writes its `agent.json`, and starts it (minimised) whenever Windows signs in. See [docs/cashier-pc-setup.md](../docs/cashier-pc-setup.md).

## Settings (`agent.json` beside the program)

```json
{ "port": 9123, "allowedOrigins": ["https://pos.yicipang.example"] }
```

- **allowedOrigins:** only these websites may print. Anything else is refused, so no other site can print on the outlet's printers. Command-line `--origin <url>` overrides it.
- **port:** where it listens, on `127.0.0.1` only.

## API

| Method | Path | Body | Answer |
|---|---|---|---|
| GET | `/status` | | `{ ok, version }` |
| POST | `/check` | `{ target }` | `{ ok }`, or 502 `{ ok: false, error }` when the printer can't be reached |
| POST | `/print` | `{ target, data }` (base64 ESC/POS) | `{ ok }`, or 502 `{ ok: false, error }` |

`target` is `{ "type": "tcp", "host": "192.168.1.50", "port": 9100 }` or `{ "type": "share", "name": "XS80" }`. Jobs for the same printer go one at a time, so tickets never interleave. It answers Chrome's private-network preflight (`Access-Control-Allow-Private-Network`).

## USB printers

Share the printer in Windows (**Printer properties → Sharing**, share name e.g. `XS80`), then set the station's printer to `share:XS80` on the Print station page. The agent writes the raw bytes to `\\localhost\XS80`. This depends on the printer's Windows driver passing raw data through, so test it on the real printer. A LAN connection is the more reliable choice: get the **USB + LAN** variant of the Iware XS-80BT.
