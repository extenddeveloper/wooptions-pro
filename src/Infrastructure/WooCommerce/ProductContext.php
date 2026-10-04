<?php
/**
 * WooCommerce product/customer facts adapter.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Infrastructure\WooCommerce;

use WooptionsFic\Application\NotFoundException;
use WooptionsFic\Bootstrap\Settings;

final class ProductContext {
	/**
	 * @return array<string,mixed>
	 */
	public function make(
		int $product_id,
		int $variation_id = 0,
		int $quantity = 1,
		int $owner_user_id = 0,
		string $session_hash = ''
	): array {
		$lookup_id = $variation_id > 0 ? $variation_id : $product_id;
		$product   = wc_get_product($lookup_id);
			if (! $product) {
				throw new NotFoundException('wooptionsfic_product_not_found');
			}
			if ($variation_id > 0
				&& (! $product instanceof \WC_Product_Variation || (int) $product->get_parent_id() !== $product_id)
			) {
				throw new NotFoundException('wooptionsfic_variation_not_found');
			}
		$parent_id = $variation_id > 0 ? $product_id : $product->get_id();
		$user      = wp_get_current_user();
		$customer  = function_exists('WC') && WC()->customer ? WC()->customer : null;

		return [
			'productId'      => $product_id,
			'variationId'    => $variation_id,
			'quantity'       => max(1, $quantity),
			'categoryIds'    => wc_get_product_term_ids($parent_id, 'product_cat'),
			'tagIds'         => wc_get_product_term_ids($parent_id, 'product_tag'),
			'productType'    => $product->get_type(),
			'loggedIn'       => is_user_logged_in(),
			'roles'          => array_values((array) $user->roles),
			'ownerUserId'    => $owner_user_id,
			'sessionHash'    => $session_hash,
			'basePrice'      => (string) $product->get_price('edit'),
			'currency'       => get_woocommerce_currency(),
			'currencyScale'  => wc_get_price_decimals(),
			'weight'         => (string) $product->get_weight(),
			'length'         => (string) $product->get_length(),
			'width'          => (string) $product->get_width(),
			'height'         => (string) $product->get_height(),
			'stockState'     => $product->get_stock_status(),
			'country'        => $customer ? (string) $customer->get_billing_country() : '',
			'locale'         => determine_locale(),
			'allowRegex'     => current_user_can('manage_wooptionsfic'),
				'allowNegativeTotal' => (bool) Settings::get('allow_negative_total', false),
		];
	}

	public function visible_and_purchasable(int $product_id): bool {
		$product = wc_get_product($product_id);
		return (bool) $product
			&& 'publish' === $product->get_status()
			&& $product->is_visible()
			&& $product->is_purchasable();
	}
}
