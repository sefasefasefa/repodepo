#!/bin/bash
# Geriye dönük uyumluluk — asıl script scripts/update.sh'a taşındı
exec "$(dirname "$0")/scripts/update.sh" "$@"
