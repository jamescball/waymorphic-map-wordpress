<?php
/**
 * The Waymorphic Map block.
 *
 * @package WaymorphicMap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the block and its editor script.
 */
function waymorphic_map_register_block() {
	wp_register_script(
		'waymorphic-map-editor',
		plugins_url( 'block/editor.js', WAYMORPHIC_MAP_FILE ),
		array( 'wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-data', 'wp-a11y', 'wp-i18n', 'waymorphic-map' ),
		WAYMORPHIC_MAP_VERSION,
		true
	);
	wp_set_script_translations( 'waymorphic-map-editor', 'waymorphic-map' );

	wp_register_style( 'waymorphic-map-editor', plugins_url( 'block/editor.css', WAYMORPHIC_MAP_FILE ), array(), WAYMORPHIC_MAP_VERSION );

	$options  = waymorphic_map_options();
	$services = array();
	foreach ( waymorphic_map_directions_services() as $id => $service ) {
		$services[ $id ] = $service['label'];
	}
	wp_add_inline_script(
		'waymorphic-map-editor',
		'window.waymorphicMapEditor = ' . wp_json_encode(
			array(
				'tilesUrl'           => waymorphic_map_tiles_url(),
				'styles'             => waymorphic_map_styles(),
				'defaultStyle'       => $options['style'],
				'defaultHeight'      => waymorphic_map_clean_length( $options['height'], '400px', false ),
				'defaultZoom'        => (float) $options['zoom'],
				'directionsServices' => $services,
				'defaultDirections'  => waymorphic_map_default_directions(),
			)
		) . ';',
		'before'
	);

	register_block_type(
		WAYMORPHIC_MAP_DIR . 'block',
		array( 'render_callback' => 'waymorphic_map_render_block' )
	);
}

/**
 * Loads the map script and style in the editor, also in the frame that shows
 * the content. On the site they load only when a map is made: block.json does
 * not name them, because WordPress loads the script and the style of each
 * block on all the pages of a classic theme.
 */
function waymorphic_map_editor_assets() {
	if ( is_admin() ) {
		wp_enqueue_style( 'waymorphic-map' );
		wp_enqueue_script( 'waymorphic-map' );
	}
}

/**
 * Shows the block on the page.
 *
 * @param array<string,mixed> $attributes The block attributes.
 * @return string
 */
function waymorphic_map_render_block( $attributes ) {
	$markers = array();
	if ( ! empty( $attributes['markers'] ) && is_array( $attributes['markers'] ) ) {
		foreach ( $attributes['markers'] as $marker ) {
			if ( ! is_array( $marker ) ) {
				continue;
			}
			$label     = isset( $marker['label'] ) && is_scalar( $marker['label'] ) ? (string) $marker['label'] : '';
			$markers[] = array(
				'lat'   => isset( $marker['lat'] ) ? $marker['lat'] : null,
				'lng'   => isset( $marker['lng'] ) ? $marker['lng'] : null,
				'popup'    => esc_html( $label ),
				'open'     => ! empty( $marker['open'] ),
				'title'    => $label,
				'category' => isset( $marker['category'] ) ? $marker['category'] : '',
				'colour'   => isset( $marker['colour'] ) ? $marker['colour'] : '',
				'icon'     => isset( $marker['icon'] ) ? $marker['icon'] : '',
			);
		}
	}

	// The shapes of the block have plain text for the popup and [ lat, lng ] points.
	$shapes = array();
	if ( ! empty( $attributes['shapes'] ) && is_array( $attributes['shapes'] ) ) {
		foreach ( $attributes['shapes'] as $shape ) {
			if ( is_array( $shape ) ) {
				$shape['popup'] = esc_html( isset( $shape['label'] ) && is_scalar( $shape['label'] ) ? (string) $shape['label'] : '' );
				$shapes[]       = $shape;
			}
		}
	}

	// The directions link opens the map service of the block, or the service of the settings.
	$directions = false;
	if ( ! empty( $attributes['directions'] ) ) {
		$service    = isset( $attributes['directionsService'] ) ? waymorphic_map_clean_directions( $attributes['directionsService'], '' ) : '';
		$directions = '' !== $service ? $service : true;
	}

	return waymorphic_map_render(
		array(
			'lat'         => isset( $attributes['lat'] ) ? $attributes['lat'] : null,
			'lng'         => isset( $attributes['lng'] ) ? $attributes['lng'] : null,
			'zoom'        => isset( $attributes['zoom'] ) ? $attributes['zoom'] : null,
			'style'       => isset( $attributes['mapStyle'] ) ? $attributes['mapStyle'] : '',
			'height'      => isset( $attributes['height'] ) ? $attributes['height'] : '',
			'markers'     => $markers,
			'shapes'      => $shapes,
			'cluster'     => ! empty( $attributes['cluster'] ),
			'list'        => ! empty( $attributes['list'] ),
			'locator'     => ! empty( $attributes['locator'] ),
			'unit'        => isset( $attributes['unit'] ) ? $attributes['unit'] : 'km',
			'filter'      => ! empty( $attributes['filter'] ),
			'directions'  => $directions,
			'locate'      => ! empty( $attributes['locate'] ),
			'animation'   => isset( $attributes['animation'] ) ? $attributes['animation'] : '',
			'controls'    => ! isset( $attributes['controls'] ) || $attributes['controls'],
			'scroll_zoom' => ! empty( $attributes['scrollZoom'] ),
			'interactive' => ! isset( $attributes['interactive'] ) || $attributes['interactive'],
			'title'       => isset( $attributes['title'] ) ? $attributes['title'] : '',
			'wrapper'     => get_block_wrapper_attributes(),
		)
	);
}
