<?php
/**
 * Merchant-facing bounded diagnostics.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Application;

use WooptionsFic\Bootstrap\Requirements;
use WooptionsFic\Infrastructure\Persistence\Schema;
use WooptionsFic\Infrastructure\Storage\LocalPrivateStorage;

final class DiagnosticsService {
	public function __construct(private readonly LocalPrivateStorage $storage) {
	}

	/**
	 * @return array<string,mixed>
	 */
	public function report(): array {
		global $wpdb, $wp_version;

		$checks = [];
		foreach (['option_sets', 'revisions', 'assignments', 'uploads', 'saved_configs', 'analytics_daily'] as $suffix) {
			$table = Schema::table($suffix);
			$exists = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table));
			$checks[] = [
				'key'     => 'table_' . $suffix,
				'label'   => sprintf(__('Database table: %s', 'wooptionsfic'), $suffix),
				'status'  => $exists === $table ? 'good' : 'critical',
				'message' => $exists === $table
					? __('Ready', 'wooptionsfic')
					: __('Missing; deactivate and reactivate the plugin to retry migrations.', 'wooptionsfic'),
			];
		}

		$vault_ready = is_dir($this->storage->base_path()) && is_writable($this->storage->base_path());
		$checks[] = [
			'key'     => 'upload_vault',
			'label'   => __('Private upload vault', 'wooptionsfic'),
			'status'  => $vault_ready ? 'good' : 'warning',
			'message' => $vault_ready
				? __('Writable and protected by server fallback files.', 'wooptionsfic')
				: __('The private upload vault is unavailable or not writable.', 'wooptionsfic'),
		];

		$checks[] = [
			'key'     => 'cleanup',
			'label'   => __('Scheduled cleanup', 'wooptionsfic'),
			'status'  => wp_next_scheduled('wooptionsfic_cleanup') ? 'good' : 'warning',
			'message' => wp_next_scheduled('wooptionsfic_cleanup')
				? __('Daily cleanup is scheduled.', 'wooptionsfic')
				: __('Cleanup is not currently scheduled.', 'wooptionsfic'),
		];

		$build_ready = is_readable(WOOPTIONSFIC_PATH . 'build/admin.js')
			&& is_readable(WOOPTIONSFIC_PATH . 'build/storefront.js');
		$checks[] = [
			'key'     => 'production_assets',
			'label'   => __('Production assets', 'wooptionsfic'),
			'status'  => $build_ready ? 'good' : 'critical',
			'message' => $build_ready
				? __('Compiled admin and storefront assets are present.', 'wooptionsfic')
				: __('Compiled assets are missing from this installation.', 'wooptionsfic'),
		];

		return [
			'generatedAtGmt' => gmdate('Y-m-d\TH:i:s\Z'),
			'environment'    => [
				'plugin'      => WOOPTIONSFIC_VERSION,
				'database'    => (string) get_option(Schema::VERSION_OPTION, '0'),
				'wordpress'   => (string) $wp_version,
				'woocommerce' => defined('WC_VERSION') ? (string) WC_VERSION : null,
				'php'         => PHP_VERSION,
			],
			'requirements'   => [
				'php'         => Requirements::MIN_PHP,
				'wordpress'   => Requirements::MIN_WP,
				'woocommerce' => Requirements::MIN_WC,
			],
			'checks'         => $checks,
			'integrations'   => $this->integrations(),
		];
	}

	/**
	 * @return list<array<string,mixed>>
	 */
	public function integrations(): array {
		return [
			[
				'key'      => 'woocommerce-classic',
				'name'     => __('WooCommerce classic product and checkout', 'wooptionsfic'),
				'status'   => Requirements::woocommerce_is_available() ? 'available' : 'unavailable',
				'evidence' => __('Runtime hooks and server-authoritative cart/order snapshots are installed.', 'wooptionsfic'),
			],
			[
				'key'      => 'woocommerce-store-api',
				'name'     => __('WooCommerce Store API cart items', 'wooptionsfic'),
				'status'   => function_exists('woocommerce_store_api_register_endpoint_data') ? 'available' : 'fallback',
				'evidence' => __('Extension data is registered when the supported Store API is present.', 'wooptionsfic'),
			],
			[
				'key'      => 'upload-scanner',
				'name'     => __('Upload scanner adapter', 'wooptionsfic'),
				'status'   => 'baseline',
				'evidence' => __('Built-in policy scanner; external antivirus can replace it with the documented filter.', 'wooptionsfic'),
			],
		];
	}
}
