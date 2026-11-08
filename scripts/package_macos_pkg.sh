#!/usr/bin/env bash
# On-The-Court-macOS.pkg: EULA screen, installs "On The Court.app" into /Applications (universal).
set -euo pipefail
VERSION="${VERSION:-0.1.0}"; NAME="On The Court"; ID="com.humhouse.onthecourt"
APP="out/$NAME-darwin-universal/$NAME.app"
[[ -d "$APP" ]] || { echo "missing $APP"; exit 1; }
STAGE="$(mktemp -d)"; mkdir -p "$STAGE/root/Applications" "$STAGE/res" "$STAGE/scripts"
cp -R "$APP" "$STAGE/root/Applications/"
codesign --force --deep --sign - "$STAGE/root/Applications/$NAME.app" || true
cat > "$STAGE/scripts/preinstall" <<PRE
#!/bin/sh
rm -rf "/Applications/$NAME.app" 2>/dev/null || true
exit 0
PRE
chmod +x "$STAGE/scripts/preinstall"
pkgbuild --analyze --root "$STAGE/root" "$STAGE/comp.plist"
/usr/libexec/PlistBuddy -c "Set :0:BundleIsRelocatable false" "$STAGE/comp.plist"
pkgbuild --root "$STAGE/root" --component-plist "$STAGE/comp.plist" --identifier "$ID.app" --version "$VERSION" --scripts "$STAGE/scripts" --install-location / "$STAGE/app.pkg"
cp installer/LICENSE.txt "$STAGE/res/license.txt"
echo "<html><body><h2>On The Court $VERSION</h2><p>Next-gen 3D basketball. This installs On The Court into Applications.</p></body></html>" > "$STAGE/res/welcome.html"
echo "<html><body><h2>Installed</h2><p>Open On The Court from Applications (first launch: right-click → Open).</p></body></html>" > "$STAGE/res/conclusion.html"
cat > "$STAGE/dist.xml" <<XML
<?xml version="1.0" encoding="utf-8"?>
<installer-gui-script minSpecVersion="2">
  <title>$NAME $VERSION</title>
  <welcome file="welcome.html" mime-type="text/html"/>
  <license file="license.txt" mime-type="text/plain"/>
  <conclusion file="conclusion.html" mime-type="text/html"/>
  <options customize="never" require-scripts="false" hostArchitectures="arm64,x86_64"/>
  <choices-outline><line choice="app"/></choices-outline>
  <choice id="app" title="$NAME"><pkg-ref id="$ID.app"/></choice>
  <pkg-ref id="$ID.app" version="$VERSION">app.pkg</pkg-ref>
</installer-gui-script>
XML
mkdir -p artifacts
productbuild --distribution "$STAGE/dist.xml" --resources "$STAGE/res" --package-path "$STAGE" "artifacts/On-The-Court-macOS.pkg"
ls -la artifacts
