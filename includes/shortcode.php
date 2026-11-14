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
}

/**
 * The markers of the map shortcodes that are open, innermost last.
 *
 * @param string     $action 'open', 'add' or 'close'.
 * @param array|null $marker The marker to add.
 * @return array|null The markers, on 'close'.
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
	$markers = waymorphic_map_marker_stack( 'close' );

	// A marker at the centre: on request, or when there is a label or an address.
	$want_marker = waymorphic_map_clean_bool( $atts['marker'], '' !== $atts['label'] || '' !== $atts['address'] );
	if ( $want_marker && '' !== $lat && '' !== $lng ) {
		array_unshift(
			$markers,
			array(
				'lat'   => $lat,
				'lng'   => $lng,
				'popup' => esc_html( $atts['label'] ),
				'open'  => '' !== $atts['label'],
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
			'address' => '',
			'open'    => '',
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
				'popup' => null === $content ? '' : do_shortcode( $content ),
				'open'  => waymorphic_map_clean_bool( $atts['open'], false ),
			)
		);
	}

	return '';
}
