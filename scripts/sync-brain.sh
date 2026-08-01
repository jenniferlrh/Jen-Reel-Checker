#!/bin/bash
# Sync docs/jen-ads-brain.md everywhere it needs to go:
# 1. regenerate functions/api/_brain.js (used by /api/generate-script)
# 2. overwrite the Google Drive copy in "Claude MD File" folder
set -e
cd "$(dirname "$0")/.."
python3 -c "
import json
md = open('docs/jen-ads-brain.md').read()
open('functions/api/_brain.js','w').write('// AUTO-GENERATED from docs/jen-ads-brain.md — run scripts/sync-brain.sh after editing the md.\nexport const ADS_BRAIN = '+json.dumps(md)+'\n')
"
ssh 4bbot "cd /root/gdrive-tools && node update-md.js 'jen-ads-brain.md' -" < docs/jen-ads-brain.md
echo "brain synced: _brain.js regenerated + Google Drive updated"
