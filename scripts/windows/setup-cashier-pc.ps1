<#
  Yi Ci Pang cashier PC: start the POS on the touchscreen and the customer
  display on the second monitor, both full-screen, every time Windows signs in.

  Run once in PowerShell (as the Windows user the cashier PC signs in with):

    powershell -ExecutionPolicy Bypass -File setup-cashier-pc.ps1 -Url https://pos.yicipang.example

  It creates shortcuts in that user's Startup folder:
    - "Yi Ci Pang POS"   Chrome kiosk on the main screen
    - "Yi Ci Pang Layar" Chrome kiosk on the second screen, at /display
    - "Yi Ci Pang Print Agent" the print agent (with -Agent), which sends
      kitchen tickets, bills and receipts to the printers

  With -Agent, put yicipang-print-agent.exe beside this script; it is copied
  to %LOCALAPPDATA%\YiCiPang\agent with an agent.json that only lets the POS
  address print.

  Each uses its own Chrome profile folder, which Chrome needs to run two
  kiosk windows on two screens. Run it again after changing the URL or
  moving the monitors; it replaces the shortcuts. -Remove deletes them.
#>
param(
  [Parameter(Mandatory = $true)][string]$Url,
  [switch]$Agent,
  [switch]$Remove
)

$ErrorActionPreference = "Stop"
$Url = $Url.TrimEnd("/")
$startup = [Environment]::GetFolderPath("Startup")
$profiles = Join-Path $env:LOCALAPPDATA "YiCiPang"
$posLink = Join-Path $startup "Yi Ci Pang POS.lnk"
$displayLink = Join-Path $startup "Yi Ci Pang Layar.lnk"
$agentLink = Join-Path $startup "Yi Ci Pang Print Agent.lnk"

if ($Remove) {
  Remove-Item $posLink, $displayLink, $agentLink -ErrorAction SilentlyContinue
  Write-Host "Removed the startup shortcuts."
  exit 0
}

$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw "Google Chrome is not installed. Install it first, then run this again." }

# Where the second monitor starts, so its window opens there.
Add-Type -AssemblyName System.Windows.Forms
$screens = [System.Windows.Forms.Screen]::AllScreens
$primary = $screens | Where-Object { $_.Primary } | Select-Object -First 1
$second = $screens | Where-Object { -not $_.Primary } | Select-Object -First 1
if (-not $second) {
  Write-Warning "Only one screen is connected. Set Windows to 'Extend these displays', then run this again."
}

# Flags both windows share: no first-run pages, no swipe-back, no pinch zoom on the touchscreen.
$common = "--no-first-run --no-default-browser-check --disable-pinch --overscroll-history-navigation=0 --disable-session-crashed-bubble"

$shell = New-Object -ComObject WScript.Shell
function New-Kiosk($path, $arguments, $description) {
  $link = $shell.CreateShortcut($path)
  $link.TargetPath = $chrome
  $link.Arguments = $arguments
  $link.Description = $description
  $link.WorkingDirectory = Split-Path $chrome
  $link.Save()
}

$posArgs = "$common --kiosk --kiosk-printing --user-data-dir=`"$profiles\pos`" " +
  "--window-position=$($primary.Bounds.X),$($primary.Bounds.Y) `"$Url/`""
New-Kiosk $posLink $posArgs "Yi Ci Pang POS (kiosk)"
Write-Host "POS: $posLink"

if ($second) {
  $displayArgs = "$common --kiosk --user-data-dir=`"$profiles\display`" " +
    "--window-position=$($second.Bounds.X),$($second.Bounds.Y) `"$Url/display`""
  New-Kiosk $displayLink $displayArgs "Yi Ci Pang customer display (kiosk)"
  Write-Host "Customer display: $displayLink (second screen at x=$($second.Bounds.X))"
}

if ($Agent) {
  $source = Join-Path $PSScriptRoot "yicipang-print-agent.exe"
  if (-not (Test-Path $source)) { throw "Put yicipang-print-agent.exe beside this script, then run it again." }
  $agentDir = Join-Path $profiles "agent"
  New-Item -ItemType Directory -Force -Path $agentDir | Out-Null
  Copy-Item $source (Join-Path $agentDir "yicipang-print-agent.exe") -Force
  # Only the POS may print through the agent.
  @{ port = 9123; allowedOrigins = @($Url) } | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $agentDir "agent.json")
  $link = $shell.CreateShortcut($agentLink)
  $link.TargetPath = Join-Path $agentDir "yicipang-print-agent.exe"
  $link.WorkingDirectory = $agentDir
  $link.WindowStyle = 7  # Minimised: it runs quietly in the taskbar.
  $link.Description = "Yi Ci Pang print agent"
  $link.Save()
  Write-Host "Print agent: $agentLink (http://127.0.0.1:9123)"

  # Newer Chrome asks before a website may reach this PC (the agent). Pre-allow the POS for
  # this Windows user, so the question never blocks the kiosk window. If Chrome still asks, choose Allow once.
  try {
    $policy = "HKCU:\Software\Policies\Google\Chrome\LocalNetworkAccessAllowedForUrls"
    New-Item -Force -Path $policy | Out-Null
    New-ItemProperty -Force -Path $policy -Name "1" -Value $Url -PropertyType String | Out-Null
    Write-Host "Chrome: $Url may reach the print agent."
  } catch {
    Write-Warning "Could not set the Chrome policy. If Chrome asks to allow local network access, choose Allow."
  }
}

Write-Host ""
Write-Host "Done. Sign out of Windows and back in (or restart) to start both screens."
Write-Host "To leave kiosk mode for maintenance: Alt+F4 closes the window."
