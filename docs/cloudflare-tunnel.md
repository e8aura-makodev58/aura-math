# Aura Math Cloudflare Tunnel

Prepared 2026-10-11 at the user's request, independently of Claude's application work.

## Current status

The existing origin at `http://127.0.0.1:5178/` returned HTTP 200 during setup.
Compose configuration and shell syntax checks passed. The source tunnel token was
copied without displaying it into `.cloudflare/tunnel.token`, with directory mode
700 and file mode 600. `.cloudflare/` is ignored by Git.

The connector has **not been started from this coding session**: Docker socket
access is denied and the session prevents privilege escalation. Run the following
from a normal host terminal with Docker access:

```bash
cd /home/makodev58/aura-math
bash scripts/start-cloudflare-tunnel.sh
```

If the host terminal normally requires sudo for Docker, use
`sudo bash scripts/start-cloudflare-tunnel.sh` instead. The script derives the
container UID/GID from the private token file, including when launched with sudo.
It starts the isolated `aura-math-tunnel` Compose project, waits up to 60 seconds
for a registered connection, and prints no token or raw container logs.

## Published application route

In Cloudflare, open **Networking → Tunnels**, select the existing Aura Math tunnel,
and open **Routes → Add route → Published application** (or edit the existing
route). Enter:

| Field | Value |
| --- | --- |
| Subdomain | `aura-math` |
| Domain | `makodev58.com` |
| Path | Empty; remove `^/blog` or other examples |
| Service type | `HTTP` |
| Service URL | `localhost:5178` |
| Additional application settings → HTTP settings → HTTP Host Header | `localhost` |

Save the route. Cloudflare configures its DNS record. Once the connector is
Healthy, open `https://aura-math.makodev58.com` and test a lesson and an interactive
activity. The host header override lets the existing Vite server accept proxied
requests without changing the application's allowed-host configuration.

`aura-math.cloudflare.com` is not available under the user's domain; the confirmed
hostname is `aura-math.makodev58.com`.

## Operation and credentials

The official `cloudflare/cloudflared:latest` image runs with Linux host networking
so `localhost:5178` refers to the existing application on the host. Compose starts
only the connector; the application must remain running separately. The restart
policy is `unless-stopped`. The token is mounted read-only and supplied through
`--token-file`, rather than environment variables or command-line token arguments.

The original source `/home/makodev58/aura-math-cloudflare.key` has been retained
until the connector is confirmed healthy. Afterwards the user may delete that
original file. Keep `.cloudflare/tunnel.token`: Docker needs it for container
recreation and restart. Do not paste credentials or full installation commands
into chat or commit them. If rotating a token, stop the connector, replace the
private file with the new token while retaining mode 600, then rerun the script.

Stop the connector without touching the application:

```bash
docker compose -p aura-math-tunnel -f compose.cloudflare.yaml down
```

## References and verification limits

- [Cloudflare tunnel setup and published routes](https://developers.cloudflare.com/tunnel/get-started/)
- [Token file run parameter](https://developers.cloudflare.com/tunnel/reference/run-parameters/)
- [HTTP Host Header origin setting](https://developers.cloudflare.com/tunnel/reference/origin-parameters/)

No image pull, container creation, connection registration, or public URL check
could be performed here because Docker access is blocked. Claude's source,
content, release records, and running application were not changed by this setup.
