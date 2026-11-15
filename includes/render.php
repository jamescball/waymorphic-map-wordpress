<?php
/**
 * Assets, the map markup and the address lookup. The shortcode and the
 * block both use waymorphic_map_render().
 *
 * @package WaymorphicMap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the scripts and styles. They are enqueued only on pages that show a map.
 */
function waymorphic_map_register_assets() {
	$base = plugins_url( 'assets/', WAYMORPHIC_MAP_FILE );

	wp_register_style( 'waymorphic-map-maplibre', $base . 'vendor/maplibre-gl/maplibre-gl.css', array(), WAYMORPHIC_MAP_MAPLIBRE_VERSION );
	wp_register_script( 'waymorphic-map-maplibre', $base . 'vendor/maplibre-gl/maplibre-gl.js', array(), WAYMORPHIC_MAP_MAPLIBRE_VERSION, true );

	wp_register_style( 'waymorphic-map', $base . 'css/waymorphic-map.css', array( 'waymorphic-map-maplibre' ), WAYMORPHIC_MAP_VERSION );
	wp_register_script( 'waymorphic-map', $base . 'js/waymorphic-map.js', array( 'waymorphic-map-maplibre' ), WAYMORPHIC_MAP_VERSION, true );
	wp_add_inline_script(
		'waymorphic-map',
		'window.waymorphicMapL10n = ' . wp_json_encode(
			array(
				/* translators: %d: a number of markers. */
				'group'         => __( 'Markers here: %d. Zoom in.', 'free-maps' ),
				'noMap'         => __( 'The map cannot be shown in this browser.', 'free-maps' ),
				'noStyle'       => __( 'The map did not load. Try again later.', 'free-maps' ),
				'again'         => __( 'Show the map', 'free-maps' ),
				'directions'    => __( 'Directions', 'free-maps' ),
				/* translators: %s: the name of a place. Keep the word of "Directions" in it. */
				'directionsTo'  => __( 'Directions to %s (opens in a new tab)', 'free-maps' ),
				/* translators: %s: the name of a place. Keep the word of "Directions" in it. */
				'directionsFor' => __( 'Directions to %s', 'free-maps' ),
				/* translators: The name of a list of map services, such as Google Maps. */
				'directionsIn'  => __( 'Open the directions in', 'free-maps' ),
				/* translators: %s: the name of a map service, such as Google Maps. */
				'newTab'        => __( '%s (opens in a new tab)', 'free-maps' ),
				'origin'        => __( 'The place of your search', 'free-maps' ),
				/* translators: %s: the popup text of a polygon, a line or a circle on the map. */
				'shape'         => __( 'Shape on the map: %s', 'free-maps' ),
				/* translators: %d: the number of the marker. */
				'marker'        => __( 'Marker %d', 'free-maps' ),
				'list'          => __( 'Places on the map', 'free-maps' ),
				/* translators: The button that shows the markers of all the categories. */
				'all'           => __( 'All', 'free-maps' ),
				'filter'        => __( 'Show a category', 'free-maps' ),
				/* translators: The button that starts the search for the nearest places (a verb). */
				'search'        => __( 'Search', 'free-maps' ),
				'searchLabel'   => __( 'Find the nearest places', 'free-maps' ),
				'searchHint'    => __( 'Address, town or postcode', 'free-maps' ),
				/* translators: The name of the list of distances (10 km, 25 km) of the search for the nearest places. */
				'radius'        => __( 'Distance', 'free-maps' ),
				'useLocation'   => __( 'Use my location', 'free-maps' ),
				'reset'         => __( 'Show all', 'free-maps' ),
				'searching'     => __( 'Searching…', 'free-maps' ),
				/* translators: 1: a number of places, 2: a distance such as 10 km. */
				'found'         => __( 'Places within %2$s: %1$d', 'free-maps' ),
				/* translators: %s: a distance such as 10 km. */
				'none'          => __( 'No places within %s.', 'free-maps' ),
				/* translators: 1: a number of places, 2: a distance such as 10 km, 3: the place of the search, such as Leeds, England. */
				'foundAt'       => __( 'Places within %2$s of %3$s: %1$d', 'free-maps' ),
				/* translators: 1: a distance such as 10 km, 2: the place of the search, such as Leeds, England. */
				'noneAt'        => __( 'No places within %1$s of %2$s.', 'free-maps' ),
				/* translators: The place of a search, in a text such as: Places within 10 km of your location: 2 */
				'here'          => __( 'your location', 'free-maps' ),
				'notFound'      => __( 'The address was not found. Try a town or a postcode.', 'free-maps' ),
				'searchError'   => __( 'The search did not answer. Try again.', 'free-maps' ),
				'locationError' => __( 'The browser did not give your location.', 'free-maps' ),
				/* translators: The short form of "kilometres", after a number: 10 km. */
				'km'            => __( 'km', 'free-maps' ),
				/* translators: The short form of "miles", after a number: 10 mi. */
				'mi'            => __( 'mi', 'free-maps' ),
				/* translators: A distance. 1: the number, 2: the unit (km or mi). */
				'amount'        => __( '%1$s %2$s', 'free-maps' ),
				// The tile server of the site: a map of the page can have a style and a search from it.
				'tiles'         => waymorphic_map_script_tiles( waymorphic_map_tiles_url() ),
				// The texts of the map itself, for MapLibre.
				'map'           => array(
					'AttributionControl.ToggleAttribution'       => __( 'Toggle attribution', 'free-maps' ),
					'FullscreenControl.Enter'                    => __( 'Enter fullscreen', 'free-maps' ),
					'FullscreenControl.Exit'                     => __( 'Exit fullscreen', 'free-maps' ),
					'GeolocateControl.FindMyLocation'            => __( 'Find my location', 'free-maps' ),
					'GeolocateControl.LocationNotAvailable'      => __( 'Location not available', 'free-maps' ),
					'Map.Title'                                  => __( 'Map', 'free-maps' ),
					'Marker.Title'                               => __( 'Map marker', 'free-maps' ),
					'NavigationControl.ResetBearing'             => __( 'Drag to rotate map, click to reset north', 'free-maps' ),
					'NavigationControl.ZoomIn'                   => __( 'Zoom in', 'free-maps' ),
					'NavigationControl.ZoomOut'                  => __( 'Zoom out', 'free-maps' ),
					'Popup.Close'                                => __( 'Close popup', 'free-maps' ),
					'CooperativeGesturesHandler.WindowsHelpText' => __( 'Use Ctrl + scroll to zoom the map', 'free-maps' ),
					'CooperativeGesturesHandler.MacHelpText'     => __( 'Use ⌘ + scroll to zoom the map', 'free-maps' ),
					'CooperativeGesturesHandler.MobileHelpText'  => __( 'Use two fingers to move the map', 'free-maps' ),
				),
			)
		) . ';',
		'before'
	);
}

/**
 * Cleans a list of markers.
 *
 * @param mixed $markers A list of arrays with lat, lng and the optional popup (HTML), open,
 *                       title, category, colour, icon (URL) and animation.
 * @return array<int,array<string,mixed>>
 */
function waymorphic_map_clean_markers( $markers ) {
	$clean = array();
	if ( ! is_array( $markers ) ) {
		return $clean;
	}
	foreach ( $markers as $marker ) {
		if ( ! is_array( $marker ) ) {
			continue;
		}
		$item = waymorphic_map_clean_position( isset( $marker['lat'] ) ? $marker['lat'] : null, isset( $marker['lng'] ) ? $marker['lng'] : null );
		if ( ! $item ) {
			continue;
		}
		$popup = isset( $marker['popup'] ) ? trim( wp_kses_post( (string) $marker['popup'] ) ) : '';
		if ( '' !== $popup ) {
			$item['popup'] = $popup;
		}
		if ( ! empty( $marker['open'] ) ) {
			$item['open'] = true;
		}
		foreach ( array( 'title', 'category' ) as $key ) {
			$text = isset( $marker[ $key ] ) && is_scalar( $marker[ $key ] ) ? sanitize_text_field( (string) $marker[ $key ] ) : '';
			if ( false !== strpos( $text, '&lt;' ) ) {
				// sanitize_text_field() writes a "<" that is not a tag, and the text after it, with
				// character references ("5 &lt; 6 &amp; more"). These values are text, not HTML:
				// the script and the list show them as text.
				$text = wp_specialchars_decode( $text, ENT_QUOTES );
			}
			if ( '' !== $text ) {
				$item[ $key ] = $text;
			}
		}
		$colour = waymorphic_map_clean_colour( isset( $marker['colour'] ) ? $marker['colour'] : '' );
		if ( '' !== $colour ) {
			$item['colour'] = $colour;
		}
		$icon = isset( $marker['icon'] ) && is_string( $marker['icon'] ) ? esc_url_raw( trim( $marker['icon'] ), array( 'http', 'https' ) ) : '';
		if ( '' !== $icon ) {
			$item['icon'] = $icon;
		}
		$animation = waymorphic_map_clean_animation( isset( $marker['animation'] ) ? $marker['animation'] : '' );
		if ( '' !== $animation ) {
			$item['animation'] = $animation;
		}
		$clean[] = $item;
	}
	return $clean;
}

/**
 * Cleans a list of shapes.
 *
 * @param mixed $shapes A list of arrays with type (polygon, line, circle, rectangle or
 *                      heatmap), points, radius (metres for a circle, pixels for a
 *                      heatmap), colour, fill, opacity, width and popup (HTML).
 * @return array<int,array<string,mixed>> Shapes of the types polygon, line, circle and heatmap.
 */
function waymorphic_map_clean_shapes( $shapes ) {
	$clean = array();
	if ( ! is_array( $shapes ) ) {
		return $clean;
	}
	foreach ( $shapes as $shape ) {
		if ( ! is_array( $shape ) || ! isset( $shape['type'] ) ) {
			continue;
		}
		$type = (string) $shape['type'];
		if ( 'heatmap' === $type ) {
			$points = waymorphic_map_clean_points( isset( $shape['points'] ) ? $shape['points'] : array(), 5000, true );
			if ( $points ) {
				$radius  = waymorphic_map_clean_number( isset( $shape['radius'] ) ? $shape['radius'] : null, 1, 200 );
				$opacity = waymorphic_map_clean_number( isset( $shape['opacity'] ) ? $shape['opacity'] : null, 0, 1, true );
				$clean[] = array(
					'type'    => 'heatmap',
					'points'  => $points,
					'radius'  => null === $radius ? 30 : $radius,
					'opacity' => null === $opacity ? 0.8 : $opacity,
				);
			}
			continue;
		}
		$points = waymorphic_map_clean_points( isset( $shape['points'] ) ? $shape['points'] : array() );
		$item   = array();

		if ( 'polygon' === $type && count( $points ) >= 3 ) {
			$item = array(
				'type'   => 'polygon',
				'points' => $points,
			);
			// The holes of a polygon that came from a file: the map does not fill them.
			if ( isset( $shape['holes'] ) && is_array( $shape['holes'] ) ) {
				$holes = array();
				foreach ( array_slice( $shape['holes'], 0, 20 ) as $hole ) {
					$hole = waymorphic_map_clean_points( $hole );
					if ( count( $hole ) >= 3 ) {
						$holes[] = $hole;
					}
				}
				if ( $holes ) {
					$item['holes'] = $holes;
				}
			}
		} elseif ( 'line' === $type && count( $points ) >= 2 ) {
			$item = array(
				'type'   => 'line',
				'points' => $points,
			);
		} elseif ( 'rectangle' === $type && count( $points ) >= 2 ) {
			// Two opposite corners make the four corners of a polygon.
			$item = array(
				'type'   => 'polygon',
				'points' => array(
					$points[0],
					array( $points[1][0], $points[0][1] ),
					$points[1],
					array( $points[0][0], $points[1][1] ),
				),
			);
		} elseif ( 'circle' === $type && count( $points ) >= 1 ) {
			$radius = waymorphic_map_clean_number( isset( $shape['radius'] ) ? $shape['radius'] : null, 1, 5000000 );
			$item   = array(
				'type'   => 'circle',
				'points' => array( $points[0] ),
				'radius' => null === $radius ? 1000 : $radius,
			);
		}
		if ( ! $item ) {
			continue;
		}

		$item['colour'] = waymorphic_map_clean_colour( isset( $shape['colour'] ) ? $shape['colour'] : '', '#1f6feb' );
		$width          = waymorphic_map_clean_number( isset( $shape['width'] ) ? $shape['width'] : null, 0, 20, true );
		$item['width']  = null === $width ? 3 : $width;
		if ( 'line' !== $item['type'] ) {
			$opacity         = waymorphic_map_clean_number( isset( $shape['opacity'] ) ? $shape['opacity'] : null, 0, 1, true );
			$item['fill']    = waymorphic_map_clean_colour( isset( $shape['fill'] ) ? $shape['fill'] : '', $item['colour'] );
			$item['opacity'] = null === $opacity ? 0.25 : $opacity;
		}
		$popup = isset( $shape['popup'] ) ? trim( wp_kses_post( (string) $shape['popup'] ) ) : '';
		if ( '' !== $popup ) {
			$item['popup'] = $popup;
		}
		$clean[] = $item;
	}
	return $clean;
}

/**
 * Cleans a list of files that the map reads in the browser.
 *
 * @param mixed $files A list of arrays with url, and the optional colour and category.
 * @return array<int,array<string,string>>
 */
function waymorphic_map_clean_files( $files ) {
	$clean = array();
	if ( ! is_array( $files ) ) {
		return $clean;
	}
	foreach ( $files as $file ) {
		$url = is_array( $file ) && isset( $file['url'] ) && is_string( $file['url'] ) ? esc_url_raw( trim( $file['url'] ), array( 'http', 'https' ) ) : '';
		if ( '' === $url ) {
			continue;
		}
		$item   = array( 'url' => $url );
		$colour = waymorphic_map_clean_colour( isset( $file['colour'] ) ? $file['colour'] : '' );
		if ( '' !== $colour ) {
			$item['colour'] = $colour;
		}
		$category = isset( $file['category'] ) && is_scalar( $file['category'] ) ? sanitize_text_field( (string) $file['category'] ) : '';
		if ( '' !== $category ) {
			$item['category'] = $category;
		}
		$clean[] = $item;
		if ( count( $clean ) >= 10 ) {
			break;
		}
	}
	return $clean;
}

/**
 * The HTML of one map.
 *
 * @param array<string,mixed> $args {
 *     All are optional.
 *
 *     @type float|string $lat         Latitude of the centre.
 *     @type float|string $lng         Longitude of the centre.
 *     @type float|string $zoom        Zoom, 0 to 22.
 *     @type string       $style       positron, bright, liberty, dark or fiord.
 *     @type string       $height      CSS length; a number means pixels.
 *     @type string       $width       CSS length; a number means pixels.
 *     @type array        $markers     Arrays with lat, lng, popup (HTML), open, title, category,
 *                                     colour, icon (URL) and animation (drop or bounce).
 *     @type array        $shapes      Arrays with type (polygon, line, circle, rectangle, heatmap),
 *                                     points, radius, colour, fill, opacity, width and popup (HTML).
 *     @type array        $files       Arrays with url (a CSV, GeoJSON, KML or GPX file), and the
 *                                     optional colour and category. The browser reads the files.
 *     @type bool         $cluster     Put markers that are near to each other in a group.
 *     @type bool         $list        Show the list of the markers below the map.
 *     @type bool         $locator     Show the search for the nearest markers above the map.
 *     @type float|string $radius      The first distance of the search. The default is 25.
 *     @type string       $unit        km or mi, for the search and the list.
 *     @type bool         $filter      Show the category buttons above the map.
 *     @type bool|string  $directions  Add a directions link to the popups and the list. True: the
 *                                     link opens the map service of the settings. Or the name of a
 *                                     service (osm, google, apple, waze), or 'choice': the visitor
 *                                     selects the service from a list.
 *     @type bool         $locate      Show the button that goes to the position of the visitor.
 *     @type string       $animation   drop or bounce, for the markers that have no animation.
 *     @type bool         $controls    Show the zoom and fullscreen buttons.
 *     @type bool         $scroll_zoom Plain scroll zooms the map. Off: ctrl or cmd + scroll.
 *     @type bool         $interactive Off makes a still map.
 *     @type string       $title       The accessible name of the map.
 *     @type bool         $popup_title False: the popup of a marker does not start with the title of the marker.
 *     @type string       $wrapper     Ready-made wrapper attributes (the block supplies them).
 * }
 * @return string
 */
function waymorphic_map_render( $args ) {
	$options = waymorphic_map_options();
	$args    = wp_parse_args(
		$args,
		array(
			'lat'         => null,
			'lng'         => null,
			'zoom'        => null,
			'style'       => '',
			'height'      => '',
			'width'       => '',
			'markers'     => array(),
			'shapes'      => array(),
			'files'       => array(),
			'cluster'     => false,
			'list'        => false,
			'locator'     => false,
			'radius'      => null,
			'unit'        => 'km',
			'filter'      => false,
			'directions'  => false,
			'locate'      => false,
			'animation'   => '',
			'controls'    => true,
			'scroll_zoom' => false,
			'interactive' => true,
			'title'       => '',
			'popup_title' => true,
			'wrapper'     => '',
		)
	);

	$centre  = waymorphic_map_clean_position( $args['lat'], $args['lng'] );
	$lat     = $centre ? $centre['lat'] : null;
	$lng     = $centre ? $centre['lng'] : null;
	$zoom    = waymorphic_map_clean_number( $args['zoom'], 0, 22, true );
	$markers = waymorphic_map_clean_markers( $args['markers'] );
	$shapes  = waymorphic_map_clean_shapes( $args['shapes'] );
	$files   = waymorphic_map_clean_files( $args['files'] );
	$style   = waymorphic_map_clean_style( $args['style'], $options['style'] );

	$animation = waymorphic_map_clean_animation( $args['animation'] );
	if ( '' !== $animation ) {
		foreach ( $markers as $index => $marker ) {
			if ( ! isset( $marker['animation'] ) ) {
				$markers[ $index ]['animation'] = $animation;
			}
		}
	}

	$config = array(
		'style'       => waymorphic_map_tiles_url() . '/styles/' . $style,
		'markers'     => $markers,
		'controls'    => (bool) $args['controls'],
		'scrollZoom'  => (bool) $args['scroll_zoom'],
		'interactive' => (bool) $args['interactive'],
	);

	if ( $shapes ) {
		$config['shapes'] = $shapes;
	}
	if ( $files ) {
		$config['files'] = $files;
		if ( '' !== $animation ) {
			// For the markers of the files: the script gives it to them.
			$config['animation'] = $animation;
		}
	}
	if ( $args['cluster'] ) {
		$config['cluster'] = true;
	}
	if ( $args['list'] ) {
		$config['list'] = true;
	}
	if ( $args['filter'] ) {
		$config['filter'] = true;
	}
	if ( $args['locate'] ) {
		$config['locate'] = true;
	}
	if ( ! $args['popup_title'] ) {
		// The popup of a marker does not start with the title of the marker.
		$config['popupTitle'] = false;
	}
	if ( $args['list'] || $args['locator'] ) {
		$config['unit'] = 'mi' === strtolower( trim( (string) $args['unit'] ) ) ? 'mi' : 'km';
	}
	if ( $args['locator'] ) {
		$radius              = waymorphic_map_clean_number( $args['radius'], 0.1, 20000 );
		$config['locator']   = array( 'radius' => null === $radius ? 25 : $radius );
		$config['searchUrl'] = waymorphic_map_tiles_url() . '/search';
	}
	$directions = waymorphic_map_clean_directions( $args['directions'], waymorphic_map_default_directions() );
	if ( '' !== $directions ) {
		$services = waymorphic_map_directions_services();
		if ( 'choice' !== $directions ) {
			$services = array( $directions => $services[ $directions ] );
		}
		$links = array();
		foreach ( $services as $id => $service ) {
			$url = $service['url'];
			if ( 'choice' !== $directions ) {
				/**
				 * Filters the address of the directions link, when the link opens one map
				 * service. {lat} and {lng} are the position of the marker.
				 *
				 * @param string $url     The address.
				 * @param string $service The name of the map service, such as osm or google.
				 */
				$url = (string) apply_filters( 'waymorphic_map_directions_url', $url, $id );
			}
			// esc_url_raw() removes braces, so the script gets ~lat~ and ~lng~.
			$url = esc_url_raw( str_replace( array( '{lat}', '{lng}' ), array( '~lat~', '~lng~' ), $url ), array( 'http', 'https' ) );
			if ( '' !== $url ) {
				$links[] = array(
					'label' => $service['label'],
					'url'   => $url,
				);
			}
		}
		if ( $links ) {
			// One service: a link. More than one: the visitor selects from a list.
			$config['directions'] = $links;
		}
	}

	if ( null !== $lat && null !== $lng ) {
		// An explicit centre.
		$config['center'] = array( $lng, $lat );
		$config['zoom']   = null === $zoom ? (float) $options['zoom'] : $zoom;
	} elseif ( 1 === count( $markers ) && ! $shapes && ! $files ) {
		$config['center'] = array( $markers[0]['lng'], $markers[0]['lat'] );
		$config['zoom']   = null === $zoom ? (float) $options['zoom'] : $zoom;
	} elseif ( $markers || $shapes || $files ) {
		// The script fits the view to the markers and the shapes; an explicit zoom is the upper limit.
		$config['fit'] = true;
		if ( null !== $zoom ) {
			$config['zoom'] = $zoom;
		}
		if ( ! $markers && ! $shapes ) {
			// The world, until the files are there.
			$config['center'] = array( 0, 20 );
		}
	} else {
		// Nothing to show: the whole world.
		$config['center'] = array( 0, 20 );
		$config['zoom']   = null === $zoom ? 1 : $zoom;
	}

	/**
	 * Filters the configuration the script gets for one map.
	 *
	 * @param array $config The configuration.
	 * @param array $args   The arguments of waymorphic_map_render().
	 */
	$config = apply_filters( 'waymorphic_map_config', $config, $args );
	if ( ! is_array( $config ) ) {
		// A filter gave an object: the functions below read an array.
		$config = json_decode( (string) wp_json_encode( $config ), true );
		$config = is_array( $config ) ? $config : array();
	}

	wp_enqueue_style( 'waymorphic-map' );
	wp_enqueue_script( 'waymorphic-map' );
	waymorphic_map_trust( isset( $config['style'] ) ? $config['style'] : null );
	waymorphic_map_trust( isset( $config['searchUrl'] ) ? $config['searchUrl'] : null );

	$css   = 'height:' . waymorphic_map_clean_length( $args['height'], waymorphic_map_clean_length( $options['height'], '400px', false ), false ) . ';';
	$width = '';
	if ( '' !== (string) $args['width'] ) {
		$width = 'width:' . waymorphic_map_clean_length( $args['width'], '100%' ) . ';';
		$css  .= $width;
	}

	$title   = '' !== trim( (string) $args['title'] ) ? trim( (string) $args['title'] ) : __( 'Map', 'free-maps' );
	$wrapper = '' !== $args['wrapper'] ? $args['wrapper'] : 'class="wp-block-waymorphic-map"';

	// The HEX flags keep &, <, > and quotes out of the JSON, so the attribute
	// escaping cannot change it and entities in a popup stay entities.
	$json = (string) wp_json_encode( $config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT );
	$data = '';
	if ( strlen( $json ) > 100000 ) {
		// A map with very many markers or points. WordPress runs regular expressions on the
		// content of a page, and they fail on an HTML tag of about one million characters:
		// the page then showed a critical error. A script element is not a tag of this type.
		// In the texts of the configuration, "[" is written as \u005b, so that WordPress does not
		// read the text of a popup as a shortcode.
		// The HEX flags write each quote in a text as \u0022: a text is all that is between two quotes.
		$safe = preg_replace_callback(
			'/"[^"]*"/',
			function ( $text ) {
				return str_replace( '[', '\u005b', $text[0] );
			},
			$json
		);
		$data = '<script type="application/json" class="waymorphic-map__config">' . ( is_string( $safe ) ? $safe : $json ) . '</script>';
		$json = '{}';
	}

	return sprintf(
		'<div %1$s>%6$s<div class="waymorphic-map" style="%2$s" role="region" aria-label="%3$s" data-waymorphic-map="%4$s">%8$s<noscript>%5$s</noscript></div>%7$s</div>',
		$wrapper,
		esc_attr( $css ),
		waymorphic_map_plain_brackets( esc_attr( $title ) ),
		waymorphic_map_plain_brackets( esc_attr( $json ) ),
		esc_html__( 'Turn on JavaScript to see the map.', 'free-maps' ),
		waymorphic_map_tools_space( $config, $width ),
		waymorphic_map_plain_brackets( waymorphic_map_list_html( $config, $width ) ),
		$data
	);
}

/**
 * The address of the tile server that the script got (waymorphicMapL10n.tiles).
 * A filter that a theme adds late, or a filter for some pages only, can give a
 * different address when a map is made.
 *
 * @param string|null $set The address, to keep it. Null to read it.
 * @return string
 */
function waymorphic_map_script_tiles( $set = null ) {
	static $url = '';
	if ( null !== $set ) {
		$url = (string) $set;
	}
	return $url;
}

/**
 * Tells the script that a style or a search address is from this site. The
 * script starts a map of the page only with a style from the tile server of
 * the site or with a style that this function gave: a writer with no right
 * to use scripts can put a map element with an attribute of their choice in
 * a post, and a style has much control of the map. A filter
 * (waymorphic_map_config) can give a map a different style: this function
 * makes it known.
 *
 * @param mixed $value The style of a map (an address, or a style as an array), or its search address.
 */
function waymorphic_map_trust( $value ) {
	static $told = array();

	if ( ! $told ) {
		/**
		 * Filters more addresses that a map element of a page can use as its style or its search:
		 * full addresses, or the start of addresses with a slash at the end. For map elements
		 * that this plugin does not make (HTML of a template, for example).
		 *
		 * @param array $addresses The addresses. Empty by default.
		 */
		$more = apply_filters( 'waymorphic_map_trusted_addresses', array() );
		$told = array( '' => true );
		foreach ( is_array( $more ) ? $more : array() as $address ) {
			if ( is_string( $address ) ) {
				waymorphic_map_trust( $address );
			}
		}
	}
	if ( ! is_string( $value ) && ! is_array( $value ) && ! is_object( $value ) ) {
		return;
	}
	$json = (string) wp_json_encode( $value, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT );
	// The address that the script knows, not the address of this moment: a filter can give a different one now.
	$tile = waymorphic_map_script_tiles();
	if ( '' === $json || isset( $told[ $json ] ) || ( is_string( $value ) && '' !== $tile && 0 === strpos( $value, $tile . '/' ) ) ) {
		// Told before, or an address on the tile server that the script knows.
		return;
	}
	$told[ $json ] = true;
	// Array.isArray(): an element of the page with the ID "waymorphicMapTrust" is not the list.
	wp_add_inline_script( 'waymorphic-map', 'window.waymorphicMapTrust = ( Array.isArray( window.waymorphicMapTrust ) ? window.waymorphicMapTrust : [] ).concat( [ ' . $json . ' ] );', 'before' );
}

/**
 * Writes each "[" of HTML text and attribute values as a character reference.
 * WordPress reads the shortcodes of a page after it made the blocks: a name
 * or a popup text such as "[gallery]" in the output of the map block ran as a
 * shortcode, and its output went into the configuration of the map. The
 * browser shows the reference as "[". Not for the text of a script element.
 *
 * @param string $html HTML that this plugin made, in which "[" is only in text and in attribute values.
 * @return string
 */
function waymorphic_map_plain_brackets( $html ) {
	return str_replace( '[', '&#91;', $html );
}

/**
 * The name of a marker in the list: its title, the text of its popup, or its
 * number. The script has the same rule (markerName).
 *
 * @param array<string,mixed> $marker The marker.
 * @param int                 $index  The position of the marker, from 0.
 * @return string Plain text.
 */
function waymorphic_map_marker_name( $marker, $index ) {
	if ( isset( $marker['title'] ) && is_scalar( $marker['title'] ) && '' !== (string) $marker['title'] ) {
		return (string) $marker['title'];
	}
	if ( isset( $marker['popup'] ) && is_scalar( $marker['popup'] ) ) {
		// The first line of the popup: "Eiffel Tower" for "<strong>Eiffel Tower</strong><br>Champ de Mars".
		// A line ends at a line break and at the end of a paragraph, a heading or a list item.
		$words = (string) preg_replace( '/\s+/u', ' ', (string) $marker['popup'] );
		$words = (string) preg_replace( '#</?(?:br|p|div|li|h[1-6]|tr|td|th)\b#i', "\n$0", $words );
		$words = html_entity_decode( wp_strip_all_tags( $words ), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		$lines = array();
		foreach ( explode( "\n", $words ) as $line ) {
			// A no-break space is white space here, as in the script. The visual editor writes it for an empty line.
			$clean = preg_replace( '/[\s\x{00A0}\x{FEFF}]+/u', ' ', $line );
			$clean = trim( null === $clean ? $line : $clean );
			if ( '' !== $clean ) {
				$lines[] = $clean;
			}
		}
		$words = $lines ? $lines[0] : '';
		if ( '' !== $words ) {
			$length = function_exists( 'mb_strlen' ) ? mb_strlen( $words ) : strlen( $words );
			if ( $length > 80 ) {
				$words = ( function_exists( 'mb_substr' ) ? mb_substr( $words, 0, 77 ) : substr( $words, 0, 77 ) ) . '…';
			}
			return $words;
		}
	}
	/* translators: %d: the number of the marker. */
	return sprintf( __( 'Marker %d', 'free-maps' ), $index + 1 );
}

/**
 * The list of the markers below the map, as text. The page has the list
 * before the script starts: the page does not jump when the map starts, and
 * the list shows when the browser cannot show the map. The script makes the
 * rows into buttons.
 *
 * @param array<string,mixed> $config The configuration of the map.
 * @param string              $width  The width of the map as a style declaration, or ''.
 * @return string HTML, or '' when the map has no list.
 */
function waymorphic_map_list_html( $config, $width ) {
	if ( empty( $config['list'] ) || empty( $config['markers'] ) || ! is_array( $config['markers'] ) ) {
		return '';
	}
	$services = isset( $config['directions'] ) && is_array( $config['directions'] ) ? array_values( $config['directions'] ) : array();
	$rows     = '';
	foreach ( array_values( $config['markers'] ) as $index => $marker ) {
		if ( ! is_array( $marker ) || ! isset( $marker['lat'], $marker['lng'] ) ) {
			continue;
		}
		$name   = waymorphic_map_marker_name( $marker, $index );
		$colour = waymorphic_map_clean_colour( isset( $marker['colour'] ) ? $marker['colour'] : '', '#1f6feb' );
		$detail = isset( $marker['category'] ) && is_scalar( $marker['category'] ) && '' !== (string) $marker['category']
			? ' <span class="waymorphic-map__list-detail">' . esc_html( (string) $marker['category'] ) . '</span>'
			: '';
		$link   = '';
		if ( $services && isset( $services[0]['url'] ) && is_string( $services[0]['url'] ) ) {
			// A link to the first map service. With more than one service, the script makes it a button with the list of the services.
			$url  = esc_url( str_replace( array( '~lat~', '~lng~' ), array( (string) (float) $marker['lat'], (string) (float) $marker['lng'] ), $services[0]['url'] ), array( 'http', 'https' ) );
			$link = '' === $url ? '' : sprintf(
				'<a class="waymorphic-map__directions%1$s" href="%2$s" target="_blank" rel="noopener" aria-label="%3$s">%4$s</a>',
				count( $services ) > 1 ? ' waymorphic-map__directions--menu' : '',
				$url,
				/* translators: %s: the name of a place. Keep the word of "Directions" in it. */
				esc_attr( sprintf( __( 'Directions to %s (opens in a new tab)', 'free-maps' ), $name ) ),
				esc_html__( 'Directions', 'free-maps' )
			);
		}
		$rows .= sprintf(
			'<li class="waymorphic-map__list-item"><span class="waymorphic-map__list-button waymorphic-map__list-button--text"><span class="waymorphic-map__list-dot" aria-hidden="true" style="background:%1$s"></span><span class="waymorphic-map__list-text"><span class="waymorphic-map__list-name">%2$s</span>%3$s</span></span>%4$s</li>',
			esc_attr( $colour ),
			esc_html( $name ),
			$detail,
			$link
		);
	}
	if ( '' === $rows ) {
		return '';
	}
	return sprintf(
		'<ul class="waymorphic-map__list" role="list" aria-label="%1$s"%2$s>%3$s</ul>',
		esc_attr__( 'Places on the map', 'free-maps' ),
		'' !== $width ? ' style="' . esc_attr( $width ) . '"' : '',
		$rows
	);
}

/**
 * The search and the category buttons above the map, as the script makes
 * them. They are not visible and do nothing until the script makes them
 * again: they keep the space, so that the page does not jump when the map
 * starts. The script (addPanels) must make the same elements.
 *
 * @param array<string,mixed> $config The configuration of the map.
 * @param string              $width  The width of the map as a style declaration, or ''.
 * @return string HTML, or '' when the map has no search and no category buttons.
 */
function waymorphic_map_tools_space( $config, $width ) {
	$parts = '';

	if ( ! empty( $config['locator'] ) ) {
		$unit    = isset( $config['unit'] ) && 'mi' === $config['unit'] ? __( 'mi', 'free-maps' ) : __( 'km', 'free-maps' );
		$first   = isset( $config['locator']['radius'] ) && is_numeric( $config['locator']['radius'] ) && (float) $config['locator']['radius'] > 0 ? (float) $config['locator']['radius'] : 25.0;
		$values  = array_unique( array( 1.0, 5.0, 10.0, 25.0, 50.0, 100.0, 200.0, $first ) );
		$options = '';
		sort( $values );
		foreach ( $values as $value ) {
			$options .= sprintf(
				'<option%1$s>%2$s</option>',
				$value === $first ? ' selected' : '',
				/* translators: A distance. 1: the number, 2: the unit (km or mi). */
				esc_html( sprintf( __( '%1$s %2$s', 'free-maps' ), number_format_i18n( $value, floor( $value ) === $value ? 0 : ( round( $value, 1 ) === $value ? 1 : 2 ) ), $unit ) )
			);
		}
		$parts .= sprintf(
			// A div, not a form: the map can be in a form of the page, and a form cannot be in a form.
			'<div class="waymorphic-map__locator"><input type="search" class="waymorphic-map__locator-input" placeholder="%1$s" disabled><select class="waymorphic-map__locator-radius" disabled>%2$s</select><button type="button" class="waymorphic-map__button" disabled>%3$s</button><button type="button" class="waymorphic-map__button waymorphic-map__button--plain" disabled>%4$s</button><p class="waymorphic-map__status"></p></div>',
			esc_attr__( 'Address, town or postcode', 'free-maps' ),
			$options,
			esc_html__( 'Search', 'free-maps' ),
			esc_html__( 'Use my location', 'free-maps' )
		);
	}

	if ( ! empty( $config['filter'] ) && ! empty( $config['markers'] ) && is_array( $config['markers'] ) ) {
		$categories = array();
		foreach ( $config['markers'] as $marker ) {
			if ( is_array( $marker ) && isset( $marker['category'] ) && is_scalar( $marker['category'] ) && '' !== (string) $marker['category'] ) {
				$categories[ (string) $marker['category'] ] = true;
			}
		}
		if ( $categories ) {
			$chips = '<button type="button" class="waymorphic-map__chip" aria-pressed="true" disabled>' . esc_html__( 'All', 'free-maps' ) . '</button>';
			foreach ( array_keys( $categories ) as $category ) {
				$chips .= '<button type="button" class="waymorphic-map__chip" aria-pressed="false" disabled>' . esc_html( (string) $category ) . '</button>';
			}
			$parts .= '<div class="waymorphic-map__filter">' . $chips . '</div>';
		}
	}

	if ( '' === $parts ) {
		return '';
	}
	// The style attribute: the copy is not visible also when the style file of the plugin comes
	// late (a map that a template of a classic theme makes). The script removes it.
	return sprintf(
		'<div class="waymorphic-map__tools waymorphic-map__tools--wait" aria-hidden="true" style="visibility:hidden;%1$s">%2$s</div>',
		esc_attr( $width ),
		waymorphic_map_plain_brackets( $parts )
	);
}

/**
 * Tells if the content of a post has a map: the block, the shortcode, or a
 * synced pattern that has one of them.
 *
 * @param string $content The content of a post.
 * @param int    $depth   The number of patterns that were opened to get here.
 * @return bool
 */
function waymorphic_map_content_has_map( $content, $depth = 0 ) {
	// Plain text searches: has_shortcode() needs much time for a post with a very large block.
	if ( false !== strpos( $content, '<!-- wp:waymorphic/map' ) || false !== strpos( $content, '[waymorphic_map' ) ) {
		return true;
	}
	if ( $depth < 2 && false !== strpos( $content, '<!-- wp:block ' ) && preg_match_all( '/<!-- wp:block \{[^}]*"ref":(\d+)/', $content, $found ) ) {
		foreach ( array_slice( array_unique( $found[1] ), 0, 10 ) as $id ) {
			$pattern = get_post( (int) $id );
			if ( $pattern instanceof WP_Post && 'wp_block' === $pattern->post_type && waymorphic_map_content_has_map( (string) $pattern->post_content, $depth + 1 ) ) {
				return true;
			}
		}
	}
	return false;
}

/**
 * Loads the styles in the head of a page that has a map: in a post of the
 * page (one post, or the posts of a blog or search page), in a synced
 * pattern of such a post, or in a widget of a sidebar. For a map that a
 * template makes with do_shortcode(), the styles come when the map is made,
 * which can be after the head: such a theme can call
 * wp_enqueue_style( 'waymorphic-map' ) before wp_head().
 */
function waymorphic_map_enqueue_early() {
	global $wp_query, $template;

	// A block template makes the page before the head: the styles of a map that it shows are in time.
	// On a page that lists posts (a blog, a category, a search), a block template shows mostly
	// excerpts, with no map: the styles must not load for each such page. For one post or page, the
	// styles load here: a template of PHP (a page builder) can make the page after the head. A
	// block theme can also use a template of PHP for a list (home.php, a template of a plugin): then
	// the list is made after the head, as in a classic theme. WordPress has the template of the
	// request in $template. When it is not known, the type of the theme tells.
	if ( is_string( $template ) && '' !== $template ) {
		$blocks = wp_normalize_path( ABSPATH . WPINC . '/template-canvas.php' ) === wp_normalize_path( $template );
	} else {
		$blocks = function_exists( 'wp_is_block_theme' ) && wp_is_block_theme();
	}
	if ( ! is_singular() && $blocks ) {
		return;
	}

	$found = false;
	$posts = $wp_query instanceof WP_Query && is_array( $wp_query->posts ) ? $wp_query->posts : array();
	foreach ( $posts as $post ) {
		if ( $post instanceof WP_Post && waymorphic_map_content_has_map( (string) $post->post_content ) ) {
			$found = true;
			break;
		}
	}
	// The widgets of the sidebars that the theme has. A block theme makes the page before the
	// head: its styles are in time. WordPress has these options in memory: no database query.
	if ( ! $found && ! ( function_exists( 'wp_is_block_theme' ) && wp_is_block_theme() ) ) {
		$sidebars = wp_get_sidebars_widgets();
		foreach ( is_array( $sidebars ) ? $sidebars : array() as $sidebar => $widgets ) {
			if ( 'wp_inactive_widgets' === $sidebar || ! is_array( $widgets ) || ! is_registered_sidebar( $sidebar ) ) {
				continue;
			}
			foreach ( $widgets as $widget ) {
				if ( ! is_string( $widget ) || ! preg_match( '/^(block|text|custom_html)-(\d+)$/', $widget, $part ) ) {
					continue;
				}
				$all  = get_option( 'widget_' . $part[1] );
				$one  = is_array( $all ) && isset( $all[ (int) $part[2] ] ) && is_array( $all[ (int) $part[2] ] ) ? $all[ (int) $part[2] ] : array();
				$text = ( isset( $one['content'] ) && is_string( $one['content'] ) ? $one['content'] : '' ) . ( isset( $one['text'] ) && is_string( $one['text'] ) ? $one['text'] : '' );
				if ( '' !== $text && waymorphic_map_content_has_map( $text ) ) {
					$found = true;
					break 2;
				}
			}
		}
	}
	if ( $found ) {
		wp_enqueue_style( 'waymorphic-map' );
	}
}

/**
 * Finds the coordinates of an address with the search of the tile server.
 * The answer is kept, so a page view does not make a request.
 *
 * @param string $address The address or place name.
 * @return array{lat:float,lng:float,label?:string,state?:string,country?:string,countrycode?:string}|null The position,
 *         and the name, the area and the country of the place that the search found.
 */
function waymorphic_map_geocode( $address ) {
	// True when the search did not answer in this page view.
	static $down = false;
	// The number of addresses that the search refused in this page view.
	static $refused = 0;

	$address = trim( wp_strip_all_tags( (string) $address ) );
	$length  = function_exists( 'mb_strlen' ) ? mb_strlen( $address ) : strlen( $address );
	if ( $length < 2 || $length > 200 ) {
		waymorphic_map_geocode_state( 'none' );
		return null;
	}

	$query = array(
		'q'     => rawurlencode( $address ),
		'limit' => 1,
	);

	// The same key as in version 1.1: the answers that a site kept are used.
	$key    = 'waymorphic_map_geo_' . md5( waymorphic_map_tiles_url() . '|' . strtolower( $address ) );
	$cached = get_transient( $key );
	if ( is_array( $cached ) ) {
		$found = isset( $cached['lat'], $cached['lng'] );
		waymorphic_map_geocode_state( $found ? 'found' : 'none' );
		return $found ? $cached : null;
	}

	// The search did not answer a short time ago. A page with many addresses must
	// not wait for each of them: one page view waits, at most each five minutes.
	if ( $down || $refused >= 2 || get_transient( 'waymorphic_map_geo_down' ) ) {
		waymorphic_map_geocode_state( 'down' );
		return null;
	}

	$result   = null;
	$response = wp_remote_get( add_query_arg( $query, waymorphic_map_tiles_url() . '/search' ), array( 'timeout' => 5 ) );

	$code = is_wp_error( $response ) ? 0 : (int) wp_remote_retrieve_response_code( $response );
	if ( 0 === $code || $code >= 500 || 429 === $code || 408 === $code ) {
		// No answer, a fault of the server, or too many requests: no more lookups for five minutes.
		$down = true;
		set_transient( 'waymorphic_map_geo_down', 1, 5 * MINUTE_IN_SECONDS );
		waymorphic_map_geocode_state( 'down' );
		return null;
	}
	if ( 200 !== $code ) {
		// The server refused this address (a firewall can refuse a text). This is an answer for
		// one address: the other addresses of the site continue. A server that refuses each
		// address (it has no search, or it blocks the site) gets two requests for each page view.
		++$refused;
		set_transient( $key, array( 'none' => true ), HOUR_IN_SECONDS );
		waymorphic_map_geocode_state( 'none' );
		return null;
	}

	$data  = json_decode( wp_remote_retrieve_body( $response ), true );
	$point = isset( $data['features'][0]['geometry']['coordinates'] ) ? $data['features'][0]['geometry']['coordinates'] : null;
	if ( is_array( $point ) && isset( $point[0], $point[1] ) && is_numeric( $point[0] ) && is_numeric( $point[1] ) ) {
		$result = array(
			'lat' => (float) $point[1],
			'lng' => (float) $point[0],
		);
		// The name, the area and the country of the place: for the message that the editors of
		// a page see when the place is far from the other places of the map.
		$properties = isset( $data['features'][0]['properties'] ) && is_array( $data['features'][0]['properties'] ) ? $data['features'][0]['properties'] : array();
		foreach ( array( 'label' => 200, 'state' => 80, 'country' => 80, 'countrycode' => 2 ) as $name => $limit ) {
			$text = isset( $properties[ $name ] ) && is_string( $properties[ $name ] ) ? sanitize_text_field( $properties[ $name ] ) : '';
			if ( '' !== $text ) {
				$result[ $name ] = function_exists( 'mb_substr' ) ? mb_substr( $text, 0, $limit ) : substr( $text, 0, $limit );
			}
		}
	}

	// Keep a position for a year: an address does not move, and a marker must not go off the
	// page because the search does not answer at the time of a new lookup. Keep "not found"
	// for a day.
	set_transient( $key, $result ? $result : array( 'none' => true ), $result ? YEAR_IN_SECONDS : DAY_IN_SECONDS );
	waymorphic_map_geocode_state( $result ? 'found' : 'none' );

	return $result;
}

/**
 * The result of the last address lookup, for the message that the editors of a page see.
 *
 * @param string|null $state 'found', 'none' (the address was not found) or 'down' (the search
 *                           did not answer) to set the result. Null to read it.
 * @return string
 */
function waymorphic_map_geocode_state( $state = null ) {
	static $last = '';
	if ( null !== $state ) {
		$last = $state;
	}
	return $last;
}
