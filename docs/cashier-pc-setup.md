# Cashier PC setup

The cashier PC is a Windows touchscreen with a second, customer-facing monitor. After this setup it starts by itself: the POS on the touchscreen and the customer display on the second monitor, both full-screen (Chrome kiosk mode). All of it can be done in person or over AnyDesk.

## Before you start

- Google Chrome installed.
- Windows **Settings → System → Display → Multiple displays: Extend these displays**. Make the touchscreen the **main display**.
- The printers (Iware XS-80BT, USB + LAN variant) on the network with fixed IPs, e.g. kitchen `192.168.1.50` and cashier `192.168.1.51`. The cash drawer plugs into the cashier printer.
- The POS address, e.g. `https://pos.yicipang.example`.
- `yicipang-print-agent.exe` (built with `bun run build:win` in `print-agent/`).

## 1. Create the startup shortcuts

Copy `scripts/windows/setup-cashier-pc.ps1` and `yicipang-print-agent.exe` into one folder on the PC and run the script in PowerShell, signed in as the Windows user the PC uses every day:

```powershell
powershell -ExecutionPolicy Bypass -File setup-cashier-pc.ps1 -Url https://pos.yicipang.example -Agent
```

It finds both monitors and adds these shortcuts to that user's Startup folder:

| Shortcut | Opens | Notes |
|---|---|---|
| Yi Ci Pang POS | the POS, full-screen on the touchscreen | Prints the queue in the background through the agent |
| Yi Ci Pang Layar | `/display`, full-screen on the second monitor | Its own Chrome profile, which Chrome needs for a second kiosk window |
| Yi Ci Pang Print Agent | the print agent, minimised | Sends tickets to the printers. Only the POS address may use it |

Run it again after changing the address or moving the monitors. `-Remove` deletes the shortcuts.

## 2. Pair the customer display (once)

1. Restart, or double-click the shortcuts. The second monitor shows **Hubungkan layar pelanggan** and a six-digit code.
2. On the touchscreen, sign in as a cashier (or the owner), open the **account menu → Layar pelanggan**, type the code and tap **Hubungkan**.
3. The second monitor switches to the Yi Ci Pang welcome screen.

The pairing belongs to the PC, not to the staff member: it stays when cashiers change shifts. The owner can see and remove paired displays in **Pengaturan → Layar pelanggan**; a removed display shows a new code.

## 3. Set up the printers (once)

On the touchscreen, sign in as the owner or a cashier and open **Print station**:

1. Turn on **Cetak dari perangkat ini** (only on this PC).
2. Choose **Print agent**. Its status should say **Siap**.
3. Turn on **Dapur** and **Kasir** (and **Bar** if the bar has its own printer). Type each printer's IP and press **Cek**.
4. Press **Tes** for each station: a test page prints.
5. Leave **Buka laci kas untuk struk tunai** on, so cash receipts open the drawer.

From then on, kitchen tickets, bills and receipts print in the background whatever screen is open. If Chrome ever asks to allow access to devices on the local network, choose **Allow**. Printing details: [printing.md](printing.md).

## What the customer sees

- **Idle:** the logo and a welcome.
- **Snack bar:** each scanned or tapped item appears as it is added, with the running total.
- **Restaurant checkout:** the table's bill (items, options, discount, service, PBJT, total, and what this guest pays now when the bill is split).
- **Paid:** "Terima kasih", the amount paid and the change, then back to the welcome.

## Windows settings worth doing

- **Sign in automatically** to the daily user, so a restart lands straight in the POS.
- **BIOS: Restore on AC power loss → Power On**, so the PC starts again after a power cut.
- A **UPS** for the PC and router.
- Router: a **fixed IP** (DHCP reservation) for the kitchen printer.
- **AnyDesk** with unattended access, two-factor login on your account, and only your ID allowed.

## Maintenance

- **Alt+F4** closes a kiosk window (with a keyboard, or over AnyDesk). Double-click its Startup shortcut, or restart, to open it again.
- App updates arrive by themselves: the page loads the latest version from the server.
- If the customer display shows **Menyambung ulang…**, it reconnects on its own once the network is back.

## Other devices (PWA)

On the owner's phone or laptop, and on waiter tablets, open the POS address in Chrome and choose **Install app** (or **Add to Home screen**). It opens in its own window with the Yi Ci Pang icon. Opening `/display` on a tablet and installing it gives a stand-alone customer display (for example facing the snack bar counter); pair it the same way.
