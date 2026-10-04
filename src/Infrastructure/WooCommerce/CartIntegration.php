<?php
/**
 * Server-authoritative WooCommerce cart lifecycle.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Infrastructure\WooCommerce;

use Throwable;
use WooptionsFic\Application\AnalyticsService;
use WooptionsFic\Application\QuoteService;
use WooptionsFic\Application\UploadService;
use WooptionsFic\Bootstrap\Settings;
use WooptionsFic\Domain\Support\CanonicalJson;
use WooptionsFic\Infrastructure\WordPress\SessionGuard;

final class CartIntegration {
	/** @var array<string,array<string,mixed>> */
	private array $pending_quotes = [];
	private bool $adding_linked = false;
	private bool $removing_related = false;

	/**
	 * WeakMap registry that stores custom unit prices per WC_Product instance.
	 * Using WeakMap avoids the PHP 8.2+ dynamic-property deprecation while
	 * still allowing GC once the product object is released.
	 *
	 * @var \WeakMap<\WC_Product, string>|null
	 */
	private static ?\WeakMap $price_registry = null;

	private static function price_registry(): \WeakMap {
		if ( null === self::$price_registry ) {
			self::$price_registry = new \WeakMap();
		}
		return self::$price_registry;
	}

	private static function set_product_price( \WC_Product $product, string $price ): void {
		self::price_registry()[ $product ] = $price;
		$product->set_price( $price );
	}

	private static function get_product_price( \WC_Product $product ): ?string {
		return self::price_registry()[ $product ] ?? null;
	}

	/**
	 * Get the effective unit price for the parent cart item.
	 * When linked products are added to the cart as separate line items,
	 * deducts their contributions from the parent's unit price so the customer
	 * is not double-charged.
	 *
	 * @param array<string,mixed> $cart_item Cart item data.
	 * @return string|null Decimal price string, or null if no custom price.
	 */
	public static function get_cart_product_price(array $cart_item): ?string {
		if (! isset($cart_item['wooptionsfic']['price']['unitPrice']['decimal'])) {
			return null;
		}
		$wooptionsfic = (array) ($cart_item['wooptionsfic'] ?? []);
		$decimal      = (string) ($wooptionsfic['price']['unitPrice']['decimal'] ?? '');
		if (1 !== preg_match('/\A\d+(?:\.\d+)?\z/', $decimal)) {
			return null;
		}

		if (apply_filters('wooptionsfic_add_linked_products_to_cart', true, $wooptionsfic, '')) {
			$scale                = max(0, min(6, (int) ($wooptionsfic['price']['unitPrice']['scale'] ?? 2)));
			$total_minor          = (int) ($wooptionsfic['price']['unitPrice']['minor'] ?? 0);
			$product_choice_minor = 0;

			$product_field_uuids = [];
			foreach ((array) ($wooptionsfic['snapshot']['summary'] ?? []) as $summary_line) {
				if (is_array($summary_line) && 'product' === ($summary_line['type'] ?? '')) {
					$product_field_uuids[(string) ($summary_line['fieldUuid'] ?? '')] = true;
				}
			}
			foreach ((array) ($wooptionsfic['linkedProducts'] ?? []) as $lp) {
				if (is_array($lp) && ! empty($lp['fieldUuid'])) {
					$product_field_uuids[(string) $lp['fieldUuid']] = true;
				}
			}

			if (! empty($product_field_uuids)) {
				$contributions = (array) ($wooptionsfic['price']['contributions'] ?? []);
				foreach ($contributions as $contrib) {
					if (is_array($contrib) && isset($product_field_uuids[(string) ($contrib['sourceUuid'] ?? '')])) {
						$product_choice_minor += (int) ($contrib['rounded']['minor'] ?? 0);
					}
				}
				if ($product_choice_minor > 0) {
					$adjusted_minor  = max(0, $total_minor - $product_choice_minor);
					$adjusted_amount = $adjusted_minor / (10 ** $scale);
					return number_format($adjusted_amount, $scale, '.', '');
				}
			}
		}

		return $decimal;
	}

	public function __construct(
		private readonly QuoteService $quotes,
		private readonly ProductContext $products,
		private readonly SessionGuard $sessions,
		private readonly UploadService $uploads,
		private readonly AnalyticsService $analytics
	) {
	}

	public function register(): void {
		add_filter('woocommerce_add_to_cart_validation', [$this, 'validate_add_to_cart'], 20, 6);
		add_filter('woocommerce_add_cart_item_data', [$this, 'add_cart_item_data'], 20, 4);
		add_filter('woocommerce_add_cart_item', [$this, 'add_cart_item'], 20, 2);
		add_action('woocommerce_add_to_cart', [$this, 'after_add_to_cart'], 20, 6);
		add_action('woocommerce_before_calculate_totals', [$this, 'apply_prices'], 20);
		add_action('woocommerce_before_calculate_totals', [$this, 'apply_prices'], 9999);
		add_action('woocommerce_before_mini_cart', [$this, 'apply_prices'], 1);
		add_action('woocommerce_before_mini_cart_contents', [$this, 'apply_prices'], 1);
		add_filter('woocommerce_product_get_price', [$this, 'filter_product_price'], 9999, 2);
		add_filter('woocommerce_product_variation_get_price', [$this, 'filter_product_price'], 9999, 2);
		add_filter('woocommerce_get_item_data', [$this, 'display_item_data'], 20, 2);
		add_filter('woocommerce_get_cart_item_from_session', [$this, 'restore_from_session'], 20, 3);
		add_action('woocommerce_check_cart_items', [$this, 'revalidate_cart'], 20);
		add_action('woocommerce_after_cart_item_quantity_update', [$this, 'sync_linked_quantity'], 20, 4);
		add_action('woocommerce_remove_cart_item', [$this, 'remove_related_items'], 20, 2);
		add_filter('woocommerce_cart_item_class', [$this, 'cart_item_class'], 20, 3);
	}

	public function validate_add_to_cart(
		bool $passed,
		int $product_id,
		int $quantity,
		int $variation_id = 0,
		array $variations = [],
		array $cart_item_data = []
	): bool {
		unset($variations, $cart_item_data);
		if (! $passed || $this->adding_linked) {
			return $passed;
		}

		try {
			$context = $this->context($product_id, $variation_id, $quantity);
			$config  = $this->quotes->configuration($context);
			if (! $config) {
				return $passed;
			}

			$token = $this->posted_string('wooptionsfic_token');
			$token_valid = '' !== $token && $this->sessions->verify($token, $product_id, (string) $config['revisionUuid']);

			$selection = $this->posted_selection();
			if (! $token_valid && defined('WP_DEBUG') && WP_DEBUG) {
				error_log('WooptionsFic add-to-cart token soft-refresh for product ' . $product_id); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			}
			$quote     = $this->quotes->quote($selection, $context);
			if (empty($quote['valid'])) {
				$this->add_validation_notices((array) ($quote['errors'] ?? []));
				return false;
			}
			$this->pending_quotes[$this->quote_key($product_id, $variation_id, $quantity, $selection)] = $quote;
			return true;
		} catch (Throwable $exception) {
			if (defined('WP_DEBUG') && WP_DEBUG) {
				error_log('WooptionsFic add-to-cart validation: ' . $exception->getMessage()); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			}
			wc_add_notice(__('We could not validate these product options. Please refresh and try again.', 'wooptionsfic'), 'error');
			return false;
		}
	}

	/**
	 * @param array<string,mixed> $cart_item_data Cart data.
	 * @return array<string,mixed>
	 */
	public function add_cart_item_data(
		array $cart_item_data,
		int $product_id,
		int $variation_id,
		int $quantity
	): array {
		if ($this->adding_linked || isset($cart_item_data['wooptionsfic_child'])) {
			return $cart_item_data;
		}
		try {
			$context = $this->context($product_id, $variation_id, $quantity);
			$config  = $this->quotes->configuration($context);
			if (! $config) {
				return $cart_item_data;
			}
			$selection = $this->posted_selection();
			$key       = $this->quote_key($product_id, $variation_id, $quantity, $selection);
			$quote     = $this->pending_quotes[$key] ?? $this->quotes->quote($selection, $context);
			if (empty($quote['valid'])) {
				return $cart_item_data;
			}
			$cart_item_data['wooptionsfic'] = [
				'selection'         => (array) $quote['values'],
				'snapshot'          => (array) $quote['snapshot'],
				'price'             => (array) $quote['price'],
				'productVariations' => (array) ($context['productVariations'] ?? []),
				'choiceQuantities'  => (array) ($context['choiceQuantities'] ?? []),
				'uploadRefs'        => array_values(array_map('strval', (array) ($quote['uploadRefs'] ?? []))),
				'linkedProducts'    => array_values(array_filter((array) ($quote['linkedProducts'] ?? []), 'is_array')),
				'configurationKey'  => hash('sha256', CanonicalJson::encode([$quote['revisionHash'], $quote['values'], microtime(true)])),
			];
		} catch (Throwable) {
			return $cart_item_data;
		}
		return $cart_item_data;
	}

	/**
	 * Apply custom option price when item is first added to the cart.
	 *
	 * @param array<string,mixed> $cart_item Cart item data.
	 * @param string $cart_item_key Cart item key.
	 * @return array<string,mixed>
	 */
	public function add_cart_item(array $cart_item, string $cart_item_key = ''): array {
		unset($cart_item_key);
		$decimal = self::get_cart_product_price($cart_item);
		if (null !== $decimal) {
			$product = $cart_item['data'] ?? null;
			if ($product instanceof \WC_Product) {
				self::set_product_price($product, $decimal);
			}
		}
		return $cart_item;
	}

	public function after_add_to_cart(
		string $cart_item_key,
		int $product_id,
		int $quantity,
		int $variation_id,
		array $variation,
		array $cart_item_data
	): void {
		unset($product_id, $variation_id, $variation);
		if (! isset($cart_item_data['wooptionsfic']) || ! is_array($cart_item_data['wooptionsfic'])) {
			return;
		}
		$data = $cart_item_data['wooptionsfic'];
		$this->uploads->attach_to_cart((array) ($data['uploadRefs'] ?? []), $cart_item_key);

		if (! function_exists('WC') || ! WC()->cart) {
			return;
		}
		// Selected product choices are added to the cart as separate products with their own product price.
		if (apply_filters('wooptionsfic_add_linked_products_to_cart', true, $data, $cart_item_key)) {
			$this->adding_linked = true;
			try {
				foreach ((array) ($data['linkedProducts'] ?? []) as $linked) {
					if (! is_array($linked)) {
						continue;
					}
					$factor       = max(1, (int) ($linked['quantity'] ?? 1));
					$linked_id    = max(1, (int) ($linked['productId'] ?? 0));
					$variation_id = max(0, (int) ($linked['variationId'] ?? 0));
					$variation_args = [];
					if ($variation_id > 0 && function_exists('wc_get_product')) {
						$var_prod = wc_get_product($variation_id);
						if ($var_prod instanceof \WC_Product_Variation) {
							$variation_args = (array) $var_prod->get_variation_attributes();
						}
					} elseif ($variation_id <= 0 && function_exists('wc_get_product')) {
						$linked_prod = wc_get_product($linked_id);
						if ($linked_prod && $linked_prod->is_type('variable')) {
							$children = $linked_prod->get_children();
							if (! empty($children)) {
								$variation_id = (int) reset($children);
								$var_prod     = wc_get_product($variation_id);
								if ($var_prod instanceof \WC_Product_Variation) {
									$variation_args = (array) $var_prod->get_variation_attributes();
								}
							}
						}
					}
					WC()->cart->add_to_cart(
						$linked_id,
						max(1, $quantity) * $factor,
						$variation_id,
						$variation_args,
						[
							'wooptionsfic_child' => [
								'parentKey'  => $cart_item_key,
								'factor'     => $factor,
								'fieldUuid'  => (string) ($linked['fieldUuid'] ?? ''),
								'choiceUuid' => (string) ($linked['choiceUuid'] ?? ''),
								'label'      => (string) ($linked['label'] ?? ''),
							],
						]
					);
				}
			} finally {
				$this->adding_linked = false;
			}
		}

		$snapshot = (array) ($data['snapshot'] ?? []);
		$this->analytics->record(
			'add_to_cart',
			[
				'productId'     => (int) ($snapshot['productId'] ?? 0),
				'optionSetUuid' => (string) ($snapshot['setUuid'] ?? ''),
				'revisionUuid'  => (string) ($snapshot['revisionUuid'] ?? ''),
			]
		);
		if (function_exists('WC') && WC()->cart) {
			WC()->cart->calculate_totals();
		}
	}

	public function apply_prices(?\WC_Cart $cart = null): void {
		if (is_admin() && ! wp_doing_ajax()) {
			return;
		}
		if (! $cart instanceof \WC_Cart) {
			if (! function_exists('WC') || ! WC()->cart) {
				return;
			}
			$cart = WC()->cart;
		}
		foreach ($cart->get_cart() as $cart_item) {
			if (! is_array($cart_item) || ! is_array($cart_item['wooptionsfic']['price']['unitPrice'] ?? null)) {
				continue;
			}
			$product = $cart_item['data'] ?? null;
			if (! $product instanceof \WC_Product) {
				continue;
			}
			$decimal = self::get_cart_product_price($cart_item);
			if (null !== $decimal) {
				self::set_product_price($product, $decimal);
			}
		}
	}

	/**
	 * Ensure product instances in cart/checkout return their custom calculated unit price.
	 *
	 * @param mixed $price Product price.
	 * @param \WC_Product $product Product instance.
	 * @return mixed
	 */
	public function filter_product_price(mixed $price, \WC_Product $product): mixed {
		$custom = self::get_product_price($product);
		if (null !== $custom && 1 === preg_match('/\A\d+(?:\.\d+)?\z/', $custom)) {
			return $custom;
		}
		return $price;
	}

	/**
	 * @param list<array<string,mixed>> $item_data Existing display data.
	 * @param array<string,mixed> $cart_item Cart item.
	 * @return list<array<string,mixed>>
	 */
	public function display_item_data(array $item_data, array $cart_item): array {
		$hide_in_cart     = (bool) apply_filters('wooptionsfic_hide_addon_in_cart', (bool) Settings::get('hide_addon_in_cart', false), $cart_item);
		$hide_in_checkout = (bool) apply_filters('wooptionsfic_hide_addon_in_checkout', (bool) Settings::get('hide_addon_in_checkout', false), $cart_item);

		$is_checkout = function_exists('is_checkout') && is_checkout();
		if (! $is_checkout && wp_doing_ajax() && isset($_GET['wc-ajax']) && 'update_order_review' === $_GET['wc-ajax']) {
			$is_checkout = true;
		}

		$is_cart = ! $is_checkout && function_exists('is_cart') && is_cart();
		if (! $is_checkout && ! $is_cart && wp_doing_ajax() && isset($_GET['wc-ajax']) && in_array($_GET['wc-ajax'], ['get_refreshed_fragments', 'apply_coupon', 'remove_coupon'], true)) {
			$is_cart = true;
		}

		if ($hide_in_cart && $is_cart) {
			return $item_data;
		}
		if ($hide_in_checkout && $is_checkout) {
			return $item_data;
		}

		if (is_array($cart_item['wooptionsfic']['snapshot']['summary'] ?? null)) {
			$wooptionsfic = (array) ($cart_item['wooptionsfic'] ?? []);
			foreach ($cart_item['wooptionsfic']['snapshot']['summary'] as $line) {
				if (! is_array($line) || ! empty($line['sensitive'])) {
					continue;
				}
				$field_type = (string) ($line['type'] ?? '');
				if ('product' === $field_type && apply_filters('wooptionsfic_add_linked_products_to_cart', true, $wooptionsfic, '')) {
					continue;
				}
				$field_uuid = (string) ($line['fieldUuid'] ?? '');
				$raw_value  = (string) ($line['value'] ?? '');
				$value      = self::format_value_with_price($raw_value, $field_uuid, $wooptionsfic);
				if ('' === $value) {
					continue;
				}
				$label = (string) ($line['label'] ?? __('Option', 'wooptionsfic'));
				$item_data[] = [
					'key'     => $label,
					'name'    => $label,
					'value'   => $value,
					'display' => $value,
				];
			}
		}
		if (empty($item_data) && ! empty($cart_item['wooptionsfic']['price']['contributions']) && is_array($cart_item['wooptionsfic']['price']['contributions'])) {
			$wooptionsfic = (array) ($cart_item['wooptionsfic'] ?? []);
			$product_field_uuids = [];
			foreach ((array) ($wooptionsfic['snapshot']['summary'] ?? []) as $summary_line) {
				if (is_array($summary_line) && 'product' === ($summary_line['type'] ?? '')) {
					$product_field_uuids[(string) ($summary_line['fieldUuid'] ?? '')] = true;
				}
			}
			foreach ((array) ($wooptionsfic['linkedProducts'] ?? []) as $lp) {
				if (is_array($lp) && ! empty($lp['fieldUuid'])) {
					$product_field_uuids[(string) $lp['fieldUuid']] = true;
				}
			}
			$rendered_sources = [];
			foreach ($cart_item['wooptionsfic']['price']['contributions'] as $contrib) {
				if (! is_array($contrib)) {
					continue;
				}
				$source = (string) ($contrib['sourceUuid'] ?? '');
				if ('' === $source || isset($rendered_sources[$source])) {
					continue;
				}
				if (isset($product_field_uuids[$source]) && apply_filters('wooptionsfic_add_linked_products_to_cart', true, $wooptionsfic, '')) {
					continue;
				}
				$rendered_sources[$source] = true;
				$value = self::format_value_with_price('', $source, $wooptionsfic);
				if ('' !== $value) {
					$label = (string) ($contrib['label'] ?? __('Option', 'wooptionsfic'));
					$item_data[] = [
						'key'     => $label,
						'name'    => $label,
						'value'   => $value,
						'display' => $value,
					];
				}
			}
		}
		if (is_array($cart_item['wooptionsfic_child'] ?? null)) {
			if (apply_filters('wooptionsfic_show_part_of_configuration_meta', false, $cart_item)) {
				$child_label = (string) ($cart_item['wooptionsfic_child']['label'] ?? '');
				$item_data[] = [
					'key'     => __('Part of configuration', 'wooptionsfic'),
					'name'    => __('Part of configuration', 'wooptionsfic'),
					'value'   => $child_label,
					'display' => esc_html($child_label),
				];
			}
		}
		return $item_data;
	}

	/**
	 * Format an option display value with its price contribution if applicable.
	 *
	 * @param string $value Option value string.
	 * @param string $field_uuid Field UUID.
	 * @param array<string,mixed> $wooptionsfic Configuration cart item data.
	 * @return string
	 */
	public static function format_value_with_price(string $value, string $field_uuid, array $wooptionsfic): string {
		$value = trim($value);
		if ('' === $value && '' === $field_uuid) {
			return $value;
		}

		$contributions = (array) ($wooptionsfic['price']['contributions'] ?? []);
		$scale         = max(0, min(6, (int) ($wooptionsfic['price']['unitPrice']['scale'] ?? 2)));
		$total_minor   = 0;
		$found         = false;

		$child_uuids = [];
		if (isset($wooptionsfic['selection'][$field_uuid]) && is_array($wooptionsfic['selection'][$field_uuid])) {
			foreach ($wooptionsfic['selection'][$field_uuid] as $row) {
				if (is_array($row['values'] ?? null)) {
					foreach (array_keys($row['values']) as $child_id) {
						$child_uuids[(string) $child_id] = true;
					}
				}
			}
		}

		$choice_labels = [];
		foreach ($contributions as $contrib) {
			if (! is_array($contrib)) {
				continue;
			}
			$source = (string) ($contrib['sourceUuid'] ?? '');
			$match  = false;
			if (str_contains($field_uuid, ':row:')) {
				$match = ($source === $field_uuid);
			} else {
				$source_base = str_contains($source, ':row:') ? explode(':row:', $source)[0] : $source;
				$match       = ($source === $field_uuid || $source_base === $field_uuid || isset($child_uuids[$source]) || isset($child_uuids[$source_base]));
			}
			if ($match) {
				$total_minor += (int) ($contrib['rounded']['minor'] ?? 0);
				$found = true;
				if (! empty($contrib['operands']['choiceLabel']) && is_string($contrib['operands']['choiceLabel'])) {
					$lbl = trim((string) $contrib['operands']['choiceLabel']);
					if ('' !== $lbl && ! in_array($lbl, $choice_labels, true)) {
						$choice_labels[] = $lbl;
					}
				}
			}
		}

		$enhanced_label = ! empty($choice_labels) ? implode(', ', $choice_labels) : '';
		$base_display   = '' !== $enhanced_label ? $enhanced_label : $value;

		if ('' === $base_display) {
			if (! $found || 0 === $total_minor) {
				return '';
			}
			$amount    = $total_minor / (10 ** $scale);
			$price_str = self::format_price_string(abs($amount), $scale);
			return '' !== $price_str ? ($total_minor > 0 ? '+' : '-') . $price_str : '';
		}

		if (! $found || 0 === $total_minor) {
			return rtrim($base_display, ',');
		}

		$amount    = $total_minor / (10 ** $scale);
		$price_str = self::format_price_string(abs($amount), $scale);
		if ('' === $price_str) {
			return rtrim($base_display, ',');
		}

		$sign      = $total_minor > 0 ? '+' : '-';
		$price_tag = ' ' . $sign . $price_str;

		if (str_ends_with($base_display, $price_tag)) {
			return $base_display;
		}

		return $base_display . $price_tag;
	}

	/**
	 * Format price amount using WooCommerce currency formatting.
	 *
	 * @param float $amount Absolute price amount.
	 * @param int $scale Decimal scale.
	 * @return string
	 */
	public static function format_price_string(float $amount, int $scale = 2): string {
		if (function_exists('wc_price')) {
			$html     = wc_price($amount, ['decimals' => $scale]);
			$stripped = wp_strip_all_tags($html);
			$decoded  = html_entity_decode($stripped, ENT_QUOTES, 'UTF-8');
			return trim($decoded);
		}

		$symbol = function_exists('get_woocommerce_currency_symbol')
			? html_entity_decode(get_woocommerce_currency_symbol(), ENT_QUOTES, 'UTF-8')
			: '$';

		return number_format($amount, $scale, '.', '') . $symbol;
	}

	/**
	 * @param array<string,mixed> $cart_item Cart item.
	 * @param array<string,mixed> $session_values Session data.
	 * @return array<string,mixed>
	 */
	public function restore_from_session(array $cart_item, array $session_values, string $cart_item_key): array {
		unset($cart_item_key);
		foreach (['wooptionsfic', 'wooptionsfic_child'] as $key) {
			if (isset($session_values[$key]) && is_array($session_values[$key])) {
				$cart_item[$key] = $session_values[$key];
			}
		}
		$decimal = self::get_cart_product_price($cart_item);
		if (null !== $decimal) {
			$product = $cart_item['data'] ?? null;
			if ($product instanceof \WC_Product) {
				self::set_product_price($product, $decimal);
			}
		}
		return $cart_item;
	}

	public function revalidate_cart(): void {
		if (! function_exists('WC') || ! WC()->cart) {
			return;
		}
		foreach (WC()->cart->get_cart() as $key => &$cart_item) {
			if (! is_array($cart_item['wooptionsfic'] ?? null)) {
				continue;
			}
			try {
				$product_id   = (int) ($cart_item['product_id'] ?? 0);
				$variation_id = (int) ($cart_item['variation_id'] ?? 0);
				$quantity     = max(1, (int) ($cart_item['quantity'] ?? 1));
				$context      = $this->context($product_id, $variation_id, $quantity);
				if (! empty($cart_item['wooptionsfic']['productVariations']) && is_array($cart_item['wooptionsfic']['productVariations'])) {
					$context['productVariations'] = (array) $cart_item['wooptionsfic']['productVariations'];
				}
				if (! empty($cart_item['wooptionsfic']['choiceQuantities']) && is_array($cart_item['wooptionsfic']['choiceQuantities'])) {
					$context['choiceQuantities'] = (array) $cart_item['wooptionsfic']['choiceQuantities'];
				}
				$quote        = $this->quotes->quote((array) $cart_item['wooptionsfic']['selection'], $context);
				if (empty($quote['valid'])) {
					wc_add_notice(
						sprintf(
							/* translators: %s: product name. */
							__('Please review the configuration for “%s” before checking out.', 'wooptionsfic'),
							(string) ($cart_item['data'] instanceof \WC_Product ? $cart_item['data']->get_name() : __('configured product', 'wooptionsfic'))
						),
						'error'
					);
					continue;
				}
				$cart_item['wooptionsfic']['selection'] = $quote['values'];
				$cart_item['wooptionsfic']['snapshot']  = $quote['snapshot'];
				$cart_item['wooptionsfic']['price']     = $quote['price'];
				$decimal = self::get_cart_product_price($cart_item);
				if (null !== $decimal) {
					$product = $cart_item['data'] ?? null;
					if ($product instanceof \WC_Product) {
						self::set_product_price($product, $decimal);
					}
				}
				WC()->cart->cart_contents[$key]         = $cart_item;
			} catch (Throwable) {
				wc_add_notice(__('A configured product could not be revalidated. Remove it and add it again.', 'wooptionsfic'), 'error');
			}
		}
		unset($cart_item);
	}

	public function sync_linked_quantity(string $cart_item_key, int $quantity, int $old_quantity, \WC_Cart $cart): void {
		unset($old_quantity);
		foreach ($cart->get_cart() as $child_key => $item) {
			$child = $item['wooptionsfic_child'] ?? null;
			if (! is_array($child) || (string) ($child['parentKey'] ?? '') !== $cart_item_key) {
				continue;
			}
			$cart->set_quantity($child_key, max(1, $quantity) * max(1, (int) ($child['factor'] ?? 1)), false);
		}
	}

	public function remove_related_items(string $cart_item_key, \WC_Cart $cart): void {
		if ($this->removing_related) {
			return;
		}
		$this->removing_related = true;
		try {
			$item = $cart->get_cart_item($cart_item_key);
			$parent_key = is_array($item['wooptionsfic_child'] ?? null)
				? (string) ($item['wooptionsfic_child']['parentKey'] ?? '')
				: '';
			if ('' !== $parent_key && $cart->get_cart_item($parent_key)) {
				$cart->remove_cart_item($parent_key);
			}
			foreach ($cart->get_cart() as $key => $candidate) {
				if ((string) ($candidate['wooptionsfic_child']['parentKey'] ?? '') === $cart_item_key) {
					$cart->remove_cart_item($key);
				}
			}
		} finally {
			$this->removing_related = false;
		}
	}

	public function cart_item_class(string $class, array $cart_item, string $cart_item_key): string {
		unset($cart_item_key);
		if (isset($cart_item['wooptionsfic_child'])) {
			$class .= ' wooptionsfic-linked-child';
		} elseif (isset($cart_item['wooptionsfic'])) {
			$class .= ' wooptionsfic-configured-parent';
		}
		return trim($class);
	}

	/**
	 * @return array<string,mixed>
	 */
	private function context(int $product_id, int $variation_id, int $quantity): array {
		$context = $this->products->make(
			$product_id,
			$variation_id,
			$quantity,
			get_current_user_id(),
			$this->sessions->session_hash()
		);
		$vars = [];
		$qtys = [];

		// 1. Direct POST arrays: e.g. name="wooptionsfic_var[CHOICE_UUID]" or name="xyz_var[CHOICE_UUID]"
		foreach ($_POST as $k => $v) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
			if (str_ends_with((string) $k, '_var') && is_array($v)) {
				foreach ($v as $cuuid => $var_id) {
					if (is_scalar($var_id) && '' !== (string) $var_id) {
						$vars[sanitize_text_field((string) $cuuid)] = (int) $var_id;
					}
				}
			} elseif (str_ends_with((string) $k, '_qty') && is_array($v)) {
				foreach ($v as $cuuid => $qty_val) {
					if (is_scalar($qty_val) && (int) $qty_val > 0) {
						$qtys[sanitize_text_field((string) $cuuid)] = (int) $qty_val;
					}
				}
			}
		}

		// 2. Hidden JSON inputs populated by storefront JS
		$raw_vars_json = $this->posted_string('wooptionsfic_product_variations');
		if ('' !== $raw_vars_json && strlen($raw_vars_json) <= 65536) {
			$decoded_vars = json_decode($raw_vars_json, true);
			if (is_array($decoded_vars)) {
				foreach ($decoded_vars as $cuuid => $var_id) {
					if (is_scalar($var_id) && '' !== (string) $var_id) {
						$vars[sanitize_text_field((string) $cuuid)] = (int) $var_id;
					}
				}
			}
		}

		$raw_qtys_json = $this->posted_string('wooptionsfic_choice_quantities');
		if ('' !== $raw_qtys_json && strlen($raw_qtys_json) <= 65536) {
			$decoded_qtys = json_decode($raw_qtys_json, true);
			if (is_array($decoded_qtys)) {
				foreach ($decoded_qtys as $cuuid => $qty_val) {
					if (is_scalar($qty_val) && (int) $qty_val > 0) {
						$qtys[sanitize_text_field((string) $cuuid)] = (int) $qty_val;
					}
				}
			}
		}

		if (! empty($vars)) {
			$context['productVariations'] = $vars;
		}
		if (! empty($qtys)) {
			$context['choiceQuantities'] = $qtys;
		}
		return $context;
	}

	/**
	 * @return array<string,mixed>
	 */
	private function posted_selection(): array {
		$json = $this->posted_string('wooptionsfic_selection_json');
		if ('' !== $json && strlen($json) <= 262144) {
			$decoded = json_decode($json, true);
			if (is_array($decoded)) {
				return $decoded;
			}
		}
		$value = $_POST['wooptionsfic_selection'] ?? []; // phpcs:ignore WordPress.Security.NonceVerification.Missing
		$value = is_array($value) ? wp_unslash($value) : [];
		return $this->bounded_array($value);
	}

	private function posted_string(string $key): string {
		$value = $_POST[$key] ?? ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing
		return is_scalar($value) ? sanitize_text_field(wp_unslash((string) $value)) : '';
	}

	/**
	 * @param array<string,mixed> $value Value.
	 * @return array<string,mixed>
	 */
	private function bounded_array(array $value, int $depth = 0): array {
		if ($depth > 5) {
			return [];
		}
		$output = [];
		foreach (array_slice($value, 0, 500, true) as $key => $item) {
			$safe_key = substr((string) $key, 0, 80);
			if (is_array($item)) {
				$output[$safe_key] = $this->bounded_array($item, $depth + 1);
			} elseif (is_scalar($item)) {
				$output[$safe_key] = substr((string) $item, 0, 10000);
			}
		}
		return $output;
	}

	/**
	 * @param array<string,mixed> $selection Selection.
	 */
	private function quote_key(int $product_id, int $variation_id, int $quantity, array $selection): string {
		return hash('sha256', CanonicalJson::encode([$product_id, $variation_id, $quantity, $selection]));
	}

	/**
	 * @param list<array<string,mixed>> $errors Errors.
	 */
	private function add_validation_notices(array $errors): void {
		$shown = 0;
		foreach ($errors as $error) {
			if ($shown >= 5) {
				break;
			}
			$label = trim((string) ($error['label'] ?? ''));
			$message = '' !== $label
				? sprintf(
					/* translators: %s: option label. */
					__('Please check “%s”.', 'wooptionsfic'),
					$label
				)
				: __('Please check your product options.', 'wooptionsfic');
			wc_add_notice($message, 'error');
			++$shown;
		}
	}
}
