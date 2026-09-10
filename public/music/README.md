Add your licensed music files here later. This folder is served at /music/.
No music is bundled, generated, downloaded, or needed for play.
The shell owns MusicBus in packages/party-client/src/music.ts. After an explicit Enable sound gesture, call music.play('/music/your-file.mp3') from shell lifecycle wiring. Stop tracks when changing games; the existing shell teardown already calls music.stop(). Do not add music imports to game rules or remote fetches. Current enable/mute controls work silently until a track is configured.
