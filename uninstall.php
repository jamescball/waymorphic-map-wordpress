<?php
/**
 * Removes the data of the plugin when it is deleted.
 *
 * @package WaymorphicMap
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'waymorphic_map_options' );

// The kept answers of the address lookup.
global $wpdb;
$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE '\_transient\_waymorphic\_map\_geo\_%' OR option_name LIKE '\_transient\_timeout\_waymorphic\_map\_geo\_%'" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
