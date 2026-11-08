#!/usr/bin/env bash
# On-The-Court-Linux.deb (Debian/Ubuntu). EULA ships in /usr/share/doc and is shown on first launch notice.
set -euo pipefail
VERSION="0.1.0"; PKG=on-the-court; SRC="out/On The Court-linux-x64"
root="$(mktemp -d)"; chmod 755 "$root"
mkdir -p "$root/DEBIAN" "$root/opt/$PKG" "$root/usr/bin" "$root/usr/share/applications" "$root/usr/share/doc/$PKG"
cp -R "$SRC/." "$root/opt/$PKG/"
chmod 4755 "$root/opt/$PKG/chrome-sandbox" 2>/dev/null || true
ln -s "/opt/$PKG/on-the-court" "$root/usr/bin/$PKG" 2>/dev/null || true
cp installer/LICENSE.txt "$root/usr/share/doc/$PKG/copyright"
cat > "$root/usr/share/applications/$PKG.desktop" <<EOF2
[Desktop Entry]
Type=Application
Name=On The Court
Comment=Next-gen 3D basketball
Exec="/opt/$PKG/On The Court"
Terminal=false
Categories=Game;SportsGame;
EOF2
cat > "$root/DEBIAN/control" <<EOF2
Package: $PKG
Version: $VERSION
Section: games
Priority: optional
Architecture: amd64
Depends: libgtk-3-0, libnss3, libxss1, libasound2 | libasound2t64, libgbm1
Maintainer: HumHouse <support@humhouse.studio>
Description: On The Court - next-gen 3D basketball
 By installing you accept the EULA in /usr/share/doc/$PKG/copyright.
EOF2
mkdir -p artifacts
dpkg-deb --root-owner-group --build "$root" artifacts/On-The-Court-Linux.deb
cp installer/LICENSE.txt artifacts/EULA.txt
ls -la artifacts
