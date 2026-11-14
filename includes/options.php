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
		'positron' => __( 'Positron (light, muted)', 'waymorphic-map' ),
		'bright'   => __( 'Bright (full colour)', 'waymorphic-map' ),
		'liberty'  => __( 'Liberty (classic OpenStreetMap look)', 'waymorphic-map' ),
		'dark'     => __( 'Dark', 'waymorphic-map' ),
		'fiord'    => __( 'Fiord (dark, blue)', 'waymorphic-map' ),
	);
}

/**
 * The defaults of the plugin options.
 *
 * @return array<string,mixed>
 */
function waymorphic_map_option_defaults() {
	return array(
		'tiles_url' => WAYMORPHIC_MAP_DEFAULT_TILES_URL,
		'style'     => 'positron',
		'height'    => '400px',
		'zoom'      => 12,
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
	return (string) apply_filters( 'waymorphic_map_tiles_url', $url );
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
 * @return string
 */
function waymorphic_map_clean_length( $value, $fallback ) {
	$value = is_scalar( $value ) ? strtolower( trim( (string) $value ) ) : '';
	if ( preg_match( '/^(\d+(?:\.\d+)?)(px|%|vh|vw|em|rem)?$/', $value, $m ) && (float) $m[1] > 0 ) {
		return $m[1] . ( isset( $m[2] ) ? $m[2] : 'px' );
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
	}
	if ( ! is_numeric( $value ) ) {
		return null;
	}
	return max( $min, min( $max, (float) $value ) );
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
	$defaults = waymorphic_map_option_defaults();
	$input    = is_array( $input ) ? $input : array();

	$tiles_url = isset( $input['tiles_url'] ) ? untrailingslashit( esc_url_raw( trim( (string) $input['tiles_url'] ), array( 'http', 'https' ) ) ) : '';
	$zoom      = waymorphic_map_clean_number( isset( $input['zoom'] ) ? $input['zoom'] : null, 0, 22 );

	return array(
		'tiles_url' => '' !== $tiles_url ? $tiles_url : $defaults['tiles_url'],
		'style'     => waymorphic_map_clean_style( isset( $input['style'] ) ? $input['style'] : '', $defaults['style'] ),
		'height'    => waymorphic_map_clean_length( isset( $input['height'] ) ? $input['height'] : '', $defaults['height'] ),
		'zoom'      => null === $zoom ? $defaults['zoom'] : $zoom,
	);
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
		$pair = array_values( $pair );
		$lat  = waymorphic_map_clean_number( $pair[0], -85, 85 );
		$lng  = waymorphic_map_clean_number( $pair[1], -180, 180 );
		if ( null !== $lat && null !== $lng ) {
			$point  = array( $lng, $lat );
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
