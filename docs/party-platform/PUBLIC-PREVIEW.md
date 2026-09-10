# Running a public PartyPlay preview

The platform MVP seeds all nine first-party games. Discovery, game detail links, favorites, and recent games sit above the existing game runtimes. All nine games use isolated PartyPlay rooms and the same room protocol. No third-party games or source-download rights are implied.

## Start an isolated build

```sh
npm ci
npm run build:isolated -- my-public-preview
PUBLIC_ORIGIN=https://your-public-host.example npm run serve:isolated -- my-public-preview 4388
```

Choose a new build name and unused port. `PUBLIC_ORIGIN` is the exact public HTTP(S) origin, without a path. It controls invitations and QR codes for both shared games and Kart. Leave it unset for LAN address discovery. Serve the complete application through one origin; `/ws` needs WebSocket upgrades.

A temporary Cloudflare Quick Tunnel can forward a dedicated preview port:

```sh
cloudflared tunnel --url http://127.0.0.1:4388
```

Once the tunnel reports its HTTPS URL, start the preview server with that URL as `PUBLIC_ORIGIN`. The tunnel may start before the server. Do not expose an unrelated development server. The computer, application process, and tunnel must stay running; restarting the tunnel produces a new URL. Quick Tunnels are for testing, with a 200 concurrent request limit and no uptime guarantee. [Cloudflare documentation](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/).

## Permanent Node deployment

The repository includes a Dockerfile for a Node 22 host. Docker is not installed in the current development environment, so container execution remains unverified. The same production bundle is tested through the isolated Node server.

```sh
docker build -t partyplay .
docker run --init --name partyplay -p 4317:4317 \
  -e PUBLIC_ORIGIN=https://play.example \
  -v partyplay-worlds:/app/data/world-saves partyplay
```

Put an HTTPS reverse proxy in front of the container with WebSocket support and a generous idle timeout. Use one application instance: rooms live in that process; independently scaled instances cannot route another instance's room code. Health endpoint: `/api/health`. The current Sites runtime is Cloudflare Workers and cannot directly host this Node HTTP/WebSocket server. A Worker/Durable Objects port is a separate project.

## What players can expect

- Open a game detail link such as `/?game=kart-party`, then press Play.
- Kart Party, Blockwild and Kitchen Rush can run solo on one device. The other six games need a shared display and phone controllers. A publicly hosted room can accept remote phones, but remote players still need to see the shared display; screen sharing is external to PartyPlay.
- Favorite games and recent launches stay in this browser. There are no accounts or cross-device library sync.
- Blockwild world files can be downloaded and imported by the host. Room autosaves keep the latest and previous checkpoints in a separate directory for each room. When the room expires, its server recovery is no longer accessible through a new room; download a world file before leaving.
- Kitchen Rush campaign progress stays in the display browser. Active games need the server connection.
- The new router permits up to 32 shared rooms and 256 shared sockets, preserving ten player seats per room. These are protective bounds, not a measured hosting capacity.
- A host disconnect has a two-minute reconnect grace period. Restarting the application loses active rooms. Existing save files on a persistent volume survive a process restart, but there is no account-based recovery UI for expired rooms.
- Today’s catalog is curated and first-party. Offline game packages, licensed source downloads, remixing, creator submissions, source feeds, and MCP publishing are future releases.

## Operations and privacy

Host and player credentials travel in the existing WebSocket session; world-file HTTP requests require the room code and host bearer token. The server isolates room state, player-private projections, and autosave storage. A room code is an invitation: anyone who knows it can join while seats are available. Do not publish a live room code unless that is intended.

The hub bounds connections, handshake attempts, room count, payload size, and each game's existing input/action limits. It rejects browser connections from a different origin. Behind a tunnel, upgrade rate limits use the proxy connection address rather than trusting forwarded IP headers, so a burst of testers may share a rate limit. This preview has no moderation console, accounts, distributed storage, or production load certification.

Do not stage, commit, push, or publish source as part of deployment without the user's explicit authorization under this repository's AGENTS.md. Hosting built assets on an authorized server does not require changing Git history.
