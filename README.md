# Waymorphic Map for WordPress

Free OpenStreetMap vector maps for WordPress sites, from [Waymorphic Map](https://waymorphic.com/). A block and a shortcode, five styles, markers with popups. No API key, no account.

## Install

Copy this folder to `wp-content/plugins/waymorphic-map` and activate **Waymorphic Map** on the Plugins screen. WordPress 6.3 or later, PHP 7.4 or later. There is no build step.

## Use

**Block.** Add the "Waymorphic Map" block. A new block asks "Where is your map?": type an address, a town or a postcode and select it from the list. The map goes there and gets a marker. "Use my location" does the same with the position that the browser gives. After that, the search field is on the map. Drag the map to set the view. Click the map to add a marker at that point. Drag a marker to move it, and click it to change its text or remove it. In the sidebar, select the style from the five swatches and set the height.

**Shortcode.**

```
[waymorphic_map lat="51.5074" lng="-0.1276" zoom="11" label="London"]

[waymorphic_map address="10 Downing Street, London" zoom="16" style="bright"]

[waymorphic_map height="500"]
[waymorphic_marker lat="48.8584" lng="2.2945"]<strong>Eiffel Tower</strong>[/waymorphic_marker]
[waymorphic_marker lat="48.8606" lng="2.3376" open="true"]The Louvre[/waymorphic_marker]
[/waymorphic_map]
```

| Attribute | Meaning | Default |
| --- | --- | --- |
| `lat`, `lng` | Centre of the map | Fits the markers, or shows the world |
| `address` | Address or place name, used when `lat` and `lng` are not given | |
| `zoom` | 0 to 22 | Setting (12) |
| `style` | `positron`, `bright`, `liberty`, `dark`, `fiord` | Setting (`positron`) |
| `height`, `width` | CSS length; a number is in pixels | Setting (`400px`), `100%` |
| `marker` | `true` puts a marker at the centre | On with `label` or `address` |
| `label` | Popup text of the marker at the centre | |
| `controls` | `false` hides the zoom and fullscreen buttons | `true` |
| `scroll_zoom` | `true`: plain scroll zooms the map. `false`: ctrl or cmd + scroll | `false` |
| `interactive` | `false` makes a still map | `true` |
| `title` | Name of the map for screen readers | `Map` |

`[waymorphic_marker]` takes `lat` and `lng` (or `address`) and `open="true"`. Its content is the popup.

**Settings.** Settings > Waymorphic Map: default style, height and zoom, and the tile server URL for a self-hosted server.

## For developers

- `waymorphic_map_render( $args )` returns the HTML of a map. Use it in a template.
- Filter `waymorphic_map_config`: the configuration of one map before output.
- Filter `waymorphic_map_tiles_url`: the tile server URL.
- JavaScript: each `.waymorphic-map` element has its MapLibre map in `element.waymorphicMap`. `WaymorphicMap.init( root )` starts maps that you add to the page later.

```
waymorphic-map.php      plugin header and hooks
includes/options.php    options and input cleaning
includes/render.php     assets, map markup, address lookup
includes/shortcode.php  [waymorphic_map], [waymorphic_marker]
includes/block.php      block registration and render callback
includes/settings.php   settings page
block/                  block.json and the editor script
assets/js, assets/css   front-end script and style
assets/vendor           MapLibre GL JS 5.21.0 (BSD 3-Clause)
```

## Release

1. Set the same version in the plugin header and the `WAYMORPHIC_MAP_VERSION` constant in `waymorphic-map.php`, and in `Stable tag` in `readme.txt`. Add a changelog entry in `readme.txt`.
2. `bin/build-zip.sh` makes `build/waymorphic-map.zip` from the last commit. The script stops if the three version numbers are different.
3. Push a tag such as `v1.0.0`. The Release workflow builds the zip and attaches it to a GitHub release. The release notes are the changelog entry of that version in `readme.txt`. The workflow stops if the tag and the plugin version are different, or if the changelog has no entry for the version.

The CI workflow runs on each push and pull request: a PHP syntax check on PHP 7.4 and 8.3, and a build of the zip, which it keeps as an artifact.

`.wordpress-org/` holds the icon, banner and screenshots for the WordPress.org plugin directory. These files go in the `assets` folder of the plugin's SVN repository, not in the zip.

## Service and credit

Maps come from `https://tiles.waymorphic.com`. The service is free and best effort. Keep the credit on the map: map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, schema by [OpenMapTiles](https://openmaptiles.org/). See [fair use](https://waymorphic.com/#fair).

## Contact

Questions and problem reports: [contact@waymorphic.com](mailto:contact@waymorphic.com).

## Licence

GPL-2.0-or-later. MapLibre GL JS has its own licence in `assets/vendor/maplibre-gl/LICENSE.txt`.
