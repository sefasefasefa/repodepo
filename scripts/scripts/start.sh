#!/bin/bash
# Geriye dönük uyumluluk — asıl script scripts/start.sh'a taşındı
exec "$(dirname "$0")/scripts/start.sh" "$@"
