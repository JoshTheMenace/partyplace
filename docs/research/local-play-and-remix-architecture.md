# Party Place: local play and remix releases

Architecture recommendation, 2026-09-10. This is a proposal based on the current source and documentation research, not an implementation or offline compatibility certification.

The priority is people playing together in one room, with downloadable games, selective offline support, and discoverable remixes. That changes the earlier emphasis on cloud preview deployments. The foundation should be a versioned game release that can run on a local host or a managed server. GitHub publishing produces that release; it should not determine where a party must play.

The recommended product has a web catalog and a downloadable host. The website supports discovery, remix pages, library management, and online play for hosted games. One participant installs the host and downloads games ahead of time. At the gathering, that computer runs the authoritative room server and serves the display and controller pages. Other people join its Wi-Fi address from their phone browsers. They do not need to install the host or download each game ahead of time. Internet access is unnecessary during a verified offline session; a working local network is still necessary.

This recommendation assumes a laptop or desktop is available to host. A phone-only gathering is a separate product target and would change the engineering priorities. A TV connected to the computer can act as the display; a smart-TV browser should be treated as an additional compatibility target.

| Approach | Useful properties | Main limits | Recommended role |
| --- | --- | --- | --- |
| Browser clients with a cloud room server | Share a link, no installation, supports remote guests | Requires internet; compute and operations costs grow with active play | Keep for immediate trials and online play |
| Downloadable host with phone browsers | Can operate without internet; reuses authoritative server; only host installs | Host setup, local network access, sleep/firewall/router behavior | Primary local/offline path |
| Cached browser/PWA alone | Convenient offline single-device games when their rules run locally | Caching does not run the current Node room server or expose a LAN listener | Later enhancement for eligible games |
| Browser host with WebRTC peers | Potentially removes the desktop installation | New transport, peer setup, asset availability, browser lifetime, and offline discovery work | Reconsider after local hosting proves demand |

WebRTC data channels support peer connections, but peers still need to exchange connection information. A server is the usual signaling path; manual/local signaling is possible with additional work. Moving to WebRTC would not itself put controller assets on previously unprepared phones. It also would not provide automatic host migration. [MDN data-channel example](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Simple_RTCDataChannel_sample).

Service workers support cached resources and require a secure context, with a localhost development exception. A phone visiting a computer's plain HTTP LAN address is not visiting localhost. The first LAN version can serve ordinary controller pages directly from the host without requiring phone service workers. Secure-context features must be assessed separately. [MDN service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).

Prefer a QR code that opens the host's local page directly. Do not make offline joining depend on the public website contacting a private IP address, public DNS, or an online room-code lookup. Public-to-local requests also encounter browser permission policies; Chrome documents a Local Network Access permission. This does not establish behavior on all browsers or for every transport. [Chrome Local Network Access](https://developer.chrome.com/blog/local-network-access).

The existing implementation already provides much of the gameplay foundation: nine authoritative server modules, a shared room and WebSocket connection, browser display/controller views, LAN address discovery, and selected save interfaces. The server listens on local network interfaces and advertises phone URLs. The current macOS launcher calls an existing Node executable, points at this checkout, and rebuilds before starting. It is not a self-contained consumer download. The current registries also remain static build dependencies; adding a catalog record does not install a runnable module.

Relevant source: [server entry](../../apps/party-server/src/main.ts), [desktop installer](../../scripts/install-desktop-launcher.mjs), [launcher](../../scripts/launch-dashboard.mjs), [game contract](../../packages/party-contract/src/index.ts), and [runtime documentation](../party-platform/IMPLEMENTATION.md).

A consumer host should contain its own runtime and prebuilt application assets. Starting an installed game must not require Git, npm, a compiler, an account login, or contacting a package registry. A small packaged runtime opening the user's browser is the shortest first slice. An Electron shell is a reasonable later choice if a consistent display engine and integrated installation UI justify its footprint. That packaging choice can follow the release/runtime boundary instead of driving it. If Electron is used, its native privileges must remain outside game renderers. [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security).

Each game release should contain:

- A unique game/remix identity, release hash, supported runtime version, and original game/release reference.
- Prebuilt display/controller code, authoritative rules, and all required game assets and content.
- Entry points, player modes, required capabilities, and explicitly verified offline modes.
- Save schema version, attribution, distribution permissions, and source repository/commit provenance.

The release descriptor can be generated from the starter and build output. A remix author inherits the existing configuration and should not need to write a new manifest by hand. Source remains separate from the playable download. One logical release can have different packaged artifacts if platform-specific dependencies become necessary; arbitrary native projects should not be promised portable compatibility.

The runtime should own networking, room identity, player seats, scheduling, asset delivery, storage, and game selection. Games implement rules and views through the existing contract. Keep one outer party session while changing the selected installed game. Pin the selected release for the duration of a match, and do not update its client or server underneath active players. Desktop and cloud hosts should use the same game contract and paired client/server release. They need not share filesystem layouts or deployment mechanisms.

For the initial curated collection, loading reviewed modules in the current shared runtime is a practical transitional arrangement. Third-party modules cannot be considered isolated merely because they implement the contract or run in another Node process. Untrusted rules need an actual restricted execution boundary, with limited storage/network capabilities and resource budgets; untrusted client code also needs isolation from platform privileges and other games. A signature identifies a release and detects tampering; it does not prove the code safe. Node explicitly states that `node:vm` is not a security mechanism. [Node VM documentation](https://nodejs.org/api/vm.html).

Therefore, start with owner-curated releases and controlled publication. Keep freely authored community server code out of automatic local installation until its execution boundary is designed and tested. Content remixes can be simpler where a game exposes a validated data format, because changing a question pack or supported map format does not require executing new server code.

Offline play needs explicit release-level guarantees. A cached listing means the user can see the game. An installed release means its required files are available. Offline solo means gameplay works without a network or cloud service on the host. Offline LAN means the host and newly joining phones work with internet disconnected but local Wi-Fi intact. Online-only games can still appear in Discover with that limitation clearly stated. External AI calls, remote assets, authentication checks, and license checks must not be hidden dependencies of an offline claim.

Store installed releases and saves in durable application data directories, separately from caches and the development checkout. Save state belongs to a game/remix and save schema. Store it through runtime APIs, support export/import, and retain it when uninstalling a game unless the user chooses otherwise. Cloud sync can be optional later. Existing save support is game-specific; games without export/load behavior cannot gain reliable resume merely by being packaged. Saving a game also does not imply transparent recovery of an interrupted live multiplayer connection.

The current library is browser-origin local storage. Membership in the public website will not automatically appear in a local host's library. Initially, installing a package can add its listing to the host's durable library; export/import can transfer lists. Account-based library and save synchronization can follow later. Neither offline startup nor LAN joining should depend on that account service being reachable.

The remix workflow should use the same local host:

1. Pick a remix-enabled game and create a local source copy with recorded ancestry. A GitHub fork is optional. Source must already be downloaded for this step to work offline.
2. Edit with any coding agent using supplied project instructions and the shared runtime contract. A cloud coding assistant can require internet even though the resulting game does not.
3. Run a development preview locally, then join it from real phones. Local play should not depend on publication or curator approval; locally authored code runs in an explicit development mode.
4. Build a versioned game package. Validate rules, runtime compatibility, assets, and advertised offline modes. A recipient can try a personal package under an explicit developer/trusted-code workflow; do not silently treat it as an approved installation.
5. When ready to share publicly, connect a repository or submit source and the release for curation. Initially, the owner reviews and publishes it manually.
6. Publish a shareable page with screenshots, what changed, original attribution, and Download. Offer browser Play when a hosted instance is available.

A source push can later trigger this build and optionally a hosted preview. A branch is work in progress; a published release is an immutable playable result. Each remix gets one discoverable identity and a release history, rather than a separate catalog card per commit. A release can become downloadable before cloud hosting is available. Hosting previews for every fork is not required to prove remixing works.

Local sessions move simulation costs onto the host computer. The platform still pays for catalog services, builds, artifact storage/downloads, and optional cloud sessions. Hosted trials are useful because downloads add friction, so retain a small curated online offering while avoiding an always-running server for every remix. No vendor or cost commitment is implied by this recommendation.

The first implementation milestone should be a self-contained host with two existing games, followed by one separately installable remix. Test on a clean machine without the checkout or a development Node installation. Disconnect internet while retaining the LAN, cold-start the host, and join from previously unprepared physical phones. Complete a round, replay, switch games while preserving seats, and restart to restore a supported save. Confirm a new game package installs without rebuilding the platform and a mismatched runtime produces a clear error.

Further acceptance gates include maximum advertised players, firewall prompts, guest-network isolation, host sleep, phone lock/reconnect, address changes, partial downloads, rollback, and all packaged asset requests with WAN access blocked. A hotspot is a possible fallback only after testing the target devices. The current browser checks do not establish physical-device or disconnected-internet acceptance for this proposed package system.

The recommended order is portable releases and a consumer local host; curated remix installation and sharing; then automated repository builds and broader hosted play. Browser-only peer hosting and a mobile host remain options if user testing shows that installing on a computer is the main barrier.

Claude Fable was consulted through the ask-claude skill with the `fable` model alias, paired model session `b8983752-eb83-5034-89c1-863beba75e98`. Its read-only review independently recommended the hybrid local-host architecture and challenged cloud previews and GitHub forks as prerequisites for local remixing. That correction is incorporated above. Fable also recommended evaluating a bundled Node executable opening the existing browser before adopting a desktop webview framework; this remains a packaging experiment, not a selected or tested distribution method.

The synthesis does not adopt all of Fable's assertions. Its precise latency and executable-size estimates were not measured. Browser storage eviction is a reason to provide durable saves and export, not evidence that all iOS saves disappear on a universal seven-day schedule. WebRTC requires connection negotiation, not necessarily an internet signaling service. A generic Node Worker and message-copy boundary are insufficient evidence of a security sandbox for hostile code. Local-to-cloud migration also cannot promise seamless continuity: initially, offer explicit save export/import into a new room for compatible games, with players rejoining. Existing room views are not full authoritative recovery snapshots.
