# Genera public/icon/{16,32,48,128}.png desde brand/logoUsiv.png (logo oficial de usiv.cl).
# 128 px: logo completo. 16/32/48 px: solo el escudo sobre fondo navy, legible en tamaño pequeño.
param(
  [string]$Source = "$PSScriptRoot/../brand/logoUsiv.png",
  [string]$OutDir = "$PSScriptRoot/../public/icon"
)
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $Source))
New-Item -ItemType Directory -Force $OutDir | Out-Null

function New-Canvas([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.PixelOffsetMode = 'HighQuality'
  $g.Clear([System.Drawing.Color]::Transparent)
  return @($bmp, $g)
}

function RoundedRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

# Recorte del escudo dentro del logo de 500x500.
$shield = New-Object System.Drawing.Rectangle 128, 45, 244, 270
$navy = [System.Drawing.Color]::FromArgb(255, 10, 46, 68)

foreach ($size in 16, 32, 48) {
  $bmp, $g = New-Canvas $size
  $brush = New-Object System.Drawing.SolidBrush $navy
  $g.FillPath($brush, (RoundedRect 0 0 $size $size ([Math]::Max(3, $size * 0.22))))
  $pad = [Math]::Round($size * 0.12)
  $h = $size - 2 * $pad
  $w = [Math]::Round($h * $shield.Width / $shield.Height)
  $dest = New-Object System.Drawing.Rectangle ([int](($size - $w) / 2)), $pad, $w, $h
  $g.DrawImage($src, $dest, $shield, [System.Drawing.GraphicsUnit]::Pixel)
  $bmp.Save("$OutDir/$size.png", [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

$bmp, $g = New-Canvas 128
$g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, 128, 128))
$bmp.Save("$OutDir/128.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $src.Dispose()
Write-Output "Iconos generados en $OutDir"
