#!/usr/bin/env bash
set -euo pipefail
# Do not enable shell tracing: the source file contains a credential.
umask 077
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
prepare_only=false
if [[ "${1:-}" == "--prepare-only" ]]; then
  prepare_only=true
  shift
fi
if (( $# > 1 )); then
  echo 'Usage: scripts/start-cloudflare-tunnel.sh [--prepare-only] [key-file]' >&2
  exit 1
fi
key_file="${1:-${HOME}/aura-math-cloudflare.key}"
python3 - "$key_file" "$repo_dir/.cloudflare" <<'PY'
import os
import re
import shlex
import sys
from pathlib import Path

source = Path(sys.argv[1])
directory = Path(sys.argv[2])
destination = directory / 'tunnel.token'
try:
    directory.mkdir(mode=0o700, exist_ok=True)
    os.chmod(directory, 0o700)
    if destination.is_symlink():
        raise ValueError('Private token path must not be a symbolic link.')
    if destination.exists():
        token = destination.read_text().strip()
    else:
        raw = source.read_text().strip()
        parts = shlex.split(raw)
        token = raw
        for index, part in enumerate(parts):
            if part == '--token':
                if index + 1 >= len(parts):
                    raise ValueError('The installation command is missing its token.')
                token = parts[index + 1]
                break
            if part.startswith('--token='):
                token = part.split('=', 1)[1]
                break
        else:
            if len(parts) == 1:
                token = parts[0]
    if not re.fullmatch(r'[A-Za-z0-9_+/=-]{40,}', token):
        raise ValueError('Expected a tunnel token or an installation command containing --token.')
    if not destination.exists():
        descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, 'w') as output:
            output.write(token + '\n')
    os.chmod(destination, 0o600)
except (OSError, ValueError):
    # Never echo input or parser exception details, which may contain the token.
    print('Could not prepare the private tunnel token. Check the key file and permissions.', file=sys.stderr)
    sys.exit(1)
print('Private tunnel token prepared; its contents have not been displayed.')
PY
if "$prepare_only"; then
  exit 0
fi
# Use the token file owner even when this script is launched through sudo.
export TUNNEL_UID="$(stat -c '%u' .cloudflare/tunnel.token)"
export TUNNEL_GID="$(stat -c '%g' .cloudflare/tunnel.token)"
if ! docker info >/dev/null 2>&1; then
  echo 'Docker is unavailable to this terminal. Run this script from a host terminal with Docker access.' >&2
  exit 1
fi
docker compose -p aura-math-tunnel -f compose.cloudflare.yaml config --quiet
docker compose -p aura-math-tunnel -f compose.cloudflare.yaml up -d
echo 'Waiting up to 60 seconds for a registered Cloudflare connection...'
for (( attempt=0; attempt<20; attempt++ )); do
  if docker compose -p aura-math-tunnel -f compose.cloudflare.yaml logs --since 1m cloudflared 2>&1 \
    | grep 'Registered tunnel connection' >/dev/null; then
    echo 'Tunnel connected. Confirm Healthy in Cloudflare, then add the published application route.'
    echo 'The original key file has been retained; the private token copy is required for restarts.'
    exit 0
  fi
  sleep 3
done
echo 'Container started, but a registered connection was not confirmed. Check the connector status in Cloudflare.' >&2
exit 1
