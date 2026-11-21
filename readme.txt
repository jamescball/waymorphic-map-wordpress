=== Waymorphic Map & Custom Maps - No signup required ===
Contributors: jamesb7
Tags: map, openstreetmap, maps, maplibre, location
Requires at least: 6.3
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.2.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Free OpenStreetMap vector maps for WordPress. A block and a shortcode, five styles, markers with popups. No API key, no account.

== Description ==

Waymorphic Map adds interactive maps to your posts and pages. The maps are vector maps of the whole planet, made from OpenStreetMap data and served by [Waymorphic Map](https://waymorphic.com/). They are free. You do not need an account, an API key or a payment card.

This is the official plugin of Waymorphic Map. The author of the plugin operates the map service.

* **A block for the editor.** Type an address and select it from the suggestions: the map goes there and gets a marker. Click the map to add more markers, drag them into position, and click a marker to change its text. Select the map style from five swatches. The editor shows the map, its markers and its shapes. The list, the search, the groups and the category buttons show on the page.
* **A shortcode** for the classic editor, widgets and templates.
* **Five map styles:** Positron, Bright, Liberty, Dark and Fiord.
* **Markers with popups.** Add as many as you want. The map can fit its view to them.
* **Marker colours, pictures and animations.** Give each marker a colour or your own picture. Markers can drop or bounce when the map opens.
* **Shapes.** Polygons, lines, circles and rectangles, each with a popup. Draw them on the map in the block, or use the shortcodes.
* **Import.** Add the markers, lines and areas of a CSV, GeoJSON, KML or GPX file. A GPX track shows a route on the map.
* **Groups of markers** (clusters). Markers that are near to each other show as one circle with their number.
* **Heatmaps.**
* **A list of the markers** below the map. A click on a name shows that marker.
* **A search for the nearest markers** (store locator). The visitor types an address or uses the location of the browser, and sees the markers in a distance, nearest first.
* **Categories.** Give the markers a category, and visitors can show one category at a time.
* **Directions.** Each popup and each row of the list can have a directions link. You select the map service that the link opens: Google Maps, Apple Maps, Waze or OpenStreetMap. Or the visitor selects the service from a list.
* **A location button** that shows the position of the visitor on the map.
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
[waymorphic_marker address="Cathédrale Notre-Dame de Paris"]Notre-Dame[/waymorphic_marker]
[/waymorphic_map]`

Attributes of `[waymorphic_map]`:

* `lat`, `lng` - the centre of the map. `lon` and `long` are other names for `lng`.
* `address` - an address or place name, used when `lat` and `lng` are not given. A marker shows the place.
* `zoom` - 0 (the world) to 22. The default is in the settings. When the view fits two or more markers, `zoom` is the upper limit of the view (15 when it is not given).
* `style` - `positron`, `bright`, `liberty`, `dark` or `fiord`.
* `height` - a CSS length such as `400px` or `60vh`. A number is in pixels. A percentage is not a height.
* `width` - a CSS length such as `300px` or `50%`. A number is in pixels.
* The units of `height` and `width` are `px`, `vh`, `vw`, `dvh`, `svh`, `lvh`, `dvw`, `svw`, `lvw`, `vmin`, `vmax`, `em`, `rem` and `ch` (and `%` for the width). Other values, such as `calc()`, give the default.
* `marker` - `true` puts a marker at the centre.
* `label` - popup text for the marker at the centre.
* `controls` - `false` hides the zoom and fullscreen buttons.
* `scroll_zoom` - `true` lets plain scroll zoom the map. Without it, ctrl or cmd + scroll zooms the map, and on a touch screen two fingers move the map (one finger scrolls the page).
* `interactive` - `false` makes a still map.
* `title` - the name of the map for screen readers.
* `popup_title` - `false`: the popup of a marker does not start with the `title` of the marker.
* `cluster` - `true` puts markers that are near to each other in a group.
* `list` - `true` shows the list of the markers below the map.
* `locator` - `true` shows the search for the nearest markers above the map.
* `radius` - the first distance of the search. The default is 25.
* `unit` - `km` or `mi`, for the search and the list.
* `filter` - `true` shows a button for each marker category.
* `directions` - `true` adds a directions link to the popups and the list. The link opens the map service of the settings. Or give the service: `google`, `apple`, `waze` or `osm`. Or `choice`: the visitor selects the service from a list.
* `locate` - `true` shows the button that goes to the position of the visitor.
* `animation` - `drop` or `bounce`, for all the markers.
* `colour` - the colour of the marker at the centre, such as `#d63638`.

Attributes of `[waymorphic_marker]`: `lat` and `lng`, or `address`; `open="true"` shows the popup when the page opens. The text between the tags is the popup. Optional: `title` (the name in the list and the first line of the popup), `category`, `colour` (such as `#d63638`), `icon` (the URL of a picture to use as the marker) and `animation` (`drop` or `bounce`). A marker with no popup text can have a slash at the end and no closing tag: `[waymorphic_marker lat="51.5" lng="-0.12" /]`.

Use straight quotes (`"`) in the shortcodes. A user who can edit the page sees a message below the map when an address was not found, when a position is not valid, or when the search found an address very far from the places of the map that have a `lat` and a `lng` (the map must have two such places, or a centre with a `lat` and a `lng`). Visitors do not see this message. The search gives the place that it knows best: write the town in an address, and the area or the full name of the country when other towns have the same name (`address="Buckingham Palace, London"`, `address="Boston, Lincolnshire"`). Write `United Kingdom` and `United States`, not `UK` and `USA`. In a very large country, a correct town can be that far: with the full name of its area or of its country in the address (`address="Perth, Western Australia"`), it gets no message.

= Shapes =

Put the shape shortcodes in `[waymorphic_map]`. The points are `latitude,longitude` pairs with `;` between them. The text between the tags is the popup of the shape.

`[waymorphic_map]
[waymorphic_polygon points="51.50,-0.20; 51.55,-0.12; 51.50,-0.05" colour="#008a20"]The area we deliver to[/waymorphic_polygon]
[waymorphic_line points="51.50,-0.20; 51.52,-0.10; 51.51,0.00" colour="#d63638" width="4"]
[waymorphic_circle lat="51.5074" lng="-0.1276" radius="500"]
[waymorphic_rectangle points="51.48,-0.20; 51.49,-0.15"]
[/waymorphic_map]`

* `[waymorphic_polygon]` - three or more points, 500 at most.
* `[waymorphic_line]` - two or more points, 500 at most.
* `[waymorphic_circle]` - `lat` and `lng`, or `address`, and `radius` in metres.
* `[waymorphic_rectangle]` - two opposite corners.
* All shapes: `colour` (the outline), `width` (the outline, in pixels). Polygons, circles and rectangles: `fill` (the colour of the inside) and `opacity` (0 to 1).
* `[waymorphic_heatmap]` - `points`, 5000 at most. A point can have a weight as a third number: `51.5,-0.12,3`. Optional: `radius` in pixels (the default is 30) and `opacity` (0 to 1).

= Files =

`[waymorphic_map cluster="true" list="true"]
[waymorphic_file url="https://example.com/wp-content/uploads/shops.csv" category="Shops" colour="#008a20"]
[waymorphic_file url="https://example.com/wp-content/uploads/walk.gpx"]
[/waymorphic_map]`

`[waymorphic_file]` shows the markers, lines and areas of a CSV, GeoJSON, KML or GPX file. The browser of the visitor gets the file each time the page opens, so a change to the file shows on the map. Ten files for each map at most.

* A CSV file has a first row with the names of the columns: `lat` (or `latitude`), `lng` (or `lon`, `longitude`), and the optional `title` (or `name`), `description`, `category`, `colour` and `icon`. A position is a number: `51.5074`, `51,5074`, or `0.1276 W`. A row whose position has other text does not show.
* The file must be on your site, or on a server that permits your site to read it (CORS).
* The text of a file shows as plain text. HTML in a file does not operate.
* `colour` and `category` on the shortcode are for the markers that have none in the file.
* For a file with some hundreds of markers or more, use `cluster="true"`. The map draws only the markers that are not in a group, and stays quick.

In the block, "Import a file" in the Markers panel reads a file from your computer and adds its markers and shapes to the block. The file is not uploaded. A block can have 1000 markers. One file gives 100 shapes at most, and a line keeps 500 points.

= A store locator =

`[waymorphic_map locator="true" list="true" filter="true" directions="true" unit="mi" radius="10"]
[waymorphic_marker address="10 Downing Street, London" title="London shop" category="Shops"]Open 9 to 5[/waymorphic_marker]
[waymorphic_marker lat="53.4808" lng="-2.2426" title="Manchester depot" category="Depots"]
[/waymorphic_map]`

= External service =

This plugin shows maps from the Waymorphic Map tile server, `https://tiles.waymorphic.com`. The author of this plugin operates this server.

* When a visitor sees a map, the browser of the visitor gets the map style, map tiles, fonts and icons from that server. As with all web requests, the server sees the IP address and the browser of the visitor, and the tiles requested.
* When you use an `address` in a shortcode, your WordPress site sends that address to the search of the server and keeps the position for one year. If the search does not find the address, the site asks again after one day. If the search does not answer, the site asks again after five minutes.
* When you search for a place in the block editor, your browser sends the search text to the server, with the centre and the zoom of the map of the block.
* When a map has the search for the nearest markers (`locator`), the browser of the visitor sends the search text to the server, with the centre of the markers of the map: the server prefers places near the markers. With "Use my location", the position stays in the browser.

The directions link (`directions`) is a link to the map service that you select in the settings, on the shortcode or in the block:

* Google Maps, `https://www.google.com/maps/dir/` ([privacy policy](https://policies.google.com/privacy))
* Apple Maps, `https://maps.apple.com/` ([privacy policy](https://www.apple.com/legal/privacy/))
* Waze, `https://www.waze.com/ul` ([privacy policy](https://www.waze.com/legal/privacy))
* OpenStreetMap, `https://www.openstreetmap.org/directions` ([privacy policy](https://osmfoundation.org/wiki/Privacy_Policy))

The plugin sends nothing to these sites. The visitor goes there only with a click on the link, and the link has the position of the marker. The `waymorphic_map_directions_services` filter changes the list of the services.

The server has no accounts, no cookies and no analytics. See the [fair use and privacy notes](https://waymorphic.com/#fair). The service is free and best effort: there is no uptime guarantee. If you run your own Waymorphic Map server, you can set its URL in Settings > Waymorphic Map.

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, with the [OpenMapTiles](https://openmaptiles.org/) schema. The credit in the corner of each map is a licence requirement. Do not remove it.

== Installation ==

= Install the plugin =

From the plugin directory:

1. In the administration of your site, go to Plugins > Add New Plugin.
2. Search for "Waymorphic Map".
3. Select "Install Now", then "Activate".

From a zip file:

1. Go to Plugins > Add New Plugin > Upload Plugin.
2. Select the zip file of the plugin, then "Install Now".
3. Select "Activate Plugin".

The plugin has no account, no API key and no setup: you can add a map immediately.

= Your first map with the block =

1. Open a post or a page in the editor and add the "Waymorphic Map" block.
2. The block asks "Where is your map?". Type an address, a town or a postcode, then select the place from the list. The map goes there and gets a marker.
3. Click the marker and write its popup text. To add a marker, click the map at the point, then select "Add a marker here". To move a marker, drag it.
4. In the sidebar of the block, the "Map" panel has the five map styles and the height. The "Features" panel has the list of the markers, the search for the nearest markers, the category buttons and the directions link.
5. Save the page.

= Your first map with the shortcode =

1. Add a "Shortcode" block to a post or a page. The shortcode also operates in the classic editor, in a widget and in a template.
2. Write the shortcode, for example `[waymorphic_map address="10 Downing Street, London" zoom="16"]`.
3. Save the page. The section "The shortcode" of the description gives all the attributes.

= Your first store locator =

1. Add a map with a marker for each of your places. The first line of the popup text of a marker is its name in the list. Give each marker a category if you have different types of places.
2. In the "Features" panel of the block, set "List of the markers below the map", "Search for the nearest markers", "Category buttons" and "Directions link" to on. On the shortcode, these are `list="true"`, `locator="true"`, `filter="true"` and `directions="true"`.
3. Save the page. Visitors type an address, or use their location, and see the nearest places with the distances.

= The settings =

Settings > Waymorphic Map has the defaults for new maps: the style, the height, the zoom, and the map service of the directions link.

== Frequently Asked Questions ==

= Is an API key necessary? =

No. There is no account, no key and no quota.

= Is it free for commercial sites? =

Yes. Keep the credit on the map and use the service as a map. Bulk downloads of tiles are not permitted.

= Can I change the colour of the map? =

Select one of the five styles for each map, or set the default style in the settings.

= Why does the map not zoom when I scroll? =

This prevents the map from catching the scroll of the page. Hold ctrl (or cmd on a Mac) and scroll, or use the buttons. To change this, set "Scroll to zoom" on the block, or `scroll_zoom="true"` on the shortcode.

= Can I make a store locator? =

Yes. Set `locator="true"` and `list="true"` on the shortcode, or the same options in the "Features" panel of the block. Visitors type an address and see the nearest markers with their distances.

= Which map service do the directions open? =

You select it: Google Maps, Apple Maps, Waze or OpenStreetMap. Set the service for all maps in Settings > Waymorphic Map, or for one map with `directions="google"` on the shortcode or in the "Features" panel of the block. With `directions="choice"`, the visitor sees the list of the services and selects one.

= Can I change the colours of the list, the search and the buttons? =

Yes. These parts keep their look in each theme: the usual CSS rules of a theme or of the site do not change them. To change them, set CSS variables in Appearance > Customize > Additional CSS, for example:

`.wp-block-waymorphic-map { --waymorphic-map-accent: #b32d2e; --waymorphic-map-radius: 0; --waymorphic-map-list-height: 480px; }`

The variables are `--waymorphic-map-accent`, `--waymorphic-map-accent-text`, `--waymorphic-map-text`, `--waymorphic-map-muted`, `--waymorphic-map-surface`, `--waymorphic-map-border`, `--waymorphic-map-line`, `--waymorphic-map-radius`, `--waymorphic-map-font-size`, `--waymorphic-map-list-height`, `--waymorphic-map-scheme` (`light` or `dark`: the parts that the browser draws, such as the scroll bar of the list, for a dark `--waymorphic-map-surface`), `--waymorphic-map-popup-accent` (the colour of the links in a popup; a popup is white on each site, so set this colour when the accent colour is light) and `--waymorphic-map-scroll-space` (the space above the map after a click on a row of the list, for a header that stays at the top of the window). For a change that the variables do not make, write `!important` in your CSS rule.

= Can I draw shapes in the block editor? =

Yes. Open the "Shapes" panel, select a type and click the map. For a heatmap, use the shortcode.

= Can I show a route? =

Yes, as a line. Import a GPX or KML file of the route, or draw a line. The plugin does not calculate a route between two addresses: the directions link opens a map service (Google Maps, Apple Maps, Waze or OpenStreetMap) for that.

= Can I import my markers from a different map plugin? =

Export the markers as a CSV file, make sure that the first row has `lat` and `lng` columns, then use "Import a file" in the block.

= Can developers change the map? =

Yes. The `waymorphic_map_config` filter changes the configuration of a map, `waymorphic_map_tiles_url` changes the tile server, and `waymorphic_map_directions_services` changes the map services of the directions link. The address that the `waymorphic_map_directions_url` filter gives must start with `http` or `https`. A map element that you write by hand (not with the block or the shortcode) starts only with a style from the tile server of the site: the `waymorphic_map_trusted_addresses` filter adds other addresses. A classic theme that makes a map in a template (with `waymorphic_map_render()` or `do_shortcode()`) must call `wp_enqueue_style( 'waymorphic-map' )` in a function on `wp_enqueue_scripts`: without this, the styles of the map load after the map. In JavaScript, each map element has its MapLibre map in the `waymorphicMap` property.

= How do I get help or report a problem? =

Send an email to contact@waymorphic.com.

== Screenshots ==

1. A map with a marker, a popup and a directions link on a page.
2. A store locator: the visitor searches for a place, selects a category, and sees the nearest places in the list with their distances.
3. The directions link: the visitor selects Google Maps, Apple Maps, Waze or OpenStreetMap.
4. Shapes on the Bright style: an area, a line for a route, and a circle.
5. Markers with a colour for each category, on the Dark style.
6. A new block asks for the place. The search gives suggestions while you type.
7. The block in the editor: the search field on the map, the markers, and the fields of a marker in the sidebar.
8. The settings page with the defaults for new maps.

== Changelog ==

= 1.2.1 =
* Change: the name of the plugin is now "Waymorphic Map & Custom Maps - No signup required". The plugin folder, the main file and the text domain are now `waymorphic-map`. The block, the shortcodes, the settings and the maps do not change.
* Change: the plugin does not deactivate an older version of the plugin. When an older version is active too, a message on the Plugins screen, on the Dashboard and on the settings page of the plugin tells you which version to deactivate.
* Upgrade: if you installed version 1.1.0 or 1.2.0 from a zip file, install and activate this version. Then deactivate the older version on the Plugins screen and delete it (the folder `wp-free-maps` or `free-maps-waymorphic-map`). Then empty your page cache. The settings and the maps stay. If you delete the older version before you activate this version, the settings go back to the defaults (the maps stay).
* Fix: when two copies of this version are on a site, the removal of one copy does not remove the settings that the active copy uses.

= 1.2.0 =
* New: a setting for the map service of the directions link: Google Maps, Apple Maps, Waze or OpenStreetMap. Or the visitor selects the service from a list. Each map can have its own value (`directions="google"`, or the "Features" panel of the block).
* New: the list shows the row of the marker that has its popup open. A click on a marker shows its row in the list.
* New: CSS variables for the colours of the search, the category buttons and the list.
* New: the page has the list before the map starts, also without JavaScript and in a browser that cannot show the map. The page does not jump when the map starts. The markers of a file come into the list when the browser has the file.
* Security: the script cleans the HTML of each popup again in the browser. Before, a user with the role of Contributor or Author could put an element in a post that ran a script in the browser of a visitor or an administrator.
* Security: the plugin cleans the credit text of the map style before MapLibre writes it in the page. MapLibre GL JS 5.21.0 has a fault in this cleaning (GHSA-jrc7-96c5-q579): a tile server that is not the Waymorphic server, or a user with the role of Contributor or Author, could run a script in the page.
* Security: a map element in the content of a page starts only with a map style and a search from the tile server of the site (or from a filter of the site). Before, a user with the role of Contributor or Author could put a map element with a style of their choice in a post.
* Fix: in a narrow list (a telephone, a column), a name showed one letter on each line.
* Fix: the styles of a theme changed the list, the search, the category buttons, the buttons of the map and the popups. In some themes the popups could not be read. These parts now look the same in each theme: a popup is white with dark text, and a link in a popup shows as a link. If your site has its own CSS rules for these parts, they have no effect now: use the CSS variables of the plugin, or write `!important` in your rules.
* Fix: the list and the search are as wide as a map that has a width.
* Fix: the search for the nearest markers found towns in other countries ("Bristol" in the USA). The search now prefers places near the markers, and the result text gives the place that it found.
* Fix: after a search, a category button did not change the result text. "Show all" did not go back to the first view.
* Fix: a click on a group of markers on a small map moved the map away from the markers.
* Fix: a map that was less than 121 pixels high or wide did not show its markers. A map that is less than 240 pixels high has no compass button.
* Fix: a popup with a long text went out of the map. The map now moves, and a long text scrolls.
* Fix: a click on a marker that is on a shape opened two popups.
* Fix: the keyboard: the Space key on a marker also moved the page, Escape did not close a popup, the focus went away after a popup closed, and the Tab key went to markers that were not in view. The popups of shapes now have buttons for the keyboard.
* Fix: CSV files with decimal commas, with a quote in a text, or from a spreadsheet program that does not write UTF-8.
* Fix: a file that gave no answer stopped all the markers of the map. The limit is now 15 seconds for the answer and 3 minutes for the download.
* Fix: markers on the two sides of the 180° line (Fiji and Samoa) showed on a map of the world.
* Fix: right-to-left pages. The texts of the map buttons (zoom, compass, location) can now be translated.
* Fix: in the block, the fields for the position took no minus sign and no zero after the decimal point. A height of 50% made the map go away: a height cannot be a percentage. Each new marker and shape is one step for "Undo".
* New: a user who can edit the page sees a message below a shortcode map when an address was not found or a position is not valid. Before, the marker went away with no message, and a map with an address that was not found showed a desert. There is also a message when the search found an address very far from the places that have a `lat` and a `lng` ("Brighton Pier, Brighton" in New Zealand on a map of shops in England).
* New: markers at the same position stand side by side, so that each one can be clicked.
* New: polygons with holes from GeoJSON and KML files, tracks of Google Earth (`gx:Track`), and KML positions with spaces.
* New: `lon` and `long` are accepted for `lng`, and a decimal comma is accepted in `lat` and `lng`.
* New: in the block, the long lists of markers and shapes in the sidebar have pages, and a click on a marker shows its fields. A search for a country or a town opens at a zoom for a country or a town.
* Speed: with groups, the markers of a group are not in the page. A map with 1000 markers and groups moves smoothly.
* Fix: a marker or a shape with no closing tag took the popup text of the next one, and the sequence of the markers changed.
* Fix: curly quotes in a shortcode (text from a text program) made the map show the whole world.
* Fix: "&" in a name or a category showed as "&amp;amp;", and "&" in the address of a file or a picture broke the address.
* Fix: with a classic theme, the map script loaded on each page of the site. It now loads only on pages that have a map.
* Fix: a page with many addresses waited for each address when the search did not answer. The site now stops after the first failure, and keeps a found position for one year.
* Fix: a map with a very large configuration (about one million characters) made the page show a critical error.
* Fix: a position that is out of range (lat="151.2" lng="-33.8") is refused. Before, the marker went to the edge of the world.
* Fix: a marker whose picture does not load shows as the usual marker. The popup of a picture marker opens at the edge of the picture.
* Fix: a page with many maps: the oldest maps became empty when the browser had no more drawing contexts. A map now starts again when the visitor comes back to it, with the view that the visitor left.
* Fix: a message shows when the style of the map does not load. Before, the map was grey with no message.
* Fix: a popup on a narrow map, the keyboard focus ring on the map, a header that stays at the top of the window and covered the map after a click in the list, and the zoom of an iPhone on the search field.
* Fix: the name of a marker with no title joined the lines of its popup ("Eiffel TowerChamp de Mars").
* Fix: on a network of sites, the removal of the plugin removes its data from each site.
* Fix: on the settings page, a value that is not valid keeps the saved value and shows a message. Before, the default value replaced it with no message.
* Fix: in the block, Enter in the place search took a suggestion for an older text, the map could be turned (the page does not show this), and a map in a wide block kept its first width.
* Fix: `animation` on the map shortcode is for the markers of files too. The result text of the search shows the distance that the visitor selected ("12.5 km", not "13 km").
* New: the units `dvh`, `svh`, `lvh`, `dvw`, `svw`, `lvw`, `vmin`, `vmax` and `ch` for the height and the width.
* New for developers: the map element sends the `waymorphic-map:ready` event when its map is ready. `WaymorphicMap.addShapes()` adds shapes to a map that has shapes.
* Change: the plugin folder, the main file and the text domain are `free-maps-waymorphic-map` in this version. Version 1.1.0 had the name `wp-free-maps`. Version 1.2.1 changed the name again: see its entry for the upgrade steps.
* Change: the popup of a marker that has a `title` now starts with the title, if the first line of the popup text does not have it. A marker with a title and no popup text now has a popup with its title. Set `popup_title="false"` on the map shortcode to turn this off.
* Change: the name of a marker with no title (in the list, and for screen readers) is the first line of its popup text.

= 1.1.0 =
* New: polygons, lines, circles and rectangles, with the `[waymorphic_polygon]`, `[waymorphic_line]`, `[waymorphic_circle]` and `[waymorphic_rectangle]` shortcodes. In the block, draw them on the map.
* New: import of CSV, GeoJSON, KML and GPX files, in the block and with the `[waymorphic_file]` shortcode.
* New: groups of markers (clusters).
* New: heatmaps, with the `[waymorphic_heatmap]` shortcode.
* New: a colour, a picture, a category and an animation for each marker.
* New: a list of the markers below the map.
* New: a search for the nearest markers (store locator), with kilometres or miles.
* New: category buttons, a directions link and a location button.
* New: a "Features" panel in the block, and a colour, a category and a picture for each marker.

= 1.0.0 =
* First release: block, shortcodes, settings page.

== Upgrade Notice ==

= 1.2.1 =
The plugin has a new name, and its folder is now `waymorphic-map`. If you installed version 1.1.0 or 1.2.0 from a zip file: activate this version, then deactivate the older version and delete it. The settings and the maps stay.

== Third-party code ==

The plugin includes [MapLibre GL JS](https://maplibre.org/) 5.21.0 (BSD 3-Clause licence) in `assets/vendor/maplibre-gl`. The file `maplibre-gl.js` is the minified build from the npm package `maplibre-gl`. The source code is at https://github.com/maplibre/maplibre-gl-js/tree/v5.21.0.
