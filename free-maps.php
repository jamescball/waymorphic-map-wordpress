<?php
/**
 * Plugin Name:       Free Maps - Waymorphic Map & Custom Maps
 * Plugin URI:        https://github.com/jamescball/waymorphic-map-wordpress
 * Description:       Free OpenStreetMap vector maps for WordPress. A block and a shortcode, five map styles, markers, shapes, a marker list and a search for the nearest markers. No API key, no account.
 * Version:           1.2.0
 * Requires at least: 6.3
 * Requires PHP:      7.4
 * Author:            James Ball
 * Author URI:        https://waymorphic.com/
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       free-maps
 *
 * @package WaymorphicMap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'waymorphic_map_activate' ) ) {
	/**
	 * Runs when the plugin is activated. The folder of version 1.1 had a
	 * different name (wp-free-maps), so WordPress installs this version as
	 * a second plugin. Two active copies write PHP warnings in each page
	 * view, and the delete of version 1.1 removes the settings. This
	 * function keeps a copy of the settings and deactivates version 1.1.
	 * It uses only functions of WordPress: at this time, the other
	 * functions of the plugin can be those of version 1.1.
	 *
	 * @param bool $network_wide True when the plugin is activated for a network.
	 */
	function waymorphic_map_activate( $network_wide = false ) {
		$saved = get_option( 'waymorphic_map_options', null );
		if ( is_array( $saved ) ) {
			update_option( 'waymorphic_map_options_copy', $saved );
		}
		if ( ! function_exists( 'deactivate_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		$old = 'wp-free-maps/wp-free-maps.php';
		if ( is_plugin_active( $old ) && ( $network_wide || ! is_plugin_active_for_network( $old ) ) ) {
			// For one site, only this site: the other sites of a network can use version 1.1.
			deactivate_plugins( $old, true, $network_wide ? null : false );
		}
	}
}
register_activation_hook( __FILE__, 'waymorphic_map_activate' );

if ( defined( 'WAYMORPHIC_MAP_VERSION' ) ) {
	// A second copy of the plugin is active (the folder of version 1.1 had a different name). One copy runs.
	if ( version_compare( WAYMORPHIC_MAP_VERSION, '1.2.0', '<' ) ) {
		// Version 1.1 is first in the list of the active plugins, and its code runs. The next
		// administration request keeps the settings and deactivates it; then this version runs.
		add_action( 'admin_init', 'waymorphic_map_activate' );
	}
	return;
}

define( 'WAYMORPHIC_MAP_VERSION', '1.2.0' );
define( 'WAYMORPHIC_MAP_MAPLIBRE_VERSION', '5.21.0' );
define( 'WAYMORPHIC_MAP_FILE', __FILE__ );
define( 'WAYMORPHIC_MAP_DIR', plugin_dir_path( __FILE__ ) );
define( 'WAYMORPHIC_MAP_DEFAULT_TILES_URL', 'https://tiles.waymorphic.com' );

require_once WAYMORPHIC_MAP_DIR . 'includes/options.php';
require_once WAYMORPHIC_MAP_DIR . 'includes/render.php';
require_once WAYMORPHIC_MAP_DIR . 'includes/shortcode.php';
require_once WAYMORPHIC_MAP_DIR . 'includes/block.php';
require_once WAYMORPHIC_MAP_DIR . 'includes/settings.php';

add_action( 'init', 'waymorphic_map_register_assets', 5 );
add_action( 'init', 'waymorphic_map_register_shortcodes' );
add_action( 'init', 'waymorphic_map_register_block' );
add_action( 'enqueue_block_assets', 'waymorphic_map_editor_assets' );
add_action( 'wp_enqueue_scripts', 'waymorphic_map_enqueue_early' );
add_action( 'admin_init', 'waymorphic_map_register_settings' );
add_action( 'admin_init', 'waymorphic_map_keep_options', 20 );
add_filter( 'pre_do_shortcode_tag', 'waymorphic_map_keep_raw_attributes', 10, 4 );
add_action( 'admin_menu', 'waymorphic_map_add_settings_page' );
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'waymorphic_map_action_links' );
