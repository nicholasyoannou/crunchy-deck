# Crunchy Deck
An unofficial controller-first Crunchyroll client made for the Steam Deck. Sign in, pick your profile, browse, and watch all from the Deck. Partial technical aspects borrowed from the [aarron-lee](https://github.com/aarron-lee/crunchyroll-linux) fork of [Crunchyroll for TIZEN](https://github.com/jhassan8/crunchyroll-tizen).

![videoPlayer.jpg](https://raw.githubusercontent.com/nicholasyoannou/crunchy-deck/main/docs/videoPlayer.jpg)

![homeScreen.png](https://raw.githubusercontent.com/nicholasyoannou/crunchy-deck/main/docs/homeScreen.png)

## How to install on the Steam Deck (or other Linux-based handhelds)
1. Download the latest AppImage from [Releases](https://github.com/nicholasyoannou/crunchy-deck/releases/latest).
2. (Optional) Move the application somewhere permanent.
3. Add the AppImage to Steam, or your desired launcher.

If you want to add it to Steam, right click on the file (left back trigger) → Add to Steam. You can then launch it directly through Steam. You can configure the box art manually using assets from [SteamGridDB](https://www.steamgriddb.com/), or more easily using the [SteamGridDB plugin for Decky Loader](https://github.com/SteamGridDB/decky-steamgriddb).

## Features

- Home screen (showing trending content, continue watching, watchlist, and recommendation rows)
- Multi-profile support
- Browse by category & season
- Search the Crunchyroll catalog
- Personal watchlist and history
- Video player with controller-first Steam Deck support plus progress sync.
- Self-update functionality, prompting you when a new version is available.
- Steam on-screen keyboard support, with a built-in failover.


## Development

```bash
pnpm install
pnpm dev         
```

### Build & run

```bash
pnpm build:web && pnpm build:electron
npx electron-builder --linux
```

## FAQ
Q: Is this compatible with Windows?

A: Unfortunately, due to DRM, this unofficial port supports Linux-based handhelds only. This is mainly due to the keys associated with [Crunchyroll for TIZEN](https://github.com/jhassan8/crunchyroll-tizen), and TIZEN (Samsung TV OS) being built ontop of Linux. 

## Self-update

Releases are published to GitHub Releases. A running AppImage checks for a newer version on launch, and shows an in-app prompt to update if one is available. If you choose to update, the new version will be downloaded and installed automatically.

## License

[GPL-3.0](LICENSE).
