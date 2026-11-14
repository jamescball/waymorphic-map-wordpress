=== Waymorphic Map ===
Contributors: jamesb7
Tags: map, openstreetmap, maps, maplibre, location
Requires at least: 6.3
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Free OpenStreetMap vector maps for WordPress. A block and a shortcode, five styles, markers with popups. No API key, no account.

== Description ==

Waymorphic Map adds interactive maps to your posts and pages. The maps are vector maps of the whole planet, made from OpenStreetMap data and served by [Waymorphic Map](https://waymorphic.com/). They are free. You do not need an account, an API key or a payment card.

* **A block for the editor.** Type an address and select it from the suggestions: the map goes there and gets a marker. Click the map to add more markers, drag them into position, and click a marker to change its text. Select the map style from five swatches. The editor shows the map as your visitors will see it.
* **A shortcode** for the classic editor, widgets and templates.
* **Five map styles:** Positron, Bright, Liberty, Dark and Fiord.
* **Markers with popups.** Add as many as you want. The map can fit its view to them.
* **Addresses.** Give the shortcode an address and the plugin finds the coordinates.
* **Does not take over the scroll wheel.** The page scrolls; ctrl or cmd + scroll zooms the map. You can change this for each map.
* **Fast.** The map script loads only on pages that have a map, and a map starts only when the visitor scrolls near it.
* **No tracking.** The plugin sets no cookies. MapLibre GL JS is included in the plugin, not loaded from a CDN.

= The shortcode =

A map with one marker:

`[waymorphic_map lat="51.5074" lng="-0.1276" zoom="11" label="London"]`

A map from an address:

`[waymorphic_map address="10 Downing Street, London" zoom="16" style="bright"]`

A map with many markers. Without `lat` and `lng`, the view fits the markers:

`[waymorphic_map height="500"]
[waymorphic_marker lat="48.8584" lng="2.2945"]<strong>Eiffel Tower</strong>[/waymorphic_marker]
[waymorphic_marker lat="48.8606" lng="2.3376" open="true"]The Louvre[/waymorphic_marker]
[waymorphic_marker address="Notre-Dame de Paris"]Notre-Dame[/waymorphic_marker]
[/waymorphic_map]`

Attributes of `[waymorphic_map]`:

* `lat`, `lng` - the centre of the map.
* `address` - an address or place name, used when `lat` and `lng` are not given. A marker shows the place.
* `zoom` - 0 (the world) to 22. The default is in the settings.
* `style` - `positron`, `bright`, `liberty`, `dark` or `fiord`.
* `height`, `width` - a CSS length such as `400px`, `60vh` or `100%`. A number is in pixels.
* `marker` - `true` puts a marker at the centre.
* `label` - popup text for the marker at the centre.
* `controls` - `false` hides the zoom and fullscreen buttons.
* `scroll_zoom` - `true` lets plain scroll zoom the map.
* `interactive` - `false` makes a still map.
* `title` - the name of the map for screen readers.

Attributes of `[waymorphic_marker]`: `lat` and `lng`, or `address`; `open="true"` shows the popup when the page opens. The text between the tags is the popup.

= External service =

This plugin shows maps from the Waymorphic Map tile server, `https://tiles.waymorphic.com`.

* When a visitor sees a map, the browser of the visitor gets the map style, map tiles, fonts and icons from that server. As with all web requests, the server sees the IP address and the browser of the visitor, and the tiles requested.
* When you use an `address` in a shortcode, your WordPress site sends that address to the search of the server one time and keeps the answer.
* When you search for a place in the block editor, your browser sends the search text to the server.

The server has no accounts, no cookies and no analytics. See the [fair use and privacy notes](https://waymorphic.com/#fair). The service is free and best effort: there is no uptime guarantee. If you run your own Waymorphic Map server, you can set its URL in Settings > Waymorphic Map.

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, with the [OpenMapTiles](https://openmaptiles.org/) schema. The credit in the corner of each map is a licence requirement. Do not remove it.

== Installation ==

1. Upload the `waymorphic-map` folder to `/wp-content/plugins/`, or install the plugin from the Plugins screen.
2. Activate the plugin.
3. Add the "Waymorphic Map" block to a post or a page, or use the `[waymorphic_map]` shortcode.
4. Optional: set the default style, height and zoom in Settings > Waymorphic Map.

== Frequently Asked Questions ==

= Is an API key necessary? =

No. There is no account, no key and no quota.

= Is it free for commercial sites? =

Yes. Keep the credit on the map and use the service as a map. Bulk downloads of tiles are not permitted.

= Can I change the colour of the map? =

Select one of the five styles for each map, or set the default style in the settings.

= Why does the map not zoom when I scroll? =

This prevents the map from catching the scroll of the page. Hold ctrl (or cmd on a Mac) and scroll, or use the buttons. To change this, set "Scroll to zoom" on the block, or `scroll_zoom="true"` on the shortcode.

= Can developers change the map? =

Yes. The `waymorphic_map_config` filter changes the configuration of a map, and `waymorphic_map_tiles_url` changes the tile server. In JavaScript, each map element has its MapLibre map in the `waymorphicMap` property.

= How do I get help or report a problem? =

Send an email to contact@waymorphic.com.

== Screenshots ==

1. A map with a marker and a popup on a page.
2. A new block asks for the place. The search gives suggestions while you type.
3. The block in the editor: the search field on the map, the text form of a marker, and the five styles in the sidebar.
4. The settings page with the defaults for new maps.

== Changelog ==

= 1.0.0 =
* First release: block, shortcodes, settings page.

== Third-party code ==

The plugin includes [MapLibre GL JS](https://maplibre.org/) 5.21.0 (BSD 3-Clause licence) in `assets/vendor/maplibre-gl`. The file `maplibre-gl.js` is the minified build from the npm package `maplibre-gl`. The source code is at https://github.com/maplibre/maplibre-gl-js/tree/v5.21.0.
