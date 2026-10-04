<?php
/**
 * Merchant-facing bounded diagnostics.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Application;

use WooOptionsPro\Bootstrap\Requirements;
use WooOptionsPro\Infrastructure\Persistence\Schema;
use WooOptionsPro\Infrastructure\Storage\LocalPrivateStorage;

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
				'label'   => sprintf(__('Database table: %s', 'wooptions-pro'), $suffix),
				'status'  => $exists === $table ? 'good' : 'critical',
				'message' => $exists === $table
					? __('Ready', 'wooptions-pro')
					: __('Missing; deactivate and reactivate the plugin to retry migrations.', 'wooptions-pro'),
			];
		}

		$vault_ready = is_dir($this->storage->base_path()) && is_writable($this->storage->base_path());
		$checks[] = [
			'key'     => 'upload_vault',
			'label'   => __('Private upload vault', 'wooptions-pro'),
			'status'  => $vault_ready ? 'good' : 'warning',
			'message' => $vault_ready
				? __('Writable and protected by server fallback files.', 'wooptions-pro')
				: __('The private upload vault is unavailable or not writable.', 'wooptions-pro'),
		];

		$checks[] = [
			'key'     => 'cleanup',
			'label'   => __('Scheduled cleanup', 'wooptions-pro'),
			'status'  => wp_next_scheduled('wooptions-pro_cleanup') ? 'good' : 'warning',
			'message' => wp_next_scheduled('wooptions-pro_cleanup')
				? __('Daily cleanup is scheduled.', 'wooptions-pro')
				: __('Cleanup is not currently scheduled.', 'wooptions-pro'),
		];

		$build_ready = is_readable(WOOPTIONS_PRO_PATH . 'build/admin.js')
			&& is_readable(WOOPTIONS_PRO_PATH . 'build/storefront.js');
		$checks[] = [
			'key'     => 'production_assets',
			'label'   => __('Production assets', 'wooptions-pro'),
			'status'  => $build_ready ? 'good' : 'critical',
			'message' => $build_ready
				? __('Compiled admin and storefront assets are present.', 'wooptions-pro')
				: __('Compiled assets are missing from this installation.', 'wooptions-pro'),
		];

		return [
			'generatedAtGmt' => gmdate('Y-m-d\TH:i:s\Z'),
			'environment'    => [
				'plugin'      => WOOPTIONS_PRO_VERSION,
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
				'name'     => __('WooCommerce classic product and checkout', 'wooptions-pro'),
				'status'   => Requirements::woocommerce_is_available() ? 'available' : 'unavailable',
				'evidence' => __('Runtime hooks and server-authoritative cart/order snapshots are installed.', 'wooptions-pro'),
			],
			[
				'key'      => 'woocommerce-store-api',
				'name'     => __('WooCommerce Store API cart items', 'wooptions-pro'),
				'status'   => function_exists('woocommerce_store_api_register_endpoint_data') ? 'available' : 'fallback',
				'evidence' => __('Extension data is registered when the supported Store API is present.', 'wooptions-pro'),
			],
			[
				'key'      => 'upload-scanner',
				'name'     => __('Upload scanner adapter', 'wooptions-pro'),
				'status'   => 'baseline',
				'evidence' => __('Built-in policy scanner; external antivirus can replace it with the documented filter.', 'wooptions-pro'),
			],
		];
	}
}
