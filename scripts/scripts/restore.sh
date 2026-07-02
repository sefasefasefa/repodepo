#!/bin/bash
# Geriye dönük uyumluluk — asıl script scripts/restore.sh'a taşındı
exec "$(dirname "$0")/scripts/restore.sh" "$@"
