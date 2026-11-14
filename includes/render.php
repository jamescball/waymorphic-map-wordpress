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
				'group'         => __( 'Markers here: %d. Zoom in.', 'waymorphic-map' ),
				'noMap'         => __( 'The map cannot be shown in this browser.', 'waymorphic-map' ),
				'directions'    => __( 'Directions', 'waymorphic-map' ),
				/* translators: %d: the number of the marker. */
				'marker'        => __( 'Marker %d', 'waymorphic-map' ),
				'list'          => __( 'Places on the map', 'waymorphic-map' ),
				'all'           => __( 'All', 'waymorphic-map' ),
				'filter'        => __( 'Show a category', 'waymorphic-map' ),
				'search'        => __( 'Search', 'waymorphic-map' ),
				'searchLabel'   => __( 'Find the nearest places', 'waymorphic-map' ),
				'searchHint'    => __( 'Address, town or postcode', 'waymorphic-map' ),
				'radius'        => __( 'Distance', 'waymorphic-map' ),
				'useLocation'   => __( 'Use my location', 'waymorphic-map' ),
				'reset'         => __( 'Show all', 'waymorphic-map' ),
				'searching'     => __( 'Searching…', 'waymorphic-map' ),
				/* translators: 1: a number of places, 2: a distance such as 10 km. */
				'found'         => __( 'Places in %2$s: %1$d', 'waymorphic-map' ),
				/* translators: %s: a distance such as 10 km. */
				'none'          => __( 'No places in %s.', 'waymorphic-map' ),
				'notFound'      => __( 'The address was not found. Try a town or a postcode.', 'waymorphic-map' ),
				'searchError'   => __( 'The search did not answer. Try again.', 'waymorphic-map' ),
				'locationError' => __( 'The browser did not give your location.', 'waymorphic-map' ),
				'km'            => __( 'km', 'waymorphic-map' ),
				'mi'            => __( 'mi', 'waymorphic-map' ),
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
		$lat = waymorphic_map_clean_number( isset( $marker['lat'] ) ? $marker['lat'] : null, -90, 90 );
		$lng = waymorphic_map_clean_number( isset( $marker['lng'] ) ? $marker['lng'] : null, -180, 180 );
		if ( null === $lat || null === $lng ) {
			continue;
		}
		$item  = array(
			'lat' => $lat,
			'lng' => $lng,
		);
		$popup = isset( $marker['popup'] ) ? trim( wp_kses_post( (string) $marker['popup'] ) ) : '';
		if ( '' !== $popup ) {
			$item['popup'] = $popup;
		}
		if ( ! empty( $marker['open'] ) ) {
			$item['open'] = true;
		}
		foreach ( array( 'title', 'category' ) as $key ) {
			$text = isset( $marker[ $key ] ) && is_scalar( $marker[ $key ] ) ? sanitize_text_field( (string) $marker[ $key ] ) : '';
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
				$opacity = waymorphic_map_clean_number( isset( $shape['opacity'] ) ? $shape['opacity'] : null, 0, 1 );
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
		$width          = waymorphic_map_clean_number( isset( $shape['width'] ) ? $shape['width'] : null, 0, 20 );
		$item['width']  = null === $width ? 3 : $width;
		if ( 'line' !== $item['type'] ) {
			$opacity         = waymorphic_map_clean_number( isset( $shape['opacity'] ) ? $shape['opacity'] : null, 0, 1 );
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
 *     @type bool         $directions  Add a directions link to the popups and the list.
 *     @type bool         $locate      Show the button that goes to the position of the visitor.
 *     @type string       $animation   drop or bounce, for the markers that have no animation.
 *     @type bool         $controls    Show the zoom and fullscreen buttons.
 *     @type bool         $scroll_zoom Plain scroll zooms the map. Off: ctrl or cmd + scroll.
 *     @type bool         $interactive Off makes a still map.
 *     @type string       $title       The accessible name of the map.
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
			'wrapper'     => '',
		)
	);

	$lat     = waymorphic_map_clean_number( $args['lat'], -85, 85 );
	$lng     = waymorphic_map_clean_number( $args['lng'], -180, 180 );
	$zoom    = waymorphic_map_clean_number( $args['zoom'], 0, 22 );
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
	if ( $args['list'] || $args['locator'] ) {
		$config['unit'] = 'mi' === strtolower( trim( (string) $args['unit'] ) ) ? 'mi' : 'km';
	}
	if ( $args['locator'] ) {
		$radius              = waymorphic_map_clean_number( $args['radius'], 0.1, 20000 );
		$config['locator']   = array( 'radius' => null === $radius ? 25 : $radius );
		$config['searchUrl'] = waymorphic_map_tiles_url() . '/search';
	}
	if ( $args['directions'] ) {
		/**
		 * Filters the address of the directions link. {lat} and {lng} are the
		 * position of the marker.
		 *
		 * @param string $url The address.
		 */
		$directions = (string) apply_filters( 'waymorphic_map_directions_url', 'https://www.openstreetmap.org/directions?to={lat}%2C{lng}' );
		// esc_url_raw() removes braces, so the script gets ~lat~ and ~lng~.
		$directions = esc_url_raw( str_replace( array( '{lat}', '{lng}' ), array( '~lat~', '~lng~' ), $directions ), array( 'http', 'https' ) );
		if ( '' !== $directions ) {
			$config['directionsUrl'] = $directions;
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

	wp_enqueue_style( 'waymorphic-map' );
	wp_enqueue_script( 'waymorphic-map' );

	$css = 'height:' . waymorphic_map_clean_length( $args['height'], $options['height'] ) . ';';
	if ( '' !== (string) $args['width'] ) {
		$css .= 'width:' . waymorphic_map_clean_length( $args['width'], '100%' ) . ';';
	}

	$title   = '' !== trim( (string) $args['title'] ) ? trim( (string) $args['title'] ) : __( 'Map', 'waymorphic-map' );
	$wrapper = '' !== $args['wrapper'] ? $args['wrapper'] : 'class="wp-block-waymorphic-map"';

	return sprintf(
		'<div %1$s><div class="waymorphic-map" style="%2$s" role="region" aria-label="%3$s" data-waymorphic-map="%4$s"><noscript>%5$s</noscript></div></div>',
		$wrapper,
		esc_attr( $css ),
		esc_attr( $title ),
		// The HEX flags keep &, <, > and quotes out of the JSON, so the attribute
		// escaping cannot change it and entities in a popup stay entities.
		esc_attr( wp_json_encode( $config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT ) ),
		esc_html__( 'Turn on JavaScript to see the map.', 'waymorphic-map' )
	);
}

/**
 * Finds the coordinates of an address with the search of the tile server.
 * The answer is kept, so a page view does not make a request.
 *
 * @param string $address The address or place name.
 * @return array{lat:float,lng:float}|null
 */
function waymorphic_map_geocode( $address ) {
	$address = trim( wp_strip_all_tags( (string) $address ) );
	$length  = function_exists( 'mb_strlen' ) ? mb_strlen( $address ) : strlen( $address );
	if ( $length < 2 || $length > 200 ) {
		return null;
	}

	$key    = 'waymorphic_map_geo_' . md5( waymorphic_map_tiles_url() . '|' . strtolower( $address ) );
	$cached = get_transient( $key );
	if ( is_array( $cached ) ) {
		return isset( $cached['lat'], $cached['lng'] ) ? $cached : null;
	}

	$result   = null;
	$failed   = true;
	$response = wp_remote_get(
		add_query_arg(
			array(
				'q'     => rawurlencode( $address ),
				'limit' => 1,
			),
			waymorphic_map_tiles_url() . '/search'
		),
		array( 'timeout' => 5 )
	);

	if ( ! is_wp_error( $response ) && 200 === wp_remote_retrieve_response_code( $response ) ) {
		$failed = false;
		$data   = json_decode( wp_remote_retrieve_body( $response ), true );
		$point  = isset( $data['features'][0]['geometry']['coordinates'] ) ? $data['features'][0]['geometry']['coordinates'] : null;
		if ( is_array( $point ) && isset( $point[0], $point[1] ) && is_numeric( $point[0] ) && is_numeric( $point[1] ) ) {
			$result = array(
				'lat' => (float) $point[1],
				'lng' => (float) $point[0],
			);
		}
	}

	if ( $result ) {
		set_transient( $key, $result, MONTH_IN_SECONDS );
	} else {
		// Keep "not found" for a day, and an error for a few minutes, then try again.
		set_transient( $key, array( 'none' => true ), $failed ? 5 * MINUTE_IN_SECONDS : DAY_IN_SECONDS );
	}

	return $result;
}
