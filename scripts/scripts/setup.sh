#!/bin/bash
# Geriye dönük uyumluluk — asıl script scripts/setup.sh'a taşındı
exec "$(dirname "$0")/scripts/setup.sh" "$@"
