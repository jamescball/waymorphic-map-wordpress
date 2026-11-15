<?php
/**
 * Removes the data of the plugin when it is deleted.
 *
 * @package WaymorphicMap
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

/**
 * Removes the data of the plugin from the site that is active.
 */
function waymorphic_map_uninstall_site() {
	global $wpdb;

	delete_option( 'waymorphic_map_options' );
	delete_option( 'waymorphic_map_options_copy' );
	delete_transient( 'waymorphic_map_geo_down' );

	// The kept answers of the address lookup.
	$wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->prepare(
			"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
			$wpdb->esc_like( '_transient_waymorphic_map_geo_' ) . '%',
			$wpdb->esc_like( '_transient_timeout_waymorphic_map_geo_' ) . '%'
		)
	);
}

if ( is_multisite() ) {
	// WordPress runs this file one time for a network: each site has its options.
	foreach ( get_sites( array( 'fields' => 'ids', 'number' => 0 ) ) as $waymorphic_map_site_id ) {
		switch_to_blog( $waymorphic_map_site_id );
		waymorphic_map_uninstall_site();
		restore_current_blog();
	}
} else {
	waymorphic_map_uninstall_site();
}
