<?php
/**
 * Storefront asset registration.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Presentation\Storefront;

final class Assets {
	public function register(): void {
		$asset = WOOPTIONS_PRO_PATH . 'build/storefront.asset.php';
		$meta  = is_readable($asset) ? require $asset : ['dependencies' => [], 'version' => WOOPTIONS_PRO_VERSION];
		wp_register_script(
			'wooptions-pro-storefront',
			WOOPTIONS_PRO_URL . 'build/storefront.js',
			(array) ($meta['dependencies'] ?? []),
			(string) ($meta['version'] ?? WOOPTIONS_PRO_VERSION),
			true
		);
		wp_register_style(
			'wooptions-pro-storefront',
			WOOPTIONS_PRO_URL . 'build/storefront.css',
			[],
			(string) ($meta['version'] ?? WOOPTIONS_PRO_VERSION)
		);
		wp_add_inline_script(
			'wooptions-pro-storefront',
			'window.WooOptionsProStorefront=' . wp_json_encode(
				[
					'restRoot'       => esc_url_raw(rest_url('wooptions-pro/v1/')),
					'locale'           => determine_locale(),
					'currencySymbol'   => function_exists('get_woocommerce_currency_symbol') ? html_entity_decode((string) get_woocommerce_currency_symbol(), ENT_QUOTES, 'UTF-8') : '$',
					'currencyPosition' => function_exists('get_option') ? (string) get_option('woocommerce_currency_pos', 'left_space') : 'left_space',
					'currency'         => function_exists('get_woocommerce_currency') ? (string) get_woocommerce_currency() : 'USD',
					'i18n'             => [
						'checking'       => __('Checking your configuration…', 'wooptions-pro'),
						'confirmed'      => __('Price confirmed', 'wooptions-pro'),
						'couldNotQuote'  => __('We could not confirm this configuration. Check the highlighted options and try again.', 'wooptions-pro'),
						'uploading'      => __('Uploading securely…', 'wooptions-pro'),
						'uploadComplete' => __('Upload ready', 'wooptions-pro'),
						'addRow'         => __('Add another', 'wooptions-pro'),
						'removeRow'      => __('Remove', 'wooptions-pro'),
					],
				],
				JSON_UNESCAPED_SLASHES
			) . ';',
			'before'
		);
	}

	public function enqueue_on_product_pages(): void {
		if (! function_exists('is_product') || ! is_product()) {
			return;
		}
		wp_enqueue_script('wooptions-pro-storefront');
		wp_enqueue_style('wooptions-pro-storefront');
	}
}
