<?php
/**
 * WooCommerce Store API extension data.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Infrastructure\WooCommerce;

final class StoreApiIntegration {
	public function register(): void {
		add_action('woocommerce_blocks_loaded', [$this, 'register_endpoint_data']);
	}

	public function register_endpoint_data(): void {
		if (! function_exists('woocommerce_store_api_register_endpoint_data')
			|| ! class_exists('\Automattic\WooCommerce\StoreApi\Schemas\V1\CartItemSchema')
		) {
			return;
		}
		woocommerce_store_api_register_endpoint_data(
			[
				'endpoint'        => \Automattic\WooCommerce\StoreApi\Schemas\V1\CartItemSchema::IDENTIFIER,
				'namespace'       => 'wooptionsfic',
				'data_callback'   => [$this, 'cart_item_data'],
				'schema_callback' => [$this, 'cart_item_schema'],
				'schema_type'     => ARRAY_A,
			]
		);
	}

	/**
	 * @param array<string,mixed> $cart_item Cart item.
	 * @return array<string,mixed>
	 */
	public function cart_item_data(array $cart_item): array {
		if (! is_array($cart_item['wooptionsfic'] ?? null)) {
			return [
				'configured' => false,
				'summary'    => [],
				'price'      => null,
			];
		}
		$summary = [];
		foreach ((array) ($cart_item['wooptionsfic']['snapshot']['summary'] ?? []) as $line) {
			if (! is_array($line) || ! empty($line['sensitive'])) {
				continue;
			}
			$field_type = (string) ($line['type'] ?? '');
			if ('product' === $field_type && apply_filters('wooptionsfic_add_linked_products_to_cart', true, (array) ($cart_item['wooptionsfic'] ?? []), '')) {
				continue;
			}
			$field_uuid    = (string) ($line['fieldUuid'] ?? '');
			$raw_value     = (string) ($line['value'] ?? '');
			$line['value'] = CartIntegration::format_value_with_price($raw_value, $field_uuid, (array) ($cart_item['wooptionsfic'] ?? []));
			$summary[]     = $line;
		}
		return [
			'configured'  => true,
			'summary'     => $summary,
			'price'       => (array) ($cart_item['wooptionsfic']['price'] ?? []),
			'revisionUuid'=> (string) ($cart_item['wooptionsfic']['snapshot']['revisionUuid'] ?? ''),
		];
	}

	/**
	 * @return array<string,mixed>
	 */
	public function cart_item_schema(): array {
		return [
			'configured' => ['description' => __('Whether this cart line has a WooptionsFic configuration.', 'wooptionsfic'), 'type' => 'boolean', 'readonly' => true],
			'summary'    => ['description' => __('Sanitized option summary.', 'wooptionsfic'), 'type' => 'array', 'readonly' => true],
			'price'      => ['description' => __('Server-calculated price breakdown.', 'wooptionsfic'), 'type' => ['object', 'null'], 'readonly' => true],
			'revisionUuid'=> ['description' => __('Immutable definition revision identifier.', 'wooptionsfic'), 'type' => 'string', 'readonly' => true],
		];
	}
}
