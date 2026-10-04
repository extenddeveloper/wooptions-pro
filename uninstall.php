<?php
/**
 * WooptionsFic uninstall routine.
 *
 * Merchant data is retained by default. It is removed only when the merchant
 * enabled the uninstall setting or explicitly defined WOOPTIONSFIC_REMOVE_DATA.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

defined('WP_UNINSTALL_PLUGIN') || exit;

/**
 * Remove plugin capabilities from the current site roles.
 */
function wooptionsfic_uninstall_remove_capabilities(): void {
	$capabilities = [
		'manage_wooptionsfic',
		'edit_wooptionsfic_sets',
		'publish_wooptionsfic_sets',
		'manage_wooptionsfic_settings',
		'view_wooptionsfic_analytics',
		'manage_wooptionsfic_uploads',
	];

	foreach (['administrator', 'shop_manager'] as $role_name) {
		$role = get_role($role_name);
		if (! $role) {
			continue;
		}
		foreach ($capabilities as $capability) {
			$role->remove_cap($capability);
		}
	}
}

/**
 * Delete exact private-vault files owned by the current site's upload rows.
 *
 * @param list<string> $storage_keys Storage keys.
 */
function wooptionsfic_uninstall_delete_vault(array $storage_keys): void {
	$base = defined('WOOPTIONSFIC_PRIVATE_DIR')
		? untrailingslashit((string) WOOPTIONSFIC_PRIVATE_DIR)
		: untrailingslashit(WP_CONTENT_DIR . '/wooptionsfic-private');

	if ('' === $base || '/' === $base || WP_CONTENT_DIR === $base || ! is_dir($base)) {
		return;
	}

	foreach ($storage_keys as $storage_key) {
		if (1 === preg_match('/\A[a-f0-9]{64}\z/', $storage_key)) {
			wp_delete_file($base . '/' . $storage_key . '.dat');
		}
	}
	if ([] !== (glob($base . '/*.dat') ?: [])) {
		return;
	}
	foreach (['index.php', '.htaccess', 'web.config'] as $protection) {
		$file = $base . '/' . $protection;
		if (is_file($file)) {
			wp_delete_file($file);
		}
	}
	@rmdir($base); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.file_system_operations_rmdir
}

/**
 * Remove current-site data only after explicit opt-in.
 */
function wooptionsfic_uninstall_site(): void {
	global $wpdb;

	wp_clear_scheduled_hook('wooptionsfic_cleanup');
	wooptionsfic_uninstall_remove_capabilities();

	$settings = get_option('wooptionsfic_settings', []);
	$remove_data = (defined('WOOPTIONSFIC_REMOVE_DATA') && true === WOOPTIONSFIC_REMOVE_DATA)
		|| (is_array($settings) && ! empty($settings['delete_data_on_uninstall']));

	if (! $remove_data) {
		return;
	}

	$uploads_table = $wpdb->prefix . 'wof_uploads';
	$table_exists = $wpdb->get_var(
		$wpdb->prepare('SHOW TABLES LIKE %s', $wpdb->esc_like($uploads_table))
	);
	$storage_keys = [];
	if ($uploads_table === $table_exists) {
		$storage_keys = array_values(
			array_filter(
				array_map(
					'strval',
					(array) $wpdb->get_col("SELECT storage_key FROM `{$uploads_table}` WHERE storage_key IS NOT NULL AND storage_key <> ''") // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery
				),
				static fn (string $key): bool => 1 === preg_match('/\A[a-f0-9]{64}\z/', $key)
			)
		);
	}
	wooptionsfic_uninstall_delete_vault($storage_keys);

	foreach (
		[
			'analytics_daily',
			'saved_configs',
			'uploads',
			'style_revisions',
			'style_kits',
			'assignments',
			'revisions',
			'option_sets',
		] as $suffix
	) {
		$table = $wpdb->prefix . 'wof_' . $suffix;
		$wpdb->query("DROP TABLE IF EXISTS `{$table}`"); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.SchemaChange
	}

	delete_option('wooptionsfic_settings');
	delete_option('wooptionsfic_db_version');
	delete_transient('wooptionsfic_activated');
}

if (is_multisite()) {
	$site_ids = get_sites(['fields' => 'ids', 'number' => 0]);
	foreach ($site_ids as $site_id) {
		switch_to_blog((int) $site_id);
		wooptionsfic_uninstall_site();
		restore_current_blog();
	}
} else {
	wooptionsfic_uninstall_site();
}
