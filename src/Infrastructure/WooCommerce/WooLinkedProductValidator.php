<?php
/**
 * WooCommerce product/variation stock validation.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Infrastructure\WooCommerce;

use WooOptionsPro\Application\LinkedProductValidator;

final class WooLinkedProductValidator implements LinkedProductValidator {
	public function validate(array $compiled, array $values, int $parent_product_id, int $cart_quantity, array $context = []): array {
		$errors = [];
		$items  = [];
		foreach ((array) ($compiled['fields'] ?? []) as $field) {
			if ('product' !== ($field['type'] ?? '')) {
				continue;
			}
			$field_uuid = (string) ($field['uuid'] ?? '');
			$selected   = is_array($values[$field_uuid] ?? null)
				? $values[$field_uuid]
				: (empty($values[$field_uuid]) ? [] : [$values[$field_uuid]]);
			foreach ((array) ($field['choices'] ?? []) as $choice) {
				$choice_uuid = (string) ($choice['uuid'] ?? '');
				if (! in_array($choice_uuid, $selected, true)) {
					continue;
				}
				$product_id   = (int) ($choice['productId'] ?? ($choice['linkedProductId'] ?? 0));
				$variation_id = (int) ($choice['linkedVariationId'] ?? 0);
				// If customer selected a variation on the storefront, validate that variation.
				$selected_var_id = (int) ($context['productVariations'][$choice_uuid] ?? 0);
				if ($selected_var_id > 0) {
					$variation_id = $selected_var_id;
				}
				$lookup_id    = $variation_id > 0 ? $variation_id : $product_id;
				$product      = $lookup_id > 0 && function_exists('wc_get_product') ? wc_get_product($lookup_id) : false;
				if ($variation_id <= 0 && $product && $product->is_type('variable')) {
					$default_attributes = method_exists($product, 'get_default_attributes') ? $product->get_default_attributes() : [];
					if (! empty($default_attributes) && class_exists('\WC_Data_Store')) {
						$data_store   = \WC_Data_Store::load('product');
						$variation_id = (int) $data_store->find_matching_product_variation($product, $default_attributes);
					}
					if ($variation_id <= 0 && method_exists($product, 'get_children')) {
						$children = $product->get_children();
						if (! empty($children)) {
							foreach ($children as $child_id) {
								$child_prod = wc_get_product((int) $child_id);
								if ($child_prod && $child_prod->is_purchasable() && $child_prod->is_in_stock()) {
									$variation_id = (int) $child_id;
									$product      = $child_prod;
									break;
								}
							}
						}
					} elseif ($variation_id > 0) {
						$product = wc_get_product($variation_id);
					}
				}
				$invalid_variation = $variation_id > 0
					&& (! $product instanceof \WC_Product_Variation || (int) $product->get_parent_id() !== $product_id);
				if (! $product
					|| $product_id <= 0
					|| $product_id === $parent_product_id
					|| $invalid_variation
					|| 'publish' !== $product->get_status()
				) {
					$errors[] = ['code' => 'linked_product_unavailable', 'fieldUuid' => $field_uuid, 'choiceUuid' => $choice_uuid];
					continue;
				}
				$choice_qty = ! empty($context['choiceQuantities'][$choice_uuid])
					? max(1, (int) $context['choiceQuantities'][$choice_uuid])
					: max(1, (int) ($choice['linkedQuantity'] ?? 1));
				$quantity = $choice_qty * max(1, $cart_quantity);
				if (! $product->is_purchasable() || ! $product->is_in_stock() || ! $product->has_enough_stock($quantity)) {
					$errors[] = ['code' => 'linked_product_stock', 'fieldUuid' => $field_uuid, 'choiceUuid' => $choice_uuid];
					continue;
				}
				$items[] = [
					'productId'   => $product_id,
					'variationId' => $variation_id,
					'quantity'    => $choice_qty,
					'fieldUuid'   => $field_uuid,
					'choiceUuid'  => $choice_uuid,
					'label'       => (string) ($choice['label'] ?? $product->get_name()),
				];
			}
		}
		return ['valid' => [] === $errors, 'errors' => $errors, 'items' => $items];
	}
}
