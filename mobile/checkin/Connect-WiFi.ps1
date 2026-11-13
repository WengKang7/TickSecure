param(
    [ValidateRange(1, 65535)][int]$ApachePort = 80,
    [switch]$AllowFirewall
)
$ErrorActionPreference = 'Stop'
if ($AllowFirewall) {
    # Run this opt-in step as Administrator on your trusted home/demo network.
    $ruleName = "TickSecure-Entry-WiFi-$ApachePort"
    if (-not (Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -Name $ruleName -DisplayName 'TickSecure Entry private Wi-Fi' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $ApachePort -RemoteAddress LocalSubnet -Profile Private -Program 'C:\xampp\apache\bin\httpd.exe' | Out-Null
    }
    Write-Host 'Apache allowed for the local subnet on Private networks only.'
}
Write-Host 'Connect the phone and PC to the same trusted Wi-Fi. Start XAMPP Apache.'
Write-Host 'This APK is configured for PC 192.168.100.104. Reserve that IP in your router for this PC.'
$portSuffix = if ($ApachePort -eq 80) { '' } else { ":$ApachePort" }
Write-Host "PC server address in the app: http://192.168.100.104${portSuffix}/ticksecure-ui"
Write-Host "APK download in the phone browser: http://192.168.100.104${portSuffix}/ticksecure-ui/downloads/ticksecure-entry-demo.apk"
Write-Host 'If blocked, use a Private Windows network profile on your trusted network, then run this script as Administrator with -AllowFirewall.'
Write-Host 'HTTP demo traffic is unencrypted. Use your own trusted Wi-Fi and test accounts. No router port forwarding is needed.'
