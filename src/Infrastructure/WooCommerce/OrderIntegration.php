<?php
/**
 * Immutable WooCommerce order-item snapshots.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Infrastructure\WooCommerce;

use WooOptionsPro\Application\AnalyticsService;
use WooOptionsPro\Application\UploadService;
use WooOptionsPro\Infrastructure\WordPress\SessionGuard;

final class OrderIntegration {
	/**
	 * Order item meta keys that store internal technical data.
	 *
	 * @var list<string>
	 */
	private const HIDDEN_META_KEYS = [
		'_wooptions-pro_snapshot',
		'_wooptions-pro_price',
		'_wooptions-pro_upload_refs',
		'_wooptions-pro_schema_version',
		'_wooptions-pro_linked_child',
		'_wooptions_pro_snapshot',
		'_wooptions_pro_price',
		'_wooptions_pro_upload_refs',
		'_wooptions_pro_schema_version',
		'_wooptions_pro_linked_child',
		'wooptions-pro_snapshot',
		'wooptions-pro_price',
		'wooptions-pro_upload_refs',
		'wooptions-pro_schema_version',
		'wooptions-pro_linked_child',
		'wooptions_pro_snapshot',
		'wooptions_pro_price',
		'wooptions_pro_upload_refs',
		'wooptions_pro_schema_version',
		'wooptions_pro_linked_child',
	];

	public function __construct(
		private readonly UploadService $uploads,
		private readonly AnalyticsService $analytics,
		private readonly SessionGuard $sessions
	) {
	}

	public function register(): void {
		add_action('woocommerce_checkout_create_order_line_item', [$this, 'create_order_line_item'], 20, 4);
		add_action('woocommerce_checkout_order_created', [$this, 'order_created'], 20);
		add_action('woocommerce_after_order_itemmeta', [$this, 'render_admin_uploads'], 20, 3);
		add_action('woocommerce_order_item_meta_end', [$this, 'render_customer_uploads'], 20, 4);
		add_filter('woocommerce_hidden_order_itemmeta', [$this, 'hidden_order_itemmeta'], 20, 1);
		add_filter('woocommerce_order_item_get_formatted_meta_data', [$this, 'hide_technical_formatted_meta'], 20, 2);
	}

	/**
	 * @param array<string,mixed> $values Cart values.
	 */
	public function create_order_line_item(
		\WC_Order_Item_Product $item,
		string $cart_item_key,
		array $values,
		\WC_Order $order
	): void {
		unset($cart_item_key, $order);
		if (is_array($values['wooptions-pro'] ?? null)) {
			$data     = $values['wooptions-pro'];
			$snapshot = (array) ($data['snapshot'] ?? []);
			$price    = (array) ($data['price'] ?? []);
			$item->add_meta_data('_wooptions-pro_snapshot', wp_json_encode($snapshot, JSON_UNESCAPED_SLASHES), true);
			$item->add_meta_data('_wooptions-pro_price', wp_json_encode($price, JSON_UNESCAPED_SLASHES), true);
			$item->add_meta_data('_wooptions-pro_upload_refs', wp_json_encode(array_values((array) ($data['uploadRefs'] ?? []))), true);
			$item->add_meta_data('_wooptions-pro_schema_version', 1, true);
			$has_summary = false;
			foreach ((array) ($snapshot['summary'] ?? []) as $summary) {
				if (! is_array($summary) || ! empty($summary['sensitive'])) {
					continue;
				}
				$field_type = (string) ($summary['type'] ?? '');
				if ('product' === $field_type && apply_filters('wooptions-pro_add_linked_products_to_cart', true, $data, '')) {
					continue;
				}
				$label = trim((string) ($summary['label'] ?? ''));
				$value = trim((string) ($summary['value'] ?? ''));
				if ('' !== $label && '' !== $value) {
					$field_uuid       = (string) ($summary['fieldUuid'] ?? '');
					$value_with_price = CartIntegration::format_value_with_price($value, $field_uuid, $data);
					$item->add_meta_data($label, $value_with_price, false);
					$has_summary = true;
				}
			}
			if (! $has_summary && ! empty($price['contributions']) && is_array($price['contributions'])) {
				$product_field_uuids = [];
				foreach ((array) ($snapshot['summary'] ?? []) as $summary_line) {
					if (is_array($summary_line) && 'product' === ($summary_line['type'] ?? '')) {
						$product_field_uuids[(string) ($summary_line['fieldUuid'] ?? '')] = true;
					}
				}
				foreach ((array) ($data['linkedProducts'] ?? []) as $lp) {
					if (is_array($lp) && ! empty($lp['fieldUuid'])) {
						$product_field_uuids[(string) $lp['fieldUuid']] = true;
					}
				}
				$saved_sources = [];
				foreach ($price['contributions'] as $contrib) {
					if (! is_array($contrib)) {
						continue;
					}
					$source = (string) ($contrib['sourceUuid'] ?? '');
					if ('' === $source || isset($saved_sources[$source])) {
						continue;
					}
					if (isset($product_field_uuids[$source]) && apply_filters('wooptions-pro_add_linked_products_to_cart', true, $data, '')) {
						continue;
					}
					$saved_sources[$source] = true;
					$value_with_price = CartIntegration::format_value_with_price('', $source, $data);
					if ('' !== $value_with_price) {
						$label = trim((string) ($contrib['label'] ?? __('Option', 'wooptions-pro')));
						$item->add_meta_data($label, $value_with_price, false);
					}
				}
			}
		}
		if (is_array($values['wooptions-pro_child'] ?? null)) {
			$item->add_meta_data('_wooptions-pro_linked_child', wp_json_encode($values['wooptions-pro_child'], JSON_UNESCAPED_SLASHES), true);
		}
	}

	public function order_created(\WC_Order $order): void {
		foreach ($order->get_items('line_item') as $item) {
			if (! $item instanceof \WC_Order_Item_Product) {
				continue;
			}
			$raw_refs = (string) $item->get_meta('_wooptions-pro_upload_refs', true);
			$refs     = json_decode($raw_refs, true);
			if (is_array($refs)) {
				$this->uploads->attach_to_order(array_values(array_map('strval', $refs)), (int) $order->get_id());
			}
			$raw_snapshot = (string) $item->get_meta('_wooptions-pro_snapshot', true);
			$snapshot     = json_decode($raw_snapshot, true);
			if (! is_array($snapshot)) {
				continue;
			}
			$adjustment = (int) ($snapshot['price']['adjustment']['minor'] ?? 0);
			$this->analytics->record(
				'purchase',
				[
					'productId'     => (int) ($snapshot['productId'] ?? 0),
					'optionSetUuid' => (string) ($snapshot['setUuid'] ?? ''),
					'revisionUuid'  => (string) ($snapshot['revisionUuid'] ?? ''),
					'currency'      => (string) ($snapshot['price']['unitPrice']['currency'] ?? ''),
				]
			);
			$this->analytics->record(
				'option_revenue',
				[
					'productId'     => (int) ($snapshot['productId'] ?? 0),
					'optionSetUuid' => (string) ($snapshot['setUuid'] ?? ''),
					'revisionUuid'  => (string) ($snapshot['revisionUuid'] ?? ''),
					'currency'      => (string) ($snapshot['price']['unitPrice']['currency'] ?? ''),
				],
				1,
				$adjustment * max(1, (int) $item->get_quantity())
			);
		}
	}

	public function render_admin_uploads(int $item_id, mixed $item, mixed $product): void {
		unset($item_id, $product);
		if (! current_user_can('manage_wooptions-pro_uploads') || ! $item instanceof \WC_Order_Item_Product) {
			return;
		}
		$this->render_upload_links($item);
	}

	public function render_customer_uploads(
		int $item_id,
		mixed $item,
		mixed $order,
		bool $plain_text = false
	): void {
		unset($item_id, $order);
		if ($plain_text
			|| ! $item instanceof \WC_Order_Item_Product
			|| (! is_account_page() && ! is_order_received_page())
		) {
			return;
		}
		$this->render_upload_links($item);
	}

	private function render_upload_links(\WC_Order_Item_Product $item): void {
		$references = json_decode((string) $item->get_meta('_wooptions-pro_upload_refs', true), true);
		if (! is_array($references) || [] === $references) {
			return;
		}

		$links = [];
		foreach (array_slice(array_values(array_map('strval', $references)), 0, 25) as $reference) {
			try {
				$record = $this->uploads->record_for_download(
					$reference,
					get_current_user_id(),
					$this->sessions->session_hash()
				);
			} catch (\Throwable) {
				continue;
			}
			$url = wp_nonce_url(
				add_query_arg(
					[
						'action' => 'wooptions-pro_download',
						'file'   => $reference,
					],
					admin_url('admin-post.php')
				),
				'wooptions-pro_download_' . $reference
			);
			$filename = '' !== (string) $record['originalFilename']
				? (string) $record['originalFilename']
				: __('Customer upload', 'wooptions-pro');
			$links[] = '<a href="' . esc_url($url) . '">' . esc_html($filename) . '</a>';
		}

		if ([] !== $links) {
			echo '<div class="wooptions-pro-order-uploads"><strong>'
				. esc_html__('Private uploads:', 'wooptions-pro')
				. '</strong> ' . wp_kses_post(implode(', ', $links)) . '</div>';
		}
	}

	/**
	 * Hide internal technical metadata from the WooCommerce admin order edit screen.
	 *
	 * @param array<int|string,mixed> $hidden_meta Array of hidden meta keys.
	 * @return array<int|string,mixed> Filtered hidden meta keys.
	 */
	public function hidden_order_itemmeta(array $hidden_meta): array {
		if (apply_filters('wooptions-pro_show_internal_order_itemmeta', false)) {
			return $hidden_meta;
		}

		return array_values(array_unique(array_merge($hidden_meta, self::HIDDEN_META_KEYS)));
	}

	/**
	 * Strip internal technical order item meta from formatted metadata output.
	 *
	 * @param array<int|string,mixed> $formatted_meta Formatted meta data.
	 * @param \WC_Order_Item $item The order item object.
	 * @return array<int|string,mixed> Filtered formatted meta data.
	 */
	public function hide_technical_formatted_meta(array $formatted_meta, \WC_Order_Item $item): array {
		unset($item);
		if (apply_filters('wooptions-pro_show_internal_order_itemmeta', false)) {
			return $formatted_meta;
		}

		foreach ($formatted_meta as $meta_id => $meta) {
			$key = is_object($meta) ? (string) ($meta->key ?? '') : (is_array($meta) ? (string) ($meta['key'] ?? '') : '');
			if ('' === $key) {
				continue;
			}
			if (
				str_starts_with($key, '_wooptions-pro_') ||
				str_starts_with($key, '_wooptions_pro_') ||
				str_starts_with($key, 'wooptions-pro_') ||
				str_starts_with($key, 'wooptions_pro_') ||
				in_array($key, self::HIDDEN_META_KEYS, true)
			) {
				unset($formatted_meta[$meta_id]);
			}
		}

		return $formatted_meta;
	}
}

