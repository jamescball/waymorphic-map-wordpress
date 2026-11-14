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
			array( 'noMap' => __( 'The map cannot be shown in this browser.', 'waymorphic-map' ) )
		) . ';',
		'before'
	);
}

/**
 * Cleans a list of markers.
 *
 * @param mixed $markers A list of arrays with lat, lng and an optional popup (HTML).
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
		$clean[] = $item;
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
 *     @type array        $markers     Arrays with lat, lng, popup (HTML) and open.
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
	$style   = waymorphic_map_clean_style( $args['style'], $options['style'] );

	$config = array(
		'style'       => waymorphic_map_tiles_url() . '/styles/' . $style,
		'markers'     => $markers,
		'controls'    => (bool) $args['controls'],
		'scrollZoom'  => (bool) $args['scroll_zoom'],
		'interactive' => (bool) $args['interactive'],
	);

	if ( null !== $lat && null !== $lng ) {
		// An explicit centre.
		$config['center'] = array( $lng, $lat );
		$config['zoom']   = null === $zoom ? (float) $options['zoom'] : $zoom;
	} elseif ( 1 === count( $markers ) ) {
		$config['center'] = array( $markers[0]['lng'], $markers[0]['lat'] );
		$config['zoom']   = null === $zoom ? (float) $options['zoom'] : $zoom;
	} elseif ( count( $markers ) > 1 ) {
		// The script fits the view to the markers; an explicit zoom is the upper limit.
		$config['fit'] = true;
		if ( null !== $zoom ) {
			$config['zoom'] = $zoom;
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
