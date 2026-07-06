$artifactDir = 'C:\Users\craig\.gemini\antigravity-ide\brain\442bb64c-f965-44d6-b641-85b2b7691168'
$destDir = 'd:\AI STORY TELLER\public\cards\players'

$map = @(
  @{ src = 'wc26_49673_1783237004976.png';    dst = 'wc26-49673.png' },
  @{ src = 'wc26_312584_1783237028525.png';   dst = 'wc26-312584.png' },
  @{ src = 'wc26_755664_1783237039000.png';   dst = 'wc26-755664.png' },
  @{ src = 'wc26_46569_1783237048119.png';    dst = 'wc26-46569.png' },
  @{ src = 'wc26_464544_1783237065581.png';   dst = 'wc26-464544.png' },
  @{ src = 'wc26_10092510_1783237077215.png'; dst = 'wc26-10092510.png' }
)

foreach ($entry in $map) {
  $srcPath = Join-Path $artifactDir $entry.src
  $dstPath = Join-Path $destDir $entry.dst
  if (Test-Path $srcPath) {
    Copy-Item $srcPath $dstPath -Force
    Write-Host "Copied $($entry.dst)"
  } else {
    Write-Host "MISSING $($entry.src)"
  }
}

Write-Host "`nDone."
