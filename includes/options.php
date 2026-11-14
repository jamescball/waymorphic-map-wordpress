<?php
/**
 * Options, defaults and input cleaning.
 *
 * @package WaymorphicMap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The map styles the tile server has, with their labels.
 *
 * @return array<string,string>
 */
function waymorphic_map_styles() {
	return array(
		'positron' => __( 'Positron (light, muted)', 'free-maps' ),
		'bright'   => __( 'Bright (full colour)', 'free-maps' ),
		'liberty'  => __( 'Liberty (classic OpenStreetMap look)', 'free-maps' ),
		'dark'     => __( 'Dark', 'free-maps' ),
		'fiord'    => __( 'Fiord (dark, blue)', 'free-maps' ),
	);
}

/**
 * The defaults of the plugin options.
 *
 * @return array<string,mixed>
 */
function waymorphic_map_option_defaults() {
	return array(
		'tiles_url'  => WAYMORPHIC_MAP_DEFAULT_TILES_URL,
		'style'      => 'positron',
		'height'     => '400px',
		'zoom'       => 12,
		'directions' => 'osm',
	);
}

/**
 * The plugin options, with the defaults for the ones that are not set.
 *
 * @return array<string,mixed>
 */
function waymorphic_map_options() {
	$saved = get_option( 'waymorphic_map_options', array() );
	if ( ! is_array( $saved ) ) {
		$saved = array();
	}
	return array_merge( waymorphic_map_option_defaults(), $saved );
}

/**
 * The tile server URL, without a slash at the end.
 *
 * @return string
 */
function waymorphic_map_tiles_url() {
	$options = waymorphic_map_options();
	$url     = untrailingslashit( esc_url_raw( $options['tiles_url'], array( 'http', 'https' ) ) );
	if ( '' === $url ) {
		$url = WAYMORPHIC_MAP_DEFAULT_TILES_URL;
	}

	/**
	 * Filters the tile server URL.
	 *
	 * @param string $url The URL, without a slash at the end.
	 */
	$filtered = apply_filters( 'waymorphic_map_tiles_url', $url );
	// The result of a filter can have a slash at the end, or be no address.
	$filtered = is_string( $filtered ) ? untrailingslashit( esc_url_raw( trim( $filtered ), array( 'http', 'https' ) ) ) : '';

	return '' !== $filtered ? $filtered : $url;
}

/**
 * A style name the tile server has, or the fallback.
 *
 * @param mixed  $style    The input.
 * @param string $fallback The value when the input is not a style name.
 * @return string
 */
function waymorphic_map_clean_style( $style, $fallback = 'positron' ) {
	$style = is_string( $style ) ? strtolower( trim( $style ) ) : '';
	return array_key_exists( $style, waymorphic_map_styles() ) ? $style : $fallback;
}

/**
 * A CSS length from user input: a number means pixels.
 *
 * @param mixed  $value    The input, e.g. 400, "400px", "60vh", "100%".
 * @param string $fallback The value when the input is not a length.
 * @param bool   $percent  Permit a percentage. A width can be a percentage. A height cannot:
 *                         the element around the map has no height, thus the map would have none.
 * @return string
 */
function waymorphic_map_clean_length( $value, $fallback, $percent = true ) {
	$value = is_scalar( $value ) ? strtolower( trim( (string) $value ) ) : '';
	if ( preg_match( '/^(\d+(?:\.\d+)?)(px|%|vh|vw|em|rem)?$/', $value, $m ) && (float) $m[1] > 0 ) {
		$unit = isset( $m[2] ) ? $m[2] : 'px';
		if ( '%' !== $unit || $percent ) {
			return $m[1] . $unit;
		}
	}
	return $fallback;
}

/**
 * A number in a range, or null when the input is not a number.
 *
 * @param mixed $value The input.
 * @param float $min   The smallest value.
 * @param float $max   The largest value.
 * @return float|null
 */
function waymorphic_map_clean_number( $value, $min, $max ) {
	if ( is_string( $value ) ) {
		$value = trim( $value );
		// "51,5074": many countries write a comma for the decimals.
		if ( preg_match( '/^[+-]?\d+,\d+$/', $value ) ) {
			$value = str_replace( ',', '.', $value );
		}
	}
	if ( ! is_numeric( $value ) ) {
		return null;
	}
	return max( $min, min( $max, (float) $value ) );
}

/**
 * A position on the map, or null when the input is not a position. A value
 * that is out of range is not a position (lat="151.2" lng="-33.8" has the two
 * values in the wrong sequence): it is not moved to the edge of the world.
 *
 * @param mixed $lat The latitude, -90 to 90.
 * @param mixed $lng The longitude, -180 to 180.
 * @return array{lat:float,lng:float}|null
 */
function waymorphic_map_clean_position( $lat, $lng ) {
	$lat = waymorphic_map_clean_number( $lat, -91, 91 );
	$lng = waymorphic_map_clean_number( $lng, -181, 181 );
	if ( null === $lat || null === $lng || abs( $lat ) > 90 || abs( $lng ) > 180 ) {
		return null;
	}
	return array(
		// The map shows the world to this latitude: a marker at a pole shows at the edge.
		'lat' => max( -85.05, min( 85.05, $lat ) ),
		'lng' => $lng,
	);
}

/**
 * A boolean from a shortcode or block attribute.
 *
 * @param mixed $value    The input.
 * @param bool  $fallback The value when the input is empty.
 * @return bool
 */
function waymorphic_map_clean_bool( $value, $fallback ) {
	if ( is_bool( $value ) ) {
		return $value;
	}
	if ( null === $value || '' === $value ) {
		return $fallback;
	}
	return in_array( strtolower( trim( (string) $value ) ), array( '1', 'true', 'yes', 'on' ), true );
}

/**
 * Cleans the plugin options when they are saved.
 *
 * @param mixed $input The submitted values.
 * @return array<string,mixed>
 */
function waymorphic_map_sanitize_options( $input ) {
	// WordPress can call this function two times for one save: each message shows one time.
	static $told = array();

	$defaults = waymorphic_map_option_defaults();
	// A value that is not valid does not change the saved value.
	$saved = waymorphic_map_options();
	$input = is_array( $input ) ? $input : array();
	$tell  = function ( $field, $message ) use ( &$told ) {
		if ( ! isset( $told[ $field ] ) && function_exists( 'add_settings_error' ) ) {
			$told[ $field ] = true;
			add_settings_error( 'waymorphic_map_options', 'waymorphic_map_' . $field, $message );
		}
	};
	$text  = function ( $key ) use ( $input ) {
		return isset( $input[ $key ] ) && is_scalar( $input[ $key ] ) ? trim( (string) $input[ $key ] ) : '';
	};

	// The tile server: empty is the default server. An address must have a host, and no query.
	$tiles_url = $defaults['tiles_url'];
	$typed     = $text( 'tiles_url' );
	if ( '' !== $typed ) {
		if ( ! preg_match( '#^[a-z][a-z0-9+.-]*:#i', $typed ) && 0 !== strpos( $typed, '/' ) ) {
			// "tiles.example.com": https, as a page with https cannot load a map from http.
			$typed = 'https://' . $typed;
		}
		$url   = untrailingslashit( esc_url_raw( $typed, array( 'http', 'https' ) ) );
		$parts = '' !== $url ? wp_parse_url( $url ) : false;
		if ( is_array( $parts ) && ! empty( $parts['host'] ) && ! empty( $parts['scheme'] ) && empty( $parts['query'] ) && empty( $parts['fragment'] ) ) {
			$tiles_url = $url;
		} else {
			$tiles_url = $saved['tiles_url'];
			$tell( 'tiles_url', __( 'The address of the tile server is not valid, and was not changed. Use an address such as https://tiles.example.com, with no "?" and no "#".', 'free-maps' ) );
		}
	}

	$height = waymorphic_map_clean_length( $text( 'height' ), '', false );
	if ( '' === $height ) {
		$height = waymorphic_map_clean_length( $saved['height'], $defaults['height'], false );
		if ( '' !== $text( 'height' ) ) {
			$tell( 'height', __( 'The height is not valid, and was not changed. Use a number of pixels (400) or a value such as 60vh. A percentage is not permitted.', 'free-maps' ) );
		}
	}

	$zoom = waymorphic_map_clean_number( $text( 'zoom' ), 0, 22 );
	if ( null === $zoom ) {
		$zoom = waymorphic_map_clean_number( $saved['zoom'], 0, 22 );
		$zoom = null === $zoom ? $defaults['zoom'] : $zoom;
		if ( '' !== $text( 'zoom' ) ) {
			$tell( 'zoom', __( 'The zoom is not valid, and was not changed. Use a number from 0 to 22.', 'free-maps' ) );
		}
	}

	$directions = waymorphic_map_clean_directions( $text( 'directions' ), '' );
	if ( '' === $directions ) {
		$directions = waymorphic_map_clean_directions( $saved['directions'], '' );
	}

	return array(
		'tiles_url'  => $tiles_url,
		'style'      => waymorphic_map_clean_style( $text( 'style' ), waymorphic_map_clean_style( $saved['style'], $defaults['style'] ) ),
		'height'     => $height,
		'zoom'       => $zoom,
		'directions' => '' !== $directions ? $directions : $defaults['directions'],
	);
}

/**
 * The map services that the directions link can open.
 *
 * @return array<string,array<string,string>> For each service: its label and its url. In the
 *                                             url, {lat} and {lng} are the position of the marker.
 */
function waymorphic_map_directions_services() {
	// The sequence is the sequence of the list that the visitor sees.
	$services = array(
		'google' => array(
			'label' => 'Google Maps',
			'url'   => 'https://www.google.com/maps/dir/?api=1&destination={lat}%2C{lng}',
		),
		'apple'  => array(
			'label' => 'Apple Maps',
			'url'   => 'https://maps.apple.com/?daddr={lat}%2C{lng}',
		),
		'waze'   => array(
			'label' => 'Waze',
			'url'   => 'https://www.waze.com/ul?ll={lat}%2C{lng}&navigate=yes',
		),
		'osm'    => array(
			'label' => 'OpenStreetMap',
			'url'   => 'https://www.openstreetmap.org/directions?to={lat}%2C{lng}',
		),
	);

	/**
	 * Filters the map services that the directions link can open.
	 *
	 * @param array $services For each service: an array with 'label' and 'url'. In the url,
	 *                        {lat} and {lng} are the position of the marker. The key is the
	 *                        name of the service in the settings, the shortcode and the block:
	 *                        lower-case letters, digits, - and _.
	 */
	$services = apply_filters( 'waymorphic_map_directions_services', $services );

	$clean = array();
	if ( is_array( $services ) ) {
		foreach ( $services as $id => $service ) {
			$id = sanitize_key( (string) $id );
			if ( '' === $id || 'choice' === $id || ! is_array( $service ) || empty( $service['url'] ) || ! is_string( $service['url'] ) ) {
				continue;
			}
			$clean[ $id ] = array(
				'label' => isset( $service['label'] ) && is_scalar( $service['label'] ) && '' !== (string) $service['label'] ? sanitize_text_field( (string) $service['label'] ) : $id,
				'url'   => $service['url'],
			);
		}
	}
	return $clean;
}

/**
 * The map service of the settings for the directions link.
 *
 * @return string The name of a service, 'choice', or '' when there is no service.
 */
function waymorphic_map_default_directions() {
	$options = waymorphic_map_options();
	$value   = waymorphic_map_clean_directions( $options['directions'], '' );
	if ( '' === $value ) {
		// The saved service is not there now: use the first one.
		$services = waymorphic_map_directions_services();
		$value    = $services ? (string) key( $services ) : '';
	}
	return $value;
}

/**
 * The value of a directions setting: which map service the directions link opens.
 *
 * @param mixed  $value   The input: true or a "yes" word (the service of the settings), the
 *                        name of a service, 'choice' (the visitor selects the service from a
 *                        list), or false, a "no" word or an unknown name (no directions link).
 * @param string $default The value for true.
 * @return string The name of a service, 'choice', or '' for no directions link.
 */
function waymorphic_map_clean_directions( $value, $default = 'osm' ) {
	if ( true === $value ) {
		return $default;
	}
	$value = is_scalar( $value ) ? strtolower( trim( (string) $value ) ) : '';
	if ( in_array( $value, array( '1', 'true', 'yes', 'on' ), true ) ) {
		return $default;
	}
	if ( 'choice' === $value || array_key_exists( $value, waymorphic_map_directions_services() ) ) {
		return $value;
	}
	return '';
}

/**
 * A hex colour such as #1f6feb or #fff, or the fallback.
 *
 * @param mixed  $value    The input.
 * @param string $fallback The value when the input is not a hex colour.
 * @return string
 */
function waymorphic_map_clean_colour( $value, $fallback = '' ) {
	$value = is_string( $value ) ? strtolower( trim( $value ) ) : '';
	return preg_match( '/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/', $value ) ? $value : $fallback;
}

/**
 * The marker animations.
 *
 * @param mixed $value The input.
 * @return string 'drop', 'bounce' or ''.
 */
function waymorphic_map_clean_animation( $value ) {
	$value = is_string( $value ) ? strtolower( trim( $value ) ) : '';
	return in_array( $value, array( 'drop', 'bounce' ), true ) ? $value : '';
}

/**
 * A list of points from text such as "51.5,-0.12; 51.6,-0.1".
 *
 * @param mixed $value   Text with "lat,lng" pairs that ; or | divide, or a list of [ lat, lng ] arrays.
 * @param int   $max     The largest number of points.
 * @param bool  $weights Keep a third number of a point, 0 to 100: its weight in a heatmap.
 * @return array<int,array<int,float>> The points as [ lng, lat ] or [ lng, lat, weight ].
 */
function waymorphic_map_clean_points( $value, $max = 500, $weights = false ) {
	$pairs = array();
	if ( is_string( $value ) ) {
		foreach ( preg_split( '/[;|]/', $value ) as $pair ) {
			$pairs[] = array_map( 'trim', explode( ',', $pair ) );
		}
	} elseif ( is_array( $value ) ) {
		$pairs = $value;
	}

	$points = array();
	foreach ( $pairs as $pair ) {
		if ( ! is_array( $pair ) || count( $pair ) < 2 ) {
			continue;
		}
		$pair     = array_values( $pair );
		$position = waymorphic_map_clean_position( $pair[0], $pair[1] );
		if ( $position ) {
			$point  = array( $position['lng'], $position['lat'] );
			$weight = $weights && isset( $pair[2] ) ? waymorphic_map_clean_number( $pair[2], 0, 100 ) : null;
			if ( null !== $weight ) {
				$point[] = $weight;
			}
			$points[] = $point;
		}
		if ( count( $points ) >= $max ) {
			break;
		}
	}
	return $points;
}
