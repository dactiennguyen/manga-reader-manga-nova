#!/bin/sh
# Regenerates every launcher icon and the splash mark, Android and iOS, from assets/icon/*.svg. Needs rsvg-convert and magick.
set -e
cd "$(dirname "$0")/.."
RES=android/app/src/main/res
SRC=assets/icon
BG='#F15A3C'
TMP=$(mktemp -d)
for spec in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  d=${spec%%:*}; s=${spec##*:}
  fg=$((s * 9 / 4))
  rsvg-convert -w "$fg" -h "$fg" "$SRC/foreground.svg" -o "$RES/mipmap-$d/ic_launcher_foreground.png"
  rsvg-convert -w "$fg" -h "$fg" "$SRC/monochrome.svg" -o "$RES/mipmap-$d/ic_launcher_monochrome.png"
  # Legacy icons (API 24-25): crop the 108dp art to the visible 72dp area.
  rsvg-convert -w "$((s * 3 / 2))" -h "$((s * 3 / 2))" -b "$BG" "$SRC/foreground.svg" -o "$TMP/full.png"
  magick "$TMP/full.png" -gravity center -crop "${s}x${s}+0+0" +repage "$TMP/sq.png"
  magick "$TMP/sq.png" \( -size "${s}x${s}" xc:black -fill white -draw "roundrectangle 0,0,$((s - 1)),$((s - 1)),$((s / 5)),$((s / 5))" \) -alpha off -compose CopyOpacity -composite "$RES/mipmap-$d/ic_launcher.png"
  mkdir -p "$RES/drawable-$d"
  rsvg-convert -w "$((s * 6))" -h "$((s * 6))" "$SRC/splash.svg" -o "$RES/drawable-$d/splash_mark.png"
  magick "$TMP/sq.png" \( -size "${s}x${s}" xc:black -fill white -draw "circle $((s / 2)),$((s / 2)) $((s / 2)),0" \) -alpha off -compose CopyOpacity -composite "$RES/mipmap-$d/ic_launcher_round.png"
done
rsvg-convert -w 768 -h 768 -b "$BG" "$SRC/foreground.svg" -o "$TMP/play.png"
magick "$TMP/play.png" -gravity center -crop 512x512+0+0 +repage "$SRC/play-store-512.png"
# iOS: one 1024px icon without alpha, and the launch screen mark at 1x, 2x and 3x.
IOS=ios/Manganova/Images.xcassets
rsvg-convert -w 1536 -h 1536 -b "$BG" "$SRC/foreground.svg" -o "$TMP/ios.png"
magick "$TMP/ios.png" -gravity center -crop 1024x1024+0+0 +repage -alpha off "$IOS/AppIcon.appiconset/AppIcon-1024.png"
for k in 1 2 3; do
  rsvg-convert -w $((200 * k)) -h $((200 * k)) "$SRC/splash.svg" -o "$IOS/SplashMark.imageset/SplashMark@${k}x.png"
done
rm -rf "$TMP"
