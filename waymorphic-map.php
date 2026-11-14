<?php
/**
 * Plugin Name:       Waymorphic Map
 * Plugin URI:        https://github.com/jamescball/waymorphic-map-wordpress
 * Description:       Free OpenStreetMap vector maps for WordPress. A block and a shortcode, five map styles, markers with popups. No API key, no account.
 * Version:           1.0.0
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

define( 'WAYMORPHIC_MAP_VERSION', '1.0.0' );
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
add_action( 'admin_init', 'waymorphic_map_register_settings' );
add_action( 'admin_menu', 'waymorphic_map_add_settings_page' );
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'waymorphic_map_action_links' );
