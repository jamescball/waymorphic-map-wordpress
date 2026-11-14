<?php
/**
 * The [waymorphic_map] and [waymorphic_marker] shortcodes.
 *
 * @package WaymorphicMap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the shortcodes.
 */
function waymorphic_map_register_shortcodes() {
	add_shortcode( 'waymorphic_map', 'waymorphic_map_shortcode' );
	add_shortcode( 'waymorphic_marker', 'waymorphic_map_marker_shortcode' );
	foreach ( array( 'polygon', 'line', 'circle', 'rectangle', 'heatmap' ) as $type ) {
		add_shortcode( 'waymorphic_' . $type, 'waymorphic_map_shape_shortcode' );
	}
	add_shortcode( 'waymorphic_file', 'waymorphic_map_file_shortcode' );
}

/**
 * The markers, shapes and files of the map shortcodes that are open, innermost
 * last. A shape is an array with a 'type' key, a file an array with a 'url' key.
 *
 * @param string     $action 'open', 'add' or 'close'.
 * @param array|null $marker The marker or the shape to add.
 * @return array|null The markers and shapes, on 'close'.
 */
function waymorphic_map_marker_stack( $action, $marker = null ) {
	static $stack = array();

	if ( 'open' === $action ) {
		$stack[] = array();
	} elseif ( 'add' === $action && $stack ) {
		$stack[ count( $stack ) - 1 ][] = $marker;
	} elseif ( 'close' === $action ) {
		return $stack ? array_pop( $stack ) : array();
	}
	return null;
}

/**
 * [waymorphic_map lat="51.5074" lng="-0.1276" zoom="11" style="positron" height="400"]
 *
 * @param array|string $atts    The attributes.
 * @param string|null  $content [waymorphic_marker] shortcodes, when the shortcode has a closing tag.
 * @return string
 */
function waymorphic_map_shortcode( $atts, $content = null ) {
	$atts = shortcode_atts(
		array(
			'lat'         => '',
			'lng'         => '',
			'address'     => '',
			'zoom'        => '',
			'style'       => '',
			'height'      => '',
			'width'       => '',
			'marker'      => '',
			'label'       => '',
			'colour'      => '',
			'color'       => '',
			'cluster'     => '',
			'list'        => '',
			'locator'     => '',
			'radius'      => '',
			'unit'        => '',
			'filter'      => '',
			'directions'  => '',
			'locate'      => '',
			'animation'   => '',
			'controls'    => '',
			'scroll_zoom' => '',
			'interactive' => '',
			'title'       => '',
		),
		$atts,
		'waymorphic_map'
	);

	// WordPress pairs a map shortcode that has no closing tag with the closing
	// tag of a later map on the page. Then the content holds that later map:
	// show this map alone, and give the closing tag back to the rest.
	$after = '';
	if ( null !== $content && false !== strpos( $content, '[waymorphic_map' ) ) {
		$after   = do_shortcode( $content . '[/waymorphic_map]' );
		$content = null;
	}

	$lat = $atts['lat'];
	$lng = $atts['lng'];
	if ( ( '' === $lat || '' === $lng ) && '' !== $atts['address'] ) {
		$found = waymorphic_map_geocode( $atts['address'] );
		if ( $found ) {
			$lat = $found['lat'];
			$lng = $found['lng'];
		}
	}

	// The markers inside the shortcode.
	waymorphic_map_marker_stack( 'open' );
	if ( null !== $content && '' !== $content ) {
		do_shortcode( $content );
	}
	$markers = array();
	$shapes  = array();
	$files   = array();
	foreach ( waymorphic_map_marker_stack( 'close' ) as $item ) {
		if ( isset( $item['url'] ) ) {
			$files[] = $item;
		} elseif ( isset( $item['type'] ) ) {
			$shapes[] = $item;
		} else {
			$markers[] = $item;
		}
	}

	// A marker at the centre: on request, or when there is a label or an address.
	$want_marker = waymorphic_map_clean_bool( $atts['marker'], '' !== $atts['label'] || '' !== $atts['address'] );
	if ( $want_marker && '' !== $lat && '' !== $lng ) {
		array_unshift(
			$markers,
			array(
				'lat'   => $lat,
				'lng'   => $lng,
				'popup'  => esc_html( $atts['label'] ),
				'open'   => '' !== $atts['label'],
				'title'  => $atts['label'],
				'colour' => '' !== $atts['colour'] ? $atts['colour'] : $atts['color'],
			)
		);
	}

	return waymorphic_map_render(
		array(
			'lat'         => $lat,
			'lng'         => $lng,
			'zoom'        => $atts['zoom'],
			'style'       => $atts['style'],
			'height'      => $atts['height'],
			'width'       => $atts['width'],
			'markers'     => $markers,
			'shapes'      => $shapes,
			'files'       => $files,
			'cluster'     => waymorphic_map_clean_bool( $atts['cluster'], false ),
			'list'        => waymorphic_map_clean_bool( $atts['list'], false ),
			'locator'     => waymorphic_map_clean_bool( $atts['locator'], false ),
			'radius'      => $atts['radius'],
			'unit'        => $atts['unit'],
			'filter'      => waymorphic_map_clean_bool( $atts['filter'], false ),
			'directions'  => waymorphic_map_clean_bool( $atts['directions'], false ),
			'locate'      => waymorphic_map_clean_bool( $atts['locate'], false ),
			'animation'   => $atts['animation'],
			'controls'    => waymorphic_map_clean_bool( $atts['controls'], true ),
			'scroll_zoom' => waymorphic_map_clean_bool( $atts['scroll_zoom'], false ),
			'interactive' => waymorphic_map_clean_bool( $atts['interactive'], true ),
			'title'       => $atts['title'],
		)
	) . $after;
}

/**
 * [waymorphic_marker lat="51.5" lng="-0.12"]Popup text[/waymorphic_marker], inside [waymorphic_map].
 *
 * @param array|string $atts    The attributes.
 * @param string|null  $content The popup text.
 * @return string Always empty: the map shortcode shows the marker.
 */
function waymorphic_map_marker_shortcode( $atts, $content = null ) {
	$atts = shortcode_atts(
		array(
			'lat'     => '',
			'lng'     => '',
			'address'   => '',
			'open'      => '',
			'title'     => '',
			'category'  => '',
			'colour'    => '',
			'color'     => '',
			'icon'      => '',
			'animation' => '',
		),
		$atts,
		'waymorphic_marker'
	);

	$lat = $atts['lat'];
	$lng = $atts['lng'];
	if ( ( '' === $lat || '' === $lng ) && '' !== $atts['address'] ) {
		$found = waymorphic_map_geocode( $atts['address'] );
		if ( $found ) {
			$lat = $found['lat'];
			$lng = $found['lng'];
		}
	}

	if ( '' !== $lat && '' !== $lng ) {
		waymorphic_map_marker_stack(
			'add',
			array(
				'lat'   => $lat,
				'lng'   => $lng,
				'popup'     => null === $content ? '' : do_shortcode( $content ),
				'open'      => waymorphic_map_clean_bool( $atts['open'], false ),
				'title'     => $atts['title'],
				'category'  => $atts['category'],
				'colour'    => '' !== $atts['colour'] ? $atts['colour'] : $atts['color'],
				'icon'      => $atts['icon'],
				'animation' => $atts['animation'],
			)
		);
	}

	return '';
}

/**
 * The shapes, inside [waymorphic_map]:
 *
 * [waymorphic_polygon points="51.5,-0.2; 51.6,-0.1; 51.5,0"]Popup text[/waymorphic_polygon]
 * [waymorphic_line points="51.5,-0.2; 51.6,-0.1" colour="#d63638" width="4"]
 * [waymorphic_circle lat="51.5" lng="-0.12" radius="500"]
 * [waymorphic_rectangle points="51.5,-0.2; 51.6,-0.1"]
 * [waymorphic_heatmap points="51.5,-0.2; 51.6,-0.1,3" radius="30"]
 *
 * @param array|string $atts    The attributes.
 * @param string|null  $content The popup text.
 * @param string       $tag     The name of the shortcode.
 * @return string Always empty: the map shortcode shows the shape.
 */
function waymorphic_map_shape_shortcode( $atts, $content = null, $tag = '' ) {
	$atts = shortcode_atts(
		array(
			'points'  => '',
			'lat'     => '',
			'lng'     => '',
			'address' => '',
			'radius'  => '',
			'colour'  => '',
			'color'   => '',
			'fill'    => '',
			'opacity' => '',
			'width'   => '',
		),
		$atts,
		$tag
	);

	$type   = str_replace( 'waymorphic_', '', $tag );
	$points = $atts['points'];
	if ( 'circle' === $type && '' === $points ) {
		// The centre of a circle: lat and lng, or an address.
		$lat = $atts['lat'];
		$lng = $atts['lng'];
		if ( ( '' === $lat || '' === $lng ) && '' !== $atts['address'] ) {
			$found = waymorphic_map_geocode( $atts['address'] );
			if ( $found ) {
				$lat = $found['lat'];
				$lng = $found['lng'];
			}
		}
		$points = $lat . ',' . $lng;
	}

	waymorphic_map_marker_stack(
		'add',
		array(
			'type'    => $type,
			'points'  => $points,
			'radius'  => $atts['radius'],
			'colour'  => '' !== $atts['colour'] ? $atts['colour'] : $atts['color'],
			'fill'    => $atts['fill'],
			'opacity' => $atts['opacity'],
			'width'   => $atts['width'],
			'popup'   => null === $content ? '' : do_shortcode( $content ),
		)
	);

	return '';
}

/**
 * [waymorphic_file url="https://example.com/places.csv"], inside [waymorphic_map]:
 * the markers and shapes of a CSV, GeoJSON, KML or GPX file.
 *
 * @param array|string $atts The attributes.
 * @return string Always empty: the map shortcode shows the file.
 */
function waymorphic_map_file_shortcode( $atts ) {
	$atts = shortcode_atts(
		array(
			'url'      => '',
			'colour'   => '',
			'color'    => '',
			'category' => '',
		),
		$atts,
		'waymorphic_file'
	);

	if ( '' !== trim( $atts['url'] ) ) {
		waymorphic_map_marker_stack(
			'add',
			array(
				'url'      => $atts['url'],
				'colour'   => '' !== $atts['colour'] ? $atts['colour'] : $atts['color'],
				'category' => $atts['category'],
			)
		);
	}

	return '';
}
