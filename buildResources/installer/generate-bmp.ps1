# Gera BMPs para o instalador NSIS profissional
Add-Type -AssemblyName System.Drawing

$out = "C:\programas prontos\Aciapa_pro\buildResources\installer"

# Sidebar: 164x314px - gradiente escuro com texto ACIAPA
$bmp = New-Object System.Drawing.Bitmap(164, 314)
$g  = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = "HighQuality"
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point(0,0)),
  (New-Object System.Drawing.Point(164,314)),
  [System.Drawing.Color]::FromArgb(15,23,42),   # slate-900
  [System.Drawing.Color]::FromArgb(30,27,75)    # indigo-950
)
$g.FillRectangle($brush, 0, 0, 164, 314)

$font = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)
$brush2 = [System.Drawing.Brushes]::White
$g.DrawString("ACIAPA", $font, $brush2, 20, 30)

$font2 = New-Object System.Drawing.Font("Segoe UI", 8)
$brush3 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(148,163,184))
$g.DrawString("Gesta~o Empresarial", $font2, $brush3, 20, 58)
$g.DrawString("CRM | Financeiro", $font2, $brush3, 20, 74)
$g.DrawString("WhatsApp | IA", $font2, $brush3, 20, 90)
$g.DrawString("Kanban | RH", $font2, $brush3, 20, 106)

$font3 = New-Object System.Drawing.Font("Segoe UI", 7)
$g.DrawString("v2.0", $font3, $brush3, 20, 280)
$g.Dispose()
$bmp.Save("$out\installer-sidebar.bmp")
$bmp.Dispose()

# Header: 150x57px - gradiente
$bmp2 = New-Object System.Drawing.Bitmap(150, 57)
$g2  = [System.Drawing.Graphics]::FromImage($bmp2)
$brushH = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point(0,0)),
  (New-Object System.Drawing.Point(150,57)),
  [System.Drawing.Color]::FromArgb(99,102,241),  # indigo-500
  [System.Drawing.Color]::FromArgb(139,92,246)   # purple-500
)
$g2.FillRectangle($brushH, 0, 0, 150, 57)
$fontH = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
$g2.DrawString("ACIAPA", $fontH, [System.Drawing.Brushes]::White, 12, 14)
$g2.Dispose()
$bmp2.Save("$out\installer-header.bmp")
$bmp2.Dispose()

Write-Host "BMPs gerados em $out"
