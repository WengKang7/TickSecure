param(
    [string]$DeviceSerial,
    [int]$ApachePort = 80,
    [switch]$Install
)
$ErrorActionPreference = 'Stop'
$adbCandidates = @(
    (Join-Path $env:LOCALAPPDATA 'Android/Sdk/platform-tools/adb.exe')
)
$adbCommand = Get-Command adb -ErrorAction SilentlyContinue
$adbPath = if ($adbCommand) { $adbCommand.Source } else { $adbCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1 }
if (-not $adbPath) { throw 'Android platform-tools (adb) was not found. Install it using Android Studio SDK Manager.' }
$devices = @(& $adbPath devices)
if ($LASTEXITCODE -ne 0) { throw 'ADB could not list devices.' }
$ready = @($devices | Where-Object { $_ -match '^\S+\s+device$' } | ForEach-Object { ($_ -split '\s+')[0] })
if (-not $DeviceSerial) {
    if ($ready.Count -ne 1) { $devices | Write-Host; throw 'Connect one Android phone, enable USB debugging and approve this PC on the phone. For multiple devices use -DeviceSerial.' }
    $DeviceSerial = $ready[0]
}
if ($DeviceSerial -notin $ready) { throw 'The selected phone is not connected and authorized. Check its USB debugging prompt.' }
& $adbPath -s $DeviceSerial reverse tcp:8080 "tcp:$ApachePort"
if ($LASTEXITCODE -ne 0) { throw 'USB port forwarding failed.' }
Write-Host "USB ready: phone localhost:8080 -> PC Apache port $ApachePort"
if ($Install) {
    $apkPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../downloads/ticksecure-entry-demo.apk'))
    if (-not (Test-Path -LiteralPath $apkPath)) { throw "APK not found: $apkPath" }
    & $adbPath -s $DeviceSerial install -r $apkPath
    if ($LASTEXITCODE -ne 0) { throw 'APK installation failed. Check the phone for a permission prompt.' }
    Write-Host 'Installed. Open TickSecure Entry on your phone.'
}
Write-Host 'Keep XAMPP Apache running. Run this script again after reconnecting or restarting the phone.'
