<?php
/**
 * Plugin Name:       Waymorphic Map & Custom Maps
 * Plugin URI:        https://github.com/jamescball/waymorphic-map-wordpress
 * Description:       Free OpenStreetMap vector maps for WordPress. A block and a shortcode, five map styles, markers, shapes, a marker list and a search for the nearest markers. No API key, no account.
 * Version:           1.2.1
 * Requires at least: 6.3
 * Requires PHP:      7.4
 * Author:            James Ball
 * Author URI:        https://waymorphic.com/
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       waymorphic-map
 *
 * @package WaymorphicMap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Older versions of the plugin had other folder names, so two copies of the plugin can be
// active at the same time: see includes/copies.php. WordPress loads these lines from each
// active copy. The plugin does not deactivate a copy: a notice tells the administrator.
require_once __DIR__ . '/includes/copies.php';
register_activation_hook( __FILE__, 'waymorphic_map_activation' );
add_action( 'admin_notices', 'waymorphic_map_copies_notice' );
add_action( 'network_admin_notices', 'waymorphic_map_copies_notice' );

if ( defined( 'WAYMORPHIC_MAP_VERSION' ) ) {
	// WordPress loaded a different copy of the plugin before this copy. That copy operates,
	// and this copy stops here.
	waymorphic_map_idle_copy( __FILE__ );
	return;
}

define( 'WAYMORPHIC_MAP_VERSION', '1.2.1' );
define( 'WAYMORPHIC_MAP_MAPLIBRE_VERSION', '5.21.0' );
define( 'WAYMORPHIC_MAP_FILE', __FILE__ );
define( 'WAYMORPHIC_MAP_DIR', plugin_dir_path( __FILE__ ) );
define( 'WAYMORPHIC_MAP_DEFAULT_TILES_URL', 'https://tiles.waymorphic.com' );

// Do not change the names of these five files. When version 1.1.0 is active too, it loads
// after this version and requires the files by these names from this folder.
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
