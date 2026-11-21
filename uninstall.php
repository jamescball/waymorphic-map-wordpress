<?php
/**
 * Removes the data of the plugin when it is deleted.
 *
 * @package WaymorphicMap
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

if ( defined( 'WAYMORPHIC_MAP_VERSION' ) ) {
	// A second copy of the plugin is active on this site, in a folder with a different name,
	// and it uses the data. Keep the data.
	return;
}

if ( ! function_exists( 'waymorphic_map_remove_site_data' ) ) {
	/**
	 * Removes the data of the plugin from the site that is active. The name of
	 * this function is not the name that version 1.2.0 used: WordPress can
	 * delete two copies of the plugin in one request.
	 */
	function waymorphic_map_remove_site_data() {
		global $wpdb;

		delete_option( 'waymorphic_map_options' );
		delete_option( 'waymorphic_map_options_backup' );
		// The copy of the options that version 1.2.0 kept.
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
}

if ( is_multisite() ) {
	// WordPress runs this file one time for a network: each site has its options.
	foreach ( get_sites( array( 'fields' => 'ids', 'number' => 0 ) ) as $waymorphic_map_site_id ) {
		switch_to_blog( $waymorphic_map_site_id );
		waymorphic_map_remove_site_data();
		restore_current_blog();
	}
} else {
	waymorphic_map_remove_site_data();
}
