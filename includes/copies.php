<?php
/**
 * Two copies of the plugin on one site.
 *
 * Older versions of the plugin had other folder names: wp-free-maps (version
 * 1.1.0) and free-maps-waymorphic-map (version 1.2.0). WordPress installs a
 * version with a new folder name as a second plugin, so two copies can be
 * active at the same time. Only the copy that WordPress loads first operates.
 *
 * The plugin does not deactivate a copy. A notice tells the administrator
 * which copy to deactivate on the Plugins screen.
 *
 * WordPress loads this file from each active copy of version 1.2.1 or later,
 * also from a copy that does not operate. Thus each function here has a
 * function_exists() test, has a name that versions 1.1.0 and 1.2.0 do not
 * have, and uses only functions of WordPress and of this file.
 *
 * @package WaymorphicMap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'waymorphic_map_backup_options' ) ) {
	/**
	 * Keeps a copy of the settings of the site that is active. When a user
	 * deletes an older version of the plugin, that version removes the
	 * settings. The copy brings them back: see waymorphic_map_keep_options().
	 */
	function waymorphic_map_backup_options() {
		$saved = get_option( 'waymorphic_map_options', null );
		if ( is_array( $saved ) ) {
			update_option( 'waymorphic_map_options_backup', $saved );
		}
	}
}

if ( ! function_exists( 'waymorphic_map_activation' ) ) {
	/**
	 * Runs when the plugin is activated: keeps a copy of the settings.
	 *
	 * @param bool $network_wide True when the plugin is activated for a network.
	 */
	function waymorphic_map_activation( $network_wide = false ) {
		if ( $network_wide && is_multisite() ) {
			// Each site of the network has its settings.
			foreach ( get_sites( array( 'fields' => 'ids', 'number' => 0 ) ) as $site_id ) {
				switch_to_blog( $site_id );
				waymorphic_map_backup_options();
				restore_current_blog();
			}
		} else {
			waymorphic_map_backup_options();
		}
	}
}

if ( ! function_exists( 'waymorphic_map_idle_copy' ) ) {
	/**
	 * Records a copy of the plugin that is active but does not operate, because
	 * WordPress loaded a different copy before it.
	 *
	 * @param string $file The main file of the copy. Empty: record nothing.
	 * @return string[] The recorded copies, each as plugin_basename() gives it.
	 */
	function waymorphic_map_idle_copy( $file = '' ) {
		static $files = array();
		if ( '' !== $file ) {
			$files[] = plugin_basename( $file );
		}
		return $files;
	}
}

if ( ! function_exists( 'waymorphic_map_copies_to_remove' ) ) {
	/**
	 * The active copies of the plugin that are not necessary: all the active
	 * copies but the one with the highest version.
	 *
	 * @return array<int,array<string,string>> For each copy: file (as plugin_basename() gives it), name and version.
	 */
	function waymorphic_map_copies_to_remove() {
		if ( ! defined( 'WAYMORPHIC_MAP_FILE' ) || ! function_exists( 'is_plugin_active' ) || ! function_exists( 'get_plugin_data' ) ) {
			return array();
		}

		// The copy that operates is first. Then the copies of version 1.2.1 or later that do not
		// operate, and the two versions with other folder names. Version 1.1.0 loads after this
		// version: it does nothing but write PHP warnings in each request.
		$files = array_merge(
			array( plugin_basename( WAYMORPHIC_MAP_FILE ) ),
			waymorphic_map_idle_copy(),
			array( 'wp-free-maps/wp-free-maps.php', 'free-maps-waymorphic-map/free-maps-waymorphic-map.php' )
		);

		$copies = array();
		foreach ( array_unique( $files ) as $file ) {
			$path = WP_PLUGIN_DIR . '/' . $file;
			if ( is_plugin_active( $file ) && is_readable( $path ) ) {
				$data     = get_plugin_data( $path, false, false );
				$copies[] = array(
					'file'    => $file,
					'name'    => $data['Name'],
					'version' => $data['Version'],
				);
			}
		}
		if ( count( $copies ) < 2 ) {
			return array();
		}

		// Keep the copy with the highest version. Two copies with the same version: keep the copy
		// in the folder of the plugin directory, because it gets the updates. If there is none,
		// keep the first copy, which operates.
		$keep = 0;
		foreach ( $copies as $index => $copy ) {
			$order = version_compare( $copy['version'], $copies[ $keep ]['version'] );
			if ( $order > 0 || ( 0 === $order && 'waymorphic-map/waymorphic-map.php' === $copy['file'] ) ) {
				$keep = $index;
			}
		}
		unset( $copies[ $keep ] );

		return array_values( $copies );
	}
}

if ( ! function_exists( 'waymorphic_map_copies_notice' ) ) {
	/**
	 * Tells the administrator that more than one copy of the plugin is active,
	 * and which copy to deactivate. The notice shows on the Plugins screen, the
	 * Dashboard and the settings page of the plugin, to a user who can
	 * deactivate that copy. It goes away when one copy stays active.
	 */
	function waymorphic_map_copies_notice() {
		$screen  = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		$screens = array( 'plugins', 'plugins-network', 'dashboard', 'dashboard-network', 'settings_page_waymorphic-map' );
		if ( ! $screen || ! in_array( $screen->id, $screens, true ) ) {
			return;
		}

		$text    = array();
		$network = false;
		foreach ( waymorphic_map_copies_to_remove() as $copy ) {
			// A copy that is active for the network is deactivated in the network administration.
			$for_network = is_multisite() && is_plugin_active_for_network( $copy['file'] );
			if ( ! current_user_can( $for_network ? 'manage_network_plugins' : 'activate_plugins' ) ) {
				continue;
			}
			$network = $network || $for_network;
			$text[]  = sprintf(
				/* translators: 1: the name of a plugin, 2: its version number, 3: the name of its folder. */
				__( 'Deactivate "%1$s" (version %2$s, in the folder %3$s), then delete it.', 'waymorphic-map' ),
				$copy['name'],
				$copy['version'],
				dirname( $copy['file'] )
			);
		}
		if ( ! $text ) {
			return;
		}

		array_unshift( $text, __( 'More than one copy of this plugin is active, and only one copy can operate.', 'waymorphic-map' ) );
		$text[] = __( 'Your settings and your maps stay.', 'waymorphic-map' );

		echo '<div class="notice notice-warning"><p><strong>' . esc_html__( 'Waymorphic Map:', 'waymorphic-map' ) . '</strong> ' . esc_html( implode( ' ', $text ) );
		if ( ( $network ? 'plugins-network' : 'plugins' ) !== $screen->id ) {
			// The user is not on the Plugins screen that has the copy.
			echo ' <a href="' . esc_url( $network ? network_admin_url( 'plugins.php' ) : admin_url( 'plugins.php' ) ) . '">' . esc_html__( 'Go to the Plugins screen', 'waymorphic-map' ) . '</a>';
		}
		echo '</p></div>';
	}
}
