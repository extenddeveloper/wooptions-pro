<?php
/**
 * Storefront asset registration.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Presentation\Storefront;

final class Assets {
	public function register(): void {
		$asset = WOOPTIONSFIC_PATH . 'build/storefront.asset.php';
		$meta  = is_readable($asset) ? require $asset : ['dependencies' => [], 'version' => WOOPTIONSFIC_VERSION];
		wp_register_script(
			'wooptionsfic-storefront',
			WOOPTIONSFIC_URL . 'build/storefront.js',
			(array) ($meta['dependencies'] ?? []),
			(string) ($meta['version'] ?? WOOPTIONSFIC_VERSION),
			true
		);
		wp_register_style(
			'wooptionsfic-storefront',
			WOOPTIONSFIC_URL . 'build/storefront.css',
			[],
			(string) ($meta['version'] ?? WOOPTIONSFIC_VERSION)
		);
		wp_add_inline_script(
			'wooptionsfic-storefront',
			'window.WooptionsFicStorefront=' . wp_json_encode(
				[
					'restRoot'       => esc_url_raw(rest_url('wooptionsfic/v1/')),
					'locale'           => determine_locale(),
					'currencySymbol'   => function_exists('get_woocommerce_currency_symbol') ? html_entity_decode((string) get_woocommerce_currency_symbol(), ENT_QUOTES, 'UTF-8') : '$',
					'currencyPosition' => function_exists('get_option') ? (string) get_option('woocommerce_currency_pos', 'left_space') : 'left_space',
					'currency'         => function_exists('get_woocommerce_currency') ? (string) get_woocommerce_currency() : 'USD',
					'i18n'             => [
						'checking'       => __('Checking your configuration…', 'wooptionsfic'),
						'confirmed'      => __('Price confirmed', 'wooptionsfic'),
						'couldNotQuote'  => __('We could not confirm this configuration. Check the highlighted options and try again.', 'wooptionsfic'),
						'uploading'      => __('Uploading securely…', 'wooptionsfic'),
						'uploadComplete' => __('Upload ready', 'wooptionsfic'),
						'addRow'         => __('Add another', 'wooptionsfic'),
						'removeRow'      => __('Remove', 'wooptionsfic'),
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
		wp_enqueue_script('wooptionsfic-storefront');
		wp_enqueue_style('wooptionsfic-storefront');
	}
}
