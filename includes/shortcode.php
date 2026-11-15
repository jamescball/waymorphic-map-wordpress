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
	$html = do_shortcode( $content );
	// A shortcode in the popup can print script and style elements. The cleaning of the popup
	// removes their tags and keeps their text: the code showed as text in the popup.
	if ( false !== stripos( $html, '<script' ) || false !== stripos( $html, '<style' ) ) {
		$clean = preg_replace( '#<(script|style)\b[^>]*>.*?</\1\s*>#is', '', $html );
		// Null: the text is too long for the expression. The text stays as it is.
		$html = null === $clean ? $html : $clean;
	}

	// The paragraph tags and the line breaks at the two ends go away. This is a loop with
	// positions, not one expression: an expression needs too many steps for a long text.
	$start = 0;
	$end   = strlen( $html );
	while ( $start < $end ) {
		if ( ctype_space( $html[ $start ] ) ) {
			++$start;
		} elseif ( preg_match( '#^(?:<br\s{0,5}/?>|</p>)#i', substr( $html, $start, 12 ), $found ) ) {
			$start += strlen( $found[0] );
		} else {
			break;
		}
	}
	while ( $end > $start ) {
		if ( ctype_space( $html[ $end - 1 ] ) ) {
			--$end;
		} elseif ( preg_match( '#(?:<br\s{0,5}/?>|<p>)$#i', substr( $html, max( $start, $end - 12 ), $end - max( $start, $end - 12 ) ), $found ) ) {
			$end -= strlen( $found[0] );
		} else {
			break;
		}
	}
	return force_balance_tags( substr( $html, $start, $end - $start ) );
}

/**
 * Writes a slash at the end of each shortcode tag of the given names that has
 * no closing tag before the next tag of these names:
 * [waymorphic_marker lat="1" lng="2"] becomes [waymorphic_marker lat="1" lng="2" /].
 * WordPress pairs a tag that has no closing tag with the closing tag of a
 * LATER tag of the same name. A marker with no popup text then took the popup
 * text of the next marker. One pass over the text, with no recursion: a long
 * list of markers needs little memory.
 *
 * @param string        $content The content of a map shortcode, or the text after a map tag.
 * @param array<string> $names   The names of the shortcodes.
 * @return string
 */
function waymorphic_map_close_tags( $content, $names ) {
	$content = (string) $content;
	if ( false === strpos( $content, '[' ) ) {
		return $content;
	}
	$pattern = '/\[(\/?)(' . implode( '|', array_map( 'preg_quote', $names ) ) . ')(?![\w-])([^\]]*)\]/';
	if ( ! preg_match_all( $pattern, $content, $tags, PREG_SET_ORDER | PREG_OFFSET_CAPTURE ) ) {
		return $content;
	}

	// The positions of the "]" of the tags that get a slash.
	$slashes = array();
	// The tag that is open: its name and the position of its "]".
	$open = null;
	foreach ( $tags as $tag ) {
		$start  = $tag[0][1];
		$length = strlen( $tag[0][0] );
		if ( $start > 0 && '[' === $content[ $start - 1 ] && isset( $content[ $start + $length ] ) && ']' === $content[ $start + $length ] ) {
			// [[tag]] is the text of a shortcode, not a shortcode.
			continue;
		}
		if ( '/' === $tag[1][0] ) {
			// WordPress reads only the exact text [/name] as a closing tag.
			if ( $open && $open[0] === $tag[2][0] && '' === $tag[3][0] ) {
				$open = null;
			}
			continue;
		}
		if ( $open ) {
			// The tag before this one has no closing tag.
			$slashes[] = $open[1];
		}
		$open = '/' === substr( rtrim( $tag[3][0] ), -1 ) ? null : array( $tag[2][0], $start + $length - 1 );
	}
	if ( ! $slashes ) {
		return $content;
	}

	$result = '';
	$from   = 0;
	foreach ( $slashes as $position ) {
		$result .= substr( $content, $from, $position - $from ) . ' /';
		$from    = $position;
	}
	return $result . substr( $content, $from );
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
 * The distance between two positions in kilometres.
 *
 * @param array{lat:float,lng:float} $a The first position.
 * @param array{lat:float,lng:float} $b The second position.
 * @return float
 */
function waymorphic_map_distance( $a, $b ) {
	$lat = deg2rad( $b['lat'] - $a['lat'] );
	$lng = deg2rad( $b['lng'] - $a['lng'] );
	$h   = sin( $lat / 2 ) * sin( $lat / 2 ) + cos( deg2rad( $a['lat'] ) ) * cos( deg2rad( $b['lat'] ) ) * sin( $lng / 2 ) * sin( $lng / 2 );
	return 6371 * 2 * asin( min( 1, sqrt( $h ) ) );
}

/**
 * Adds a message for each address that the search found far from the other
 * places of the map: "Brighton Pier" in New Zealand on a map of shops in
 * England. The search gives the place that it knows best, and the map shows
 * the full world. The message is for the editors of the page. There is no
 * message when the address has the name of the country or the area where
 * the place was found: the editor selected that country.
 *
 * @param array<int,array<string,mixed>> $places The markers and the centre of the map. Each has
 *                                               lat and lng. 'searched' is the address and the
 *                                               answer of the search, when the position came
 *                                               from an address. 'centre' is true for the centre.
 */
function waymorphic_map_far_places( $places ) {
	$points = array();
	foreach ( $places as $index => $place ) {
		$position = waymorphic_map_clean_position( isset( $place['lat'] ) ? $place['lat'] : null, isset( $place['lng'] ) ? $place['lng'] : null );
		if ( $position ) {
			$points[ $index ] = $position;
		}
	}
	// Other names that editors write for two countries.
	$names = array(
		'US' => array( 'USA', 'United States', 'U.S.' ),
		'GB' => array( 'UK', 'Great Britain', 'U.K.' ),
	);
	foreach ( $places as $index => $place ) {
		$searched = isset( $place['searched'] ) && is_array( $place['searched'] ) ? $place['searched'] : null;
		// An answer that the site kept from version 1.1 has no name: no message.
		if ( ! $searched || ! isset( $points[ $index ] ) || empty( $searched['label'] ) || ! isset( $searched['address'] ) ) {
			continue;
		}
		$others = $points;
		unset( $others[ $index ] );
		// Two other places, or a centre that the shortcode gives as numbers, tell where the map is.
		$sure = count( $others ) >= 2;
		foreach ( $others as $key => $other ) {
			if ( ! empty( $places[ $key ]['centre'] ) && empty( $places[ $key ]['searched'] ) ) {
				$sure = true;
			}
		}
		if ( ! $sure ) {
			continue;
		}
		$others = array_values( $others );
		$lats   = wp_list_pluck( $others, 'lat' );
		$lngs   = wp_list_pluck( $others, 'lng' );
		sort( $lats );
		sort( $lngs );
		$middle = array(
			'lat' => $lats[ (int) floor( count( $lats ) / 2 ) ],
			'lng' => $lngs[ (int) floor( count( $lngs ) / 2 ) ],
		);
		$spread = array();
		foreach ( $others as $other ) {
			$spread[] = waymorphic_map_distance( $other, $middle );
		}
		sort( $spread );
		$usual = $spread[ (int) floor( count( $spread ) / 2 ) ];
		$away  = waymorphic_map_distance( $points[ $index ], $middle );
		// Far: more than 500 km, and more than ten times the usual distance of the other places.
		if ( $away <= 500 || $away <= 10 * max( 20, $usual ) ) {
			continue;
		}
		// The address has the country or the area of the place: the editor wanted this place.
		$address = (string) $searched['address'];
		$code    = isset( $searched['countrycode'] ) ? strtoupper( (string) $searched['countrycode'] ) : '';
		$known   = isset( $names[ $code ] ) ? $names[ $code ] : array();
		foreach ( array( 'country', 'state' ) as $part ) {
			if ( ! empty( $searched[ $part ] ) ) {
				$known[] = (string) $searched[ $part ];
			}
		}
		$named = 2 === strlen( $code ) && 1 === preg_match( '/(?<![A-Za-z])' . preg_quote( $code, '/' ) . '(?![A-Za-z])/', $address );
		foreach ( $known as $name ) {
			if ( false !== stripos( $address, $name ) ) {
				$named = true;
			}
		}
		if ( $named ) {
			continue;
		}
		/* translators: 1: an address, 2: the name of the place that the search found. */
		waymorphic_map_problems( sprintf( __( 'The address "%1$s" was found here: %2$s. This place is far from the other places of the map. If it is not the correct place, write the town and the country in the address, or use lat and lng.', 'free-maps' ), $address, $searched['label'] ) );
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
 * Keeps the text of the attributes of a shortcode of this plugin as the
 * writer typed it, for waymorphic_map_fix_quotes(). WordPress calls this
 * filter directly before the function of the shortcode.
 *
 * @param false|string $output The output that replaces the shortcode, or false. Not changed.
 * @param string       $tag    The name of the shortcode.
 * @param array|string $attr   The attributes as WordPress read them.
 * @param array        $m      The parts of the shortcode: part 3 is the text of the attributes.
 * @return false|string
 */
function waymorphic_map_keep_raw_attributes( $output, $tag, $attr, $m ) {
	if ( is_string( $tag ) && 0 === strpos( $tag, 'waymorphic_' ) ) {
		waymorphic_map_raw_attributes( array( $attr, isset( $m[3] ) && is_string( $m[3] ) ? $m[3] : '' ) );
	}
	return $output;
}

/**
 * The text of the attributes of the shortcode that WordPress reads now.
 *
 * @param array|null $set The attributes as WordPress read them and their text, to keep them.
 *                        Null to get them: they are given one time.
 * @return array|null
 */
function waymorphic_map_raw_attributes( $set = null ) {
	static $raw = null;
	if ( null !== $set ) {
		$raw = $set;
		return null;
	}
	$kept = $raw;
	$raw  = null;
	return $kept;
}

/**
 * Reads the attributes that WordPress did not read because their quotes are
 * the curly quotes of a text program: lat=”51.5” label=“Our shop”. Without
 * this, such a map shows the world and no error.
 *
 * Only a value that has a curly quote directly after its "=" is changed. A
 * value in straight quotes stays as it is, also when its text starts with a
 * curly quote or an apostrophe (title="’t Pumpke", label="« Chez Paul »").
 *
 * @param mixed $atts The attributes from WordPress.
 * @return array<string|int,mixed>
 */
function waymorphic_map_fix_quotes( $atts ) {
	$kept = waymorphic_map_raw_attributes();
	// The text is for these attributes only: not for a call of the function from PHP code that
	// comes after a shortcode which a different plugin stopped.
	$raw  = is_array( $kept ) && $kept[0] === $atts ? $kept[1] : null;
	$atts = is_array( $atts ) ? $atts : array();
	// Each kind of curly quote and prime that text programs make.
	$quote = '[“”„‟″‶«»‘’‚′]';
	if ( null === $raw || 1 !== preg_match( '/=\s*' . $quote . '/u', $raw ) ) {
		return $atts;
	}
	// name=“value”: the value ends at the last curly quote before the next name= or the end.
	$fixed = preg_replace_callback(
		'/([\w-]+)\s*=\s*' . $quote . '(.*?)' . $quote . '(?=\s+[\w-]+\s*=|\s*$)/us',
		function ( $part ) {
			return $part[1] . '="' . str_replace( '"', '&quot;', $part[2] ) . '"';
		},
		$raw
	);
	$parsed = is_string( $fixed ) ? shortcode_parse_atts( $fixed ) : '';
	return is_array( $parsed ) ? $parsed : $atts;
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
			'popup_title' => '',
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
		// Each later map with no closing tag gets a slash, and the last one gets the closing tag
		// that WordPress took: the later maps are made one after the other, not one in the other.
		$after   = do_shortcode( waymorphic_map_close_tags( $content . '[/waymorphic_map]', array( 'waymorphic_map' ) ) );
		$content = null;
	}

	// The messages of the maps before this one are not for this map.
	waymorphic_map_problems();

	list( $lat, $lng ) = waymorphic_map_attribute_position( $atts );
	$searched          = null;
	if ( ( '' === $lat || '' === $lng ) && '' !== $atts['address'] ) {
		$found = waymorphic_map_geocode( $atts['address'] );
		if ( $found ) {
			$lat = $found['lat'];
			$lng = $found['lng'];
			// For the message about a place that is far from the other places of the map.
			$searched = array_merge( $found, array( 'address' => $atts['address'] ) );
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

	// The markers inside the shortcode.
	waymorphic_map_marker_stack( 'open' );
	if ( null !== $content && '' !== $content ) {
		// A marker or a shape with no closing tag must not take the popup text of the next one.
		do_shortcode(
			waymorphic_map_close_tags(
				$content,
				array( 'waymorphic_marker', 'waymorphic_polygon', 'waymorphic_line', 'waymorphic_circle', 'waymorphic_rectangle', 'waymorphic_heatmap', 'waymorphic_file' )
			)
		);
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

	waymorphic_map_far_places(
		array_merge(
			$markers,
			array(
				array(
					'lat'      => $lat,
					'lng'      => $lng,
					'centre'   => true,
					'searched' => $searched,
				),
			)
		)
	);

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
			. '</strong><ul><li>' . waymorphic_map_plain_brackets( implode( '</li><li>', array_map( 'esc_html', $problems ) ) ) . '</li></ul></div>';
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
			'popup_title' => waymorphic_map_clean_bool( $atts['popup_title'], true ),
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

	list( $lat, $lng ) = waymorphic_map_attribute_position( $atts );
	if ( ( '' === $lat || '' === $lng ) && '' !== $atts['address'] ) {
		$found = waymorphic_map_geocode( $atts['address'] );
		if ( $found ) {
			$lat = $found['lat'];
			$lng = $found['lng'];
			// For the message about a place that is far from the other places of the map.
			$searched = array_merge( $found, array( 'address' => $atts['address'] ) );
		} else {
			waymorphic_map_address_problem( $atts['address'] );
		}
	} elseif ( ! waymorphic_map_clean_position( $lat, $lng ) ) {
		/* translators: 1: a latitude, 2: a longitude. */
		waymorphic_map_problems( sprintf( __( 'A marker does not show: lat="%1$s" lng="%2$s" is not a position. The lat is a number from -90 to 90, the lng a number from -180 to 180.', 'free-maps' ), $lat, $lng ) );
	}
	$position = waymorphic_map_clean_position( $lat, $lng );

	if ( $position ) {
		waymorphic_map_marker_stack(
			'add',
			array(
				'searched'  => isset( $searched ) ? $searched : null,
				'lat'       => $lat,
				'lng'       => $lng,
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

	$type   = str_replace( 'waymorphic_', '', $tag );
	$points = $atts['points'];
	if ( 'circle' === $type && '' === $points ) {
		// The centre of a circle: lat and lng, or an address.
		list( $lat, $lng ) = waymorphic_map_attribute_position( $atts );
		if ( ( '' === $lat || '' === $lng ) && '' !== $atts['address'] ) {
			$found = waymorphic_map_geocode( $atts['address'] );
			if ( $found ) {
				$lat = $found['lat'];
				$lng = $found['lng'];
			} else {
				waymorphic_map_address_problem( $atts['address'] );
			}
		}
		// A list of one point, not text: a decimal comma in the text would divide the numbers.
		$points = array( array( $lat, $lng ) );
		// No message for a circle whose address was not found: the address has its message.
		if ( ! waymorphic_map_clean_position( $lat, $lng ) && ( '' === $atts['address'] || ( '' !== $lat && '' !== $lng ) ) ) {
			/* translators: 1: a latitude, 2: a longitude. */
			waymorphic_map_problems( sprintf( __( 'A circle does not show: lat="%1$s" lng="%2$s" is not a position. The lat is a number from -90 to 90, the lng a number from -180 to 180.', 'free-maps' ), $lat, $lng ) );
		}
	} else {
		$count = count( waymorphic_map_clean_points( $points, 5000 ) );
		if ( $count < ( 'polygon' === $type ? 3 : ( 'heatmap' === $type ? 1 : 2 ) ) ) {
			/* translators: %s: the name of a shortcode, such as waymorphic_polygon. */
			waymorphic_map_problems( sprintf( __( 'A shape does not show: [%s] does not have sufficient points that are positions. Write the points as "lat,lng; lat,lng" with a point as the decimal sign.', 'free-maps' ), $tag ) );
		}
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

	if ( '' === esc_url_raw( trim( $atts['url'] ), array( 'http', 'https' ) ) ) {
		waymorphic_map_problems( __( 'A file does not show: the url of [waymorphic_file] must be an address that starts with http or https.', 'free-maps' ) );
	}
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
