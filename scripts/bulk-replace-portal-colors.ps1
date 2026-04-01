$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$skip = @('node_modules', '.next')

$files = Get-ChildItem -LiteralPath $root -Recurse -Include *.tsx, *.ts, *.css -File |
  Where-Object {
    $p = $_.FullName
    foreach ($s in $skip) { if ($p -like "*\$s\*") { return $false } }
    $true
  }

$pairStrings = @(
  @('[var(--portal-accent)]', '[var(--portal-accent)]'),
  @('[var(--portal-accent-dark)]', '[var(--portal-accent-dark)]'),
  @('[var(--portal-accent-dark)]', '[var(--portal-accent-dark)]'),
  @('[var(--portal-accent-soft)]', '[var(--portal-accent-soft)]'),
  @('[var(--portal-accent-muted)]', '[var(--portal-accent-muted)]'),
  @('[var(--portal-accent-muted)]', '[var(--portal-accent-muted)]')
)

$literalStrings = @(
  @('stroke="#856B92"', 'stroke="#856B92"'),
  @('fill="#856B92"', 'fill="#856B92"'),
  @("background: 'linear-gradient(135deg, var(--portal-accent-soft) 0%, var(--portal-accent-muted) 100%)'", "background: 'linear-gradient(135deg, var(--portal-accent-soft) 0%, var(--portal-accent-muted) 100%)'"),
  @("background: 'linear-gradient(135deg, var(--portal-accent-soft) 0%, var(--portal-accent-muted) 50%, #F3E8FF 100%)'", "background: 'linear-gradient(135deg, var(--portal-accent-soft) 0%, var(--portal-accent-muted) 50%, #F3E8FF 100%)'"),
  @("borderColor: 'var(--portal-accent-muted)'", "borderColor: 'var(--portal-accent-muted)'"),
  @("color: 'var(--portal-accent-dark)'", "color: 'var(--portal-accent-dark)'"),
  @("backgroundColor: 'var(--portal-accent-soft)'", "backgroundColor: 'var(--portal-accent-soft)'"),
  @("borderColor: 'var(--portal-accent-soft)'", "borderColor: 'var(--portal-accent-soft)'")
)

$n = 0
foreach ($f in $files) {
  $c = [IO.File]::ReadAllText($f.FullName)
  $o = $c
  foreach ($pair in $pairStrings) { $c = $c.Replace($pair[0], $pair[1]) }
  foreach ($pair in $literalStrings) { $c = $c.Replace($pair[0], $pair[1]) }
  if ($c -ne $o) {
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [IO.File]::WriteAllText($f.FullName, $c, $utf8NoBom)
    $n++
  }
}
"updated $n files" | Out-File (Join-Path $PSScriptRoot 'bulk-replace-log.txt') -Encoding utf8
