#!/usr/bin/env bash
# tools/extract-osm-roads.sh — Extração OFFLINE dos corredores OSM maiores (T-V-16,
# aero-fighters-inhauma-visual-uplift-v1). Roda UMA vez (ou quando o PBF mudar) e
# regenera src/maps/inhauma-osm-roads.js vendorizado — o jogo em runtime é offline.
#
# Uso (a partir de repos/tauan-games):
#   bash src/web-games/aero-fighters/tools/extract-osm-roads.sh
#
# Pipeline: osmium tags-filter (só highway=motorway,trunk,primary,secondary — sem a
# teia de ruas menores) → osmium export (GeoJSON) → extract-osm-roads.mjs (projeção,
# curadoria, cortes aeroporto/rio, simplificação — ver o cabeçalho do .mjs).
# Intermediários ficam FORA do repo ($REPO_ROOT/../../.dadaia/tmp/).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../../../.." && pwd)"           # repos/tauan-games
PBF="$REPO_ROOT/src/godot/aero-fighters-v2/Content/World/inhauma-osm.pbf"
TMP="$REPO_ROOT/../../.dadaia/tmp/osm-roads"           # workspace .dadaia/tmp (fora do repo)
mkdir -p "$TMP"

osmium tags-filter "$PBF" w/highway=motorway,trunk,primary,secondary \
  -o "$TMP/major.osm.pbf" --overwrite
osmium export "$TMP/major.osm.pbf" -o "$TMP/major.geojson" --overwrite

node --experimental-default-type=module \
  "$HERE/extract-osm-roads.mjs" "$TMP/major.geojson" \
  "$REPO_ROOT/src/web-games/aero-fighters/src/maps/inhauma-osm-roads.js"
