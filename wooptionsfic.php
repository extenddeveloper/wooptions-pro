<?php
/**
 * Plugin Name:       WooptionsFic — Product Options for WooCommerce
 * Description:       Accessible product options, conditional logic, formula pricing, repeaters, uploads, and visual configuration for WooCommerce.
 * Version:           1.0.0
 * Requires at least: 6.9
 * Requires PHP:      8.1
 * Requires Plugins:  woocommerce
 * WC requires at least: 9.0
 * Author:            WooptionsFic
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       wooptionsfic
 * Domain Path:       /languages
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

defined('ABSPATH') || exit;

define('WOOPTIONSFIC_VERSION', '1.0.0');
define('WOOPTIONSFIC_DB_VERSION', '2');
define('WOOPTIONSFIC_FILE', __FILE__);
define('WOOPTIONSFIC_PATH', plugin_dir_path(__FILE__));
define('WOOPTIONSFIC_URL', plugin_dir_url(__FILE__));
define('WOOPTIONSFIC_BASENAME', plugin_basename(__FILE__));

require_once WOOPTIONSFIC_PATH . 'src/Autoload.php';

\WooptionsFic\Autoload::register();

register_activation_hook(
	__FILE__,
	static function (bool $network_wide = false): void {
		\WooptionsFic\Bootstrap\Activation::activate($network_wide);
	}
);

register_deactivation_hook(
	__FILE__,
	static function (bool $network_wide = false): void {
		\WooptionsFic\Bootstrap\Deactivation::deactivate($network_wide);
	}
);

add_action(
	'init',
	static function (): void {
		load_plugin_textdomain(
			'wooptionsfic',
			false,
			dirname(plugin_basename(__FILE__)) . '/languages'
		);
	}
);

add_action(
	'plugins_loaded',
	static function (): void {
		if (! \WooptionsFic\Bootstrap\Requirements::runtime_is_supported()) {
			\WooptionsFic\Bootstrap\Requirements::register_runtime_notice();
			return;
		}

		$plugin = new \WooptionsFic\Bootstrap\Plugin();
		$plugin->boot();
	},
	20
);

add_filter(
	'plugin_action_links_' . WOOPTIONSFIC_BASENAME,
	static function (array $links): array {
		$url = admin_url('admin.php?page=wooptionsfic#/settings');
		$label = did_action('init') ? esc_html__('Settings', 'wooptionsfic') : 'Settings';
		array_unshift(
			$links,
			'<a href="' . esc_url($url) . '">' . $label . '</a>'
		);
		return $links;
	}
);
