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
 * The text of a shortcode attribute. The editor saves "&" as "&amp;" in the
 * content of a post, and a text attribute is not HTML: without this, the
 * list and the popups showed "&amp;".
 *
 * @param mixed $value The value of the attribute.
 * @return string
 */
function waymorphic_map_attribute_text( $value ) {
	return is_scalar( $value ) ? html_entity_decode( (string) $value, ENT_QUOTES | ENT_HTML5, 'UTF-8' ) : '';
}

/**
 * The popup HTML of a marker or a shape shortcode. WordPress makes paragraphs
 * in the content of a post before it reads the shortcodes: the text between
 * the tags can start with </p> and end with <p>. These gave empty lines in
 * the popup.
 *
 * @param string|null $content The text between the tags of the shortcode.
 * @return string
 */
function waymorphic_map_popup_html( $content ) {
	if ( null === $content ) {
		return '';
	}
	// A shortcode in the popup can print script and style elements. The cleaning of the popup
	// removes their tags and keeps their text: the code showed as text in the popup.
	$html = (string) preg_replace( '#<(script|style)\b[^>]*>.*?</\1\s*>#is', '', do_shortcode( $content ) );
	$html = (string) preg_replace( '#^(?:\s|<br\s*/?>|</p>)+|(?:\s|<br\s*/?>|<p>)+$#i', '', $html );
	return force_balance_tags( $html );
}

/**
 * The things that the person who made the page must know: an address that
 * was not found, a position that is not valid. The map shortcode shows them
 * below the map to the users who can edit the page. Visitors do not see them.
 *
 * @param string|null $message A message to add. Null to get all the messages and remove them.
 * @return array<int,string>
 */
function waymorphic_map_problems( $message = null ) {
	static $problems = array();
	if ( null !== $message ) {
		if ( count( $problems ) < 10 && ! in_array( $message, $problems, true ) ) {
			$problems[] = $message;
		}
		return $problems;
	}
	$all      = $problems;
	$problems = array();
	return $all;
}

/**
 * Adds the message for an address that gave no position.
 *
 * @param string $address The address.
 */
function waymorphic_map_address_problem( $address ) {
	if ( 'down' === waymorphic_map_geocode_state() ) {
		waymorphic_map_problems( __( 'The address search did not answer. The places that have an address and no lat and lng do not show until it answers.', 'free-maps' ) );
	} else {
		/* translators: %s: an address. */
		waymorphic_map_problems( sprintf( __( 'The address "%s" was not found. Write it in a different way, or use lat and lng.', 'free-maps' ), $address ) );
	}
}

/**
 * The lat and lng of a shortcode: lon and long are other names for lng.
 *
 * @param array<string,mixed> $atts The attributes of the shortcode.
 * @return array<int,string> The lat and the lng, as text.
 */
function waymorphic_map_attribute_position( $atts ) {
	$lng = $atts['lng'];
	foreach ( array( 'lon', 'long' ) as $name ) {
		if ( '' === $lng && isset( $atts[ $name ] ) ) {
			$lng = $atts[ $name ];
		}
	}
	return array( trim( (string) $atts['lat'] ), trim( (string) $lng ) );
}

/**
 * Reads the attributes that WordPress did not read because their quotes are
 * the curly quotes of a text program: lat=”51.5” label=“Our shop”. Without
 * this, such a map shows the world and no error.
 *
 * @param mixed $atts The attributes from WordPress.
 * @return array<string|int,mixed>
 */
function waymorphic_map_fix_quotes( $atts ) {
	if ( ! is_array( $atts ) ) {
		return array();
	}
	// Each kind of curly quote and prime that text programs make.
	$quote = '[“”„‟″‶«»‘’‚′]';
	$fixed = array();
	// The name of the attribute whose value goes on in the next words: label=“Our shop”.
	$open = null;
	foreach ( $atts as $key => $value ) {
		if ( ! is_string( $value ) ) {
			$fixed[ $key ] = $value;
			continue;
		}
		$ends = 1 === preg_match( '/' . $quote . '$/u', $value );
		if ( is_int( $key ) ) {
			if ( null === $open ) {
				$fixed[] = $value;
			} else {
				$fixed[ $open ] .= ' ' . preg_replace( '/' . $quote . '$/u', '', $value );
				if ( $ends ) {
					$open = null;
				}
			}
			continue;
		}
		$open = null;
		if ( 1 === preg_match( '/^' . $quote . '/u', $value ) ) {
			$fixed[ $key ] = (string) preg_replace( '/^' . $quote . '|' . $quote . '$/u', '', $value );
			$length        = function_exists( 'mb_strlen' ) ? mb_strlen( $value ) : strlen( $value );
			if ( ! $ends || 1 === $length ) {
				$open = $key;
			}
		} else {
			$fixed[ $key ] = $value;
		}
	}
	return $fixed;
}

/**
 * A point near the markers of the map shortcode that is open: the address
 * lookup prefers places near it. Without it, "Brighton Pier, Brighton" is in
 * New Zealand.
 *
 * @param array<int,float>|null|false $point [ lat, lng ] to set the point, null to clear it, false to read it.
 * @return array<int,float>|null
 */
function waymorphic_map_near( $point = false ) {
	static $near = null;
	if ( false !== $point ) {
		$near = $point;
	}
	return $near;
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
			'lon'         => '',
			'long'        => '',
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
		waymorphic_map_fix_quotes( $atts ),
		'waymorphic_map'
	);
	foreach ( array( 'label', 'title', 'address' ) as $key ) {
		$atts[ $key ] = waymorphic_map_attribute_text( $atts[ $key ] );
	}

	// WordPress pairs a map shortcode that has no closing tag with the closing
	// tag of a later map on the page. Then the content holds that later map:
	// show this map alone, and give the closing tag back to the rest.
	$after = '';
	if ( null !== $content && false !== strpos( $content, '[waymorphic_map' ) ) {
		$after   = do_shortcode( $content . '[/waymorphic_map]' );
		$content = null;
	}

	// The messages of the maps before this one are not for this map.
	waymorphic_map_problems();

	list( $lat, $lng ) = waymorphic_map_attribute_position( $atts );
	if ( ( '' === $lat || '' === $lng ) && '' !== $atts['address'] ) {
		$found = waymorphic_map_geocode( $atts['address'] );
		if ( $found ) {
			$lat = $found['lat'];
			$lng = $found['lng'];
		} else {
			waymorphic_map_address_problem( $atts['address'] );
			// No centre: the zoom was for the address. Without this, the map showed a small part of a desert.
			$atts['zoom'] = '';
		}
	} elseif ( ( '' !== $lat || '' !== $lng ) && ! waymorphic_map_clean_position( $lat, $lng ) ) {
		/* translators: 1: a latitude, 2: a longitude. */
		waymorphic_map_problems( sprintf( __( 'The centre of the map (lat="%1$s" lng="%2$s") is not a position. The lat is a number from -90 to 90, the lng a number from -180 to 180.', 'free-maps' ), $lat, $lng ) );
		$atts['zoom'] = '';
	}

	// The markers inside the shortcode. Their address lookups prefer places near the centre of the map.
	waymorphic_map_marker_stack( 'open' );
	waymorphic_map_near( is_numeric( $lat ) && is_numeric( $lng ) ? array( (float) $lat, (float) $lng ) : null );
	if ( null !== $content && '' !== $content ) {
		do_shortcode( $content );
	}
	waymorphic_map_near( null );
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

	// The messages for the users who can edit this page.
	$notice   = '';
	$problems = waymorphic_map_problems();
	$post_id  = get_the_ID();
	if ( $problems && ( $post_id ? current_user_can( 'edit_post', $post_id ) : current_user_can( 'edit_posts' ) ) ) {
		$notice = '<div class="waymorphic-map__notice" role="note"><strong>'
			. esc_html__( 'Map: only the editors of this page see this message.', 'free-maps' )
			. '</strong><ul><li>' . implode( '</li><li>', array_map( 'esc_html', $problems ) ) . '</li></ul></div>';
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
			'directions'  => $atts['directions'],
			'locate'      => waymorphic_map_clean_bool( $atts['locate'], false ),
			'animation'   => $atts['animation'],
			'controls'    => waymorphic_map_clean_bool( $atts['controls'], true ),
			'scroll_zoom' => waymorphic_map_clean_bool( $atts['scroll_zoom'], false ),
			'interactive' => waymorphic_map_clean_bool( $atts['interactive'], true ),
			'title'       => $atts['title'],
		)
	) . $notice . $after;
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
			'lat'       => '',
			'lng'       => '',
			'lon'       => '',
			'long'      => '',
			'address'   => '',
			'open'      => '',
			'title'     => '',
			'category'  => '',
			'colour'    => '',
			'color'     => '',
			'icon'      => '',
			'animation' => '',
		),
		waymorphic_map_fix_quotes( $atts ),
		'waymorphic_marker'
	);
	foreach ( array( 'title', 'category', 'address', 'icon' ) as $key ) {
		$atts[ $key ] = waymorphic_map_attribute_text( $atts[ $key ] );
	}

	// WordPress pairs a marker that has no closing tag with the closing tag of a
	// later marker. Then the content holds that later marker, and its popup text
	// would go to this marker. This marker has no popup: give the rest back.
	$after = null;
	if ( null !== $content && false !== strpos( $content, '[waymorphic_' ) ) {
		$after   = $content . '[/waymorphic_marker]';
		$content = null;
	}

	list( $lat, $lng ) = waymorphic_map_attribute_position( $atts );
	if ( ( '' === $lat || '' === $lng ) && '' !== $atts['address'] ) {
		$found = waymorphic_map_geocode( $atts['address'], waymorphic_map_near() );
		if ( $found ) {
			$lat = $found['lat'];
			$lng = $found['lng'];
		} else {
			waymorphic_map_address_problem( $atts['address'] );
		}
	} elseif ( ! waymorphic_map_clean_position( $lat, $lng ) ) {
		/* translators: 1: a latitude, 2: a longitude. */
		waymorphic_map_problems( sprintf( __( 'A marker does not show: lat="%1$s" lng="%2$s" is not a position. The lat is a number from -90 to 90, the lng a number from -180 to 180.', 'free-maps' ), $lat, $lng ) );
	}
	$position = waymorphic_map_clean_position( $lat, $lng );
	if ( null === waymorphic_map_near() && $position ) {
		// The first marker with a position: the lookups of the next markers prefer places near it.
		waymorphic_map_near( array( $position['lat'], $position['lng'] ) );
	}

	if ( $position ) {
		waymorphic_map_marker_stack(
			'add',
			array(
				'lat'   => $lat,
				'lng'   => $lng,
				'popup'     => waymorphic_map_popup_html( $content ),
				'open'      => waymorphic_map_clean_bool( $atts['open'], false ),
				'title'     => $atts['title'],
				'category'  => $atts['category'],
				'colour'    => '' !== $atts['colour'] ? $atts['colour'] : $atts['color'],
				'icon'      => $atts['icon'],
				'animation' => $atts['animation'],
			)
		);
	}

	if ( null !== $after ) {
		// The markers and the shapes that were in the content of this marker.
		do_shortcode( $after );
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
			'lon'     => '',
			'long'    => '',
			'address' => '',
			'radius'  => '',
			'colour'  => '',
			'color'   => '',
			'fill'    => '',
			'opacity' => '',
			'width'   => '',
		),
		waymorphic_map_fix_quotes( $atts ),
		$tag
	);
	$atts['address'] = waymorphic_map_attribute_text( $atts['address'] );

	// A shape with no closing tag gets the closing tag of a later shape of its type: see the marker shortcode.
	$after = null;
	if ( null !== $content && false !== strpos( $content, '[waymorphic_' ) ) {
		$after   = $content . '[/' . $tag . ']';
		$content = null;
	}

	$type   = str_replace( 'waymorphic_', '', $tag );
	$points = $atts['points'];
	if ( 'circle' === $type && '' === $points ) {
		// The centre of a circle: lat and lng, or an address.
		list( $lat, $lng ) = waymorphic_map_attribute_position( $atts );
		if ( ( '' === $lat || '' === $lng ) && '' !== $atts['address'] ) {
			$found = waymorphic_map_geocode( $atts['address'], waymorphic_map_near() );
			if ( $found ) {
				$lat = $found['lat'];
				$lng = $found['lng'];
			} else {
				waymorphic_map_address_problem( $atts['address'] );
			}
		}
		// A list of one point, not text: a decimal comma in the text would divide the numbers.
		$points = array( array( $lat, $lng ) );
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
			'popup'   => waymorphic_map_popup_html( $content ),
		)
	);

	if ( null !== $after ) {
		do_shortcode( $after );
	}

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
		waymorphic_map_fix_quotes( $atts ),
		'waymorphic_file'
	);
	// The editor saves "&" in the address of a file as "&amp;".
	$atts['category'] = waymorphic_map_attribute_text( $atts['category'] );
	$atts['url']      = waymorphic_map_attribute_text( $atts['url'] );

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
