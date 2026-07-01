#!/bin/bash
# Geriye dönük uyumluluk — asıl script scripts/backup.sh'a taşındı
exec "$(dirname "$0")/scripts/backup.sh" "$@"
