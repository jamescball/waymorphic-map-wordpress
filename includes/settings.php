<?php
/**
 * The settings page: Settings > Waymorphic Map.
 *
 * @package WaymorphicMap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the option and its fields.
 */
function waymorphic_map_register_settings() {
	register_setting(
		'waymorphic_map',
		'waymorphic_map_options',
		array(
			'type'              => 'array',
			'sanitize_callback' => 'waymorphic_map_sanitize_options',
			'default'           => waymorphic_map_option_defaults(),
		)
	);

	add_settings_section( 'waymorphic_map_defaults', __( 'Defaults', 'free-maps' ), 'waymorphic_map_section_text', 'waymorphic_map' );

	$fields = array(
		'style'      => __( 'Map style', 'free-maps' ),
		'height'     => __( 'Height', 'free-maps' ),
		'zoom'       => __( 'Zoom', 'free-maps' ),
		'directions' => __( 'Directions link', 'free-maps' ),
		'tiles_url'  => __( 'Tile server URL', 'free-maps' ),
	);
	foreach ( $fields as $name => $label ) {
		add_settings_field(
			'waymorphic_map_' . $name,
			$label,
			'waymorphic_map_field',
			'waymorphic_map',
			'waymorphic_map_defaults',
			array(
				'name'      => $name,
				'label_for' => 'waymorphic_map_' . $name,
			)
		);
	}
}

/**
 * The text above the fields.
 */
function waymorphic_map_section_text() {
	echo '<p>' . esc_html__( 'A map uses these values when its block or shortcode does not set them.', 'free-maps' ) . '</p>';
}

/**
 * One field.
 *
 * @param array<string,string> $args The field name and id.
 */
function waymorphic_map_field( $args ) {
	$options = waymorphic_map_options();
	$name    = $args['name'];
	$id      = $args['label_for'];
	$input   = 'waymorphic_map_options[' . $name . ']';

	switch ( $name ) {
		case 'style':
			echo '<select id="' . esc_attr( $id ) . '" name="' . esc_attr( $input ) . '">';
			foreach ( waymorphic_map_styles() as $value => $label ) {
				echo '<option value="' . esc_attr( $value ) . '"' . selected( $options['style'], $value, false ) . '>' . esc_html( $label ) . '</option>';
			}
			echo '</select>';
			break;

		case 'height':
			echo '<input type="text" class="small-text" style="width:7em" id="' . esc_attr( $id ) . '" name="' . esc_attr( $input ) . '" value="' . esc_attr( $options['height'] ) . '">';
			echo '<p class="description">' . esc_html__( 'A CSS length, for example 400px or 60vh. A number without a unit is in pixels.', 'free-maps' ) . '</p>';
			break;

		case 'zoom':
			echo '<input type="number" class="small-text" min="0" max="22" step="0.5" id="' . esc_attr( $id ) . '" name="' . esc_attr( $input ) . '" value="' . esc_attr( $options['zoom'] ) . '">';
			echo '<p class="description">' . esc_html__( '0 shows the world, 12 a town, 16 a street.', 'free-maps' ) . '</p>';
			break;

		case 'directions':
			$current = waymorphic_map_default_directions();
			echo '<select id="' . esc_attr( $id ) . '" name="' . esc_attr( $input ) . '">';
			foreach ( waymorphic_map_directions_services() as $value => $service ) {
				echo '<option value="' . esc_attr( $value ) . '"' . selected( $current, $value, false ) . '>' . esc_html( $service['label'] ) . '</option>';
			}
			echo '<option value="choice"' . selected( $current, 'choice', false ) . '>' . esc_html__( 'The visitor selects (a list of the services)', 'free-maps' ) . '</option>';
			echo '</select>';
			echo '<p class="description">' . esc_html__( 'The map service that the directions link of a map opens. The link shows on the maps that have the directions link on. A map can have its own service.', 'free-maps' ) . '</p>';
			break;

		case 'tiles_url':
			echo '<input type="url" class="regular-text code" id="' . esc_attr( $id ) . '" name="' . esc_attr( $input ) . '" value="' . esc_attr( $options['tiles_url'] ) . '" placeholder="' . esc_attr( WAYMORPHIC_MAP_DEFAULT_TILES_URL ) . '">';
			echo '<p class="description">' . esc_html__( 'Change this only if you run your own Waymorphic Map tile server.', 'free-maps' ) . '</p>';
			break;
	}
}

/**
 * Adds the page to the Settings menu.
 */
function waymorphic_map_add_settings_page() {
	add_options_page(
		__( 'Waymorphic Map', 'free-maps' ),
		__( 'Waymorphic Map', 'free-maps' ),
		'manage_options',
		'waymorphic-map',
		'waymorphic_map_settings_page'
	);
}

/**
 * The page.
 */
function waymorphic_map_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	?>
	<div class="wrap">
		<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
		<p>
			<?php esc_html_e( 'To add a map, insert the Waymorphic Map block in the editor, or use the shortcode:', 'free-maps' ); ?>
			<br><code>[waymorphic_map lat="51.5074" lng="-0.1276" zoom="11" label="London"]</code>
		</p>
		<form action="options.php" method="post">
			<?php
			settings_fields( 'waymorphic_map' );
			do_settings_sections( 'waymorphic_map' );
			submit_button();
			?>
		</form>
		<p class="description">
			<?php
			echo wp_kses(
				sprintf(
					/* translators: 1: link to the fair use rules, 2: link to OpenStreetMap. */
					__( 'The maps come from %1$s: free, with no API key. Keep the credit in the corner of the map; the licence of %2$s requires it.', 'free-maps' ),
					'<a href="https://waymorphic.com/#fair" target="_blank" rel="noopener">Waymorphic Map</a>',
					'<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
				),
				array(
					'a' => array(
						'href'   => array(),
						'target' => array(),
						'rel'    => array(),
					),
				)
			);
			?>
		</p>
		<p class="description">
			<?php esc_html_e( 'Questions or problems? Contact:', 'free-maps' ); ?>
			<a href="mailto:contact@waymorphic.com">contact@waymorphic.com</a>
		</p>
	</div>
	<?php
}

/**
 * Adds a Settings link on the Plugins page.
 *
 * @param array<int|string,string> $links The links of the plugin.
 * @return array<int|string,string>
 */
function waymorphic_map_action_links( $links ) {
	array_unshift(
		$links,
		'<a href="' . esc_url( admin_url( 'options-general.php?page=waymorphic-map' ) ) . '">' . esc_html__( 'Settings', 'free-maps' ) . '</a>'
	);
	return $links;
}
