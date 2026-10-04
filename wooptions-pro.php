<?php
/**
 * Plugin Name:       WooOptions Pro Updated — Product Options for WooCommerce
 * Description:       Accessible product options, conditional logic, formula pricing, repeaters, uploads, and visual configuration for WooCommerce.
 * Version:           1.0.0
 * Requires at least: 6.9
 * Requires PHP:      8.1
 * Requires Plugins:  woocommerce
 * WC requires at least: 9.0
 * Author:            Themefic
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       wooptions-pro
 * Domain Path:       /languages
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

defined('ABSPATH') || exit;

define('WOOPTIONS_PRO_VERSION', '1.0.0');
define('WOOPTIONS_PRO_DB_VERSION', '2');
define('WOOPTIONS_PRO_FILE', __FILE__);
define('WOOPTIONS_PRO_PATH', plugin_dir_path(__FILE__));
define('WOOPTIONS_PRO_URL', plugin_dir_url(__FILE__));
define('WOOPTIONS_PRO_BASENAME', plugin_basename(__FILE__));

require_once WOOPTIONS_PRO_PATH . 'src/Autoload.php';

\WooOptionsPro\Autoload::register();

register_activation_hook(
	__FILE__,
	static function (bool $network_wide = false): void {
		\WooOptionsPro\Bootstrap\Activation::activate($network_wide);
	}
);

register_deactivation_hook(
	__FILE__,
	static function (bool $network_wide = false): void {
		\WooOptionsPro\Bootstrap\Deactivation::deactivate($network_wide);
	}
);

add_action(
	'init',
	static function (): void {
		load_plugin_textdomain(
			'wooptions-pro',
			false,
			dirname(plugin_basename(__FILE__)) . '/languages'
		);
	}
);

add_action(
	'plugins_loaded',
	static function (): void {
		if (!\WooOptionsPro\Bootstrap\Requirements::runtime_is_supported()) {
			\WooOptionsPro\Bootstrap\Requirements::register_runtime_notice();
			return;
		}

		$plugin = new \WooOptionsPro\Bootstrap\Plugin();
		$plugin->boot();
	},
	20
);

add_filter(
	'plugin_action_links_' . WOOPTIONS_PRO_BASENAME,
	static function (array $links): array {
		$license_url   = admin_url('admin.php?page=wooptions-pro-license');
		$settings_url  = admin_url('admin.php?page=wooptions-pro#/settings');
		$label         = did_action('init') ? esc_html__('Settings', 'wooptions-pro') : 'Settings';
		$license_label = did_action('init') ? esc_html__('License', 'wooptions-pro') : 'License';
		array_unshift(
			$links,
			'<a href="' . esc_url($settings_url) . '">' . $label . '</a>',
			'<a href="' . esc_url($license_url) . '">' . $license_label . '</a>'
		);
		return $links;
	}
);
