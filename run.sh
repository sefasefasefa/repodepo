#!/bin/bash
# Geriye dönük uyumluluk — asıl script scripts/run.sh'a taşındı
exec "$(dirname "$0")/scripts/run.sh" "$@"
