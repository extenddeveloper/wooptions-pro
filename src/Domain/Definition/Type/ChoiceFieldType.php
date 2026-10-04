<?php
/**
 * Choice field type.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Domain\Definition\Type;

use WooptionsFic\Domain\Support\Uuid;

final class ChoiceFieldType extends AbstractFieldType {
	public function __construct(
		private readonly string $type_key,
		private readonly bool $multiple = false
	) {
	}

	public function key(): string {
		return $this->type_key;
	}

	public function normalize_definition(array $definition): array {
		$normalized = $this->base_definition($definition);
		$choices    = [];

		foreach ((array) ($definition['choices'] ?? []) as $choice) {
			if (! is_array($choice)) {
				continue;
			}
			$uuid = (string) ($choice['uuid'] ?? '');
			if (! Uuid::is_valid($uuid)) {
				$uuid = Uuid::v4();
			}
			$image_id  = max(0, (int) ($choice['imageId'] ?? 0));
			$image_url = $this->safe_asset_url((string) ($choice['imageUrl'] ?? ''));
			if ($image_id > 0 && function_exists('wp_get_attachment_image_url')) {
				$resolved_image = wp_get_attachment_image_url($image_id, 'thumbnail');
				if (is_string($resolved_image) && '' !== $resolved_image) {
					$image_url = esc_url_raw($resolved_image);
				}
			}

			$is_product_type = 'product' === $this->type_key;
			$choice_entry = [
				'uuid'              => strtolower($uuid),
				'label'             => self::plain_text((string) ($choice['label'] ?? 'Choice'), 200),
				'description'       => self::plain_text((string) ($choice['description'] ?? ''), 500),
				'adminLabel'        => self::plain_text((string) ($choice['adminLabel'] ?? ''), 200),
				'color'             => $this->safe_color((string) ($choice['color'] ?? '')),
				'imageId'           => $image_id,
				'imageUrl'          => $image_url,
				'disabled'          => ! empty($choice['disabled']),
				'default'           => ! empty($choice['default']),
				'pricing'           => self::pricing(is_array($choice['pricing'] ?? null) ? $choice['pricing'] : []),
				'quantityEnabled'   => ! empty($choice['quantityEnabled']),
				'linkedProductId'   => max(0, (int) ($choice['linkedProductId'] ?? 0)),
				'linkedVariationId' => max(0, (int) ($choice['linkedVariationId'] ?? 0)),
				'linkedQuantity'    => max(1, min(100, (int) ($choice['linkedQuantity'] ?? 1))),
				'preview'           => is_array($choice['preview'] ?? null) ? $choice['preview'] : [],
			];
			if ('font' === $this->type_key) {
				$choice_entry['fontFamily']   = self::plain_text((string) ($choice['fontFamily'] ?? ''), 120);
				$choice_entry['fontCategory'] = self::plain_text((string) ($choice['fontCategory'] ?? ''), 60);
				$choice_entry['fontSource']   = in_array($choice['fontSource'] ?? '', ['google', 'system', 'custom'], true) ? $choice['fontSource'] : 'google';
				if ('' === $choice_entry['fontFamily']) {
					$choice_entry['fontFamily'] = $choice_entry['label'];
				}
			}
			if ($is_product_type) {
				$choice_entry['productId']           = max(0, (int) ($choice['productId'] ?? ($choice['linkedProductId'] ?? 0)));
				if ($choice_entry['productId'] > 0 && (empty($choice_entry['label']) || 'Choice' === $choice_entry['label']) && function_exists('wc_get_product')) {
					$wc_prod = wc_get_product($choice_entry['productId']);
					if ($wc_prod) {
						$choice_entry['label'] = wp_strip_all_tags($wc_prod->get_name());
					}
				}
				$choice_entry['isVariable']          = ! empty($choice['isVariable']) || ! empty($choice['productInfo']['isVariable']);
				$choice_entry['selectedVariationIds'] = array_values(
					array_unique(
						array_filter(
							array_map('absint', (array) ($choice['selectedVariationIds'] ?? []))
						)
					)
				);
				$raw_info = is_array($choice['productInfo'] ?? null) ? $choice['productInfo'] : [];
				$norm_variations = [];
				if (! empty($raw_info['variations']) && is_array($raw_info['variations'])) {
					foreach ($raw_info['variations'] as $v) {
						if (! is_array($v)) {
							continue;
						}
						$norm_variations[] = [
							'id'           => (int) ($v['id'] ?? 0),
							'label'        => self::plain_text((string) ($v['label'] ?? ''), 200),
							'price'        => self::plain_text((string) ($v['price'] ?? ''), 50),
							'regularPrice' => self::plain_text((string) ($v['regularPrice'] ?? ''), 50),
							'salePrice'    => self::plain_text((string) ($v['salePrice'] ?? ''), 50),
							'image'        => esc_url_raw((string) ($v['image'] ?? '')),
							'attributes'   => is_array($v['attributes'] ?? null) ? $v['attributes'] : [],
						];
					}
				}
				if (empty($norm_variations) && $choice_entry['productId'] > 0 && function_exists('wc_get_product')) {
					$wc_p = wc_get_product($choice_entry['productId']);
					if ($wc_p && $wc_p->is_type('variable') && method_exists($wc_p, 'get_children')) {
						$choice_entry['isVariable'] = true;
						foreach (array_slice($wc_p->get_children(), 0, 50) as $var_id) {
							$var = wc_get_product((int) $var_id);
							if (! $var) {
								continue;
							}
							$var_attrs = [];
							if (method_exists($var, 'get_variation_attributes')) {
								foreach ($var->get_variation_attributes() as $attr_key => $attr_val) {
									$var_attrs[wc_attribute_label(str_replace('attribute_', '', $attr_key))] = $attr_val;
								}
							}
							$var_img = get_the_post_thumbnail_url((int) $var_id, 'thumbnail');
							$var_label = $var->get_name();
							if ($var_label === $wc_p->get_name() && ! empty($var_attrs)) {
								$var_label = implode(', ', array_values($var_attrs));
							}
							$norm_variations[] = [
								'id'           => (int) $var_id,
								'label'        => wp_strip_all_tags((string) $var_label),
								'price'        => (string) $var->get_price(),
								'regularPrice' => (string) $var->get_regular_price(),
								'salePrice'    => (string) $var->get_sale_price(),
								'image'        => $var_img ? esc_url_raw($var_img) : '',
								'attributes'   => $var_attrs,
							];
						}
					}
				}
				$choice_entry['productInfo'] = [
					'price'        => self::plain_text((string) ($raw_info['price'] ?? ''), 50),
					'regularPrice' => self::plain_text((string) ($raw_info['regularPrice'] ?? ''), 50),
					'salePrice'    => self::plain_text((string) ($raw_info['salePrice'] ?? ''), 50),
					'image'        => esc_url_raw((string) ($raw_info['image'] ?? '')),
					'isVariable'   => ! empty($raw_info['isVariable']) || ! empty($choice_entry['isVariable']),
					'variations'   => $norm_variations,
				];
				if ($choice_entry['productId'] > 0 && empty($choice_entry['linkedProductId'])) {
					$choice_entry['linkedProductId'] = $choice_entry['productId'];
				}
				$prod_price = (string) ($choice_entry['productInfo']['salePrice'] ?: ($choice_entry['productInfo']['price'] ?: ''));
				if ('' === $prod_price && $choice_entry['productId'] > 0 && function_exists('wc_get_product')) {
					$wc_p = wc_get_product($choice_entry['productId']);
					if ($wc_p) {
						$prod_price = (string) $wc_p->get_price();
						if ('' === $prod_price && $wc_p->is_type('variable') && method_exists($wc_p, 'get_variation_price')) {
							$prod_price = (string) $wc_p->get_variation_price('min');
						}
						$choice_entry['productInfo']['price'] = $prod_price;
					}
				}
				if ('' === $prod_price && ! empty($norm_variations)) {
					foreach ($norm_variations as $v) {
						$vp = (string) (((isset($v['salePrice']) && '' !== (string) $v['salePrice']) ? $v['salePrice'] : ($v['price'] ?? '')) ?? '');
						if ('' !== $vp) {
							$prod_price = $vp;
							$choice_entry['productInfo']['price'] = $prod_price;
							break;
						}
					}
				}
				if ('' !== $prod_price && is_numeric($prod_price) && ('none' === ($choice_entry['pricing']['strategy'] ?? 'none') || '0' === ($choice_entry['pricing']['amount'] ?? '0'))) {
					$choice_entry['pricing']['strategy'] = 'fixed';
					$choice_entry['pricing']['amount']   = $prod_price;
				}
			}
			$choices[] = $choice_entry;
		}

		$is_multiple = ! empty($definition['multiple']) || $this->multiple;

		$normalized['choices']            = $choices;
		$normalized['multiple']           = $is_multiple;
		$normalized['minChoices']         = max(0, (int) ($definition['minChoices'] ?? 0));
		$normalized['maxChoices']         = max(0, (int) ($definition['maxChoices'] ?? 0));
		$normalized['updateProductImage'] = 'image_swatch' === $this->type_key && ! empty($definition['updateProductImage']);
		$supports_choice_dimensions       = ! in_array($this->type_key, ['radio', 'checkbox_group', 'select', 'font'], true);
		$normalized['choiceWidth']        = $supports_choice_dimensions ? self::plain_text((string) ($definition['choiceWidth'] ?? ''), 20) : '';
		$normalized['choiceHeight']       = $supports_choice_dimensions ? self::plain_text((string) ($definition['choiceHeight'] ?? ''), 20) : '';
		$normalized['choiceBorderRadius'] = $supports_choice_dimensions ? self::plain_text((string) ($definition['choiceBorderRadius'] ?? ''), 20) : '';
		$normalized['enableQuantity']     = ! in_array($this->type_key, ['segmented', 'radio', 'checkbox_group', 'font', 'select'], true) && ! empty($definition['enableQuantity']);
		$normalized['minQuantity']        = max(1, (int) ($definition['minQuantity'] ?? 1));
		$normalized['maxQuantity']        = max(0, (int) ($definition['maxQuantity'] ?? 100));
		$normalized['displayDirection']   = 'segmented' === $this->type_key && 'vertical' === (string) ($definition['displayDirection'] ?? '') ? 'vertical' : 'horizontal';
		$normalized['columns']            = in_array($this->type_key, ['radio', 'checkbox_group'], true) && in_array((string) ($definition['columns'] ?? ''), ['2', 'two'], true) ? 'two' : 'one';
		$normalized['imageStyle']         = $this->normalize_image_style((string) ($definition['imageStyle'] ?? ''));
		if ('product' === $this->type_key) {
			$normalized['mergeVariationProducts'] = ! empty($definition['mergeVariationProducts']);
		}
		if ('font' === $this->type_key) {
			$applied = [];
			foreach ((array) ($definition['appliedFields'] ?? []) as $field_id) {
				$fid = strtolower(trim((string) $field_id));
				if ('' !== $fid && preg_match('/^[a-z0-9_-]+$/i', $fid)) {
					$applied[] = $fid;
				}
			}
			$normalized['appliedFields'] = array_values(array_unique($applied));
		}
		return $normalized;
	}

	public function normalize_value(mixed $value, array $definition): mixed {
		$allowed     = array_column((array) ($definition['choices'] ?? []), 'uuid');
		$is_multiple = ! empty($definition['multiple']) || $this->multiple;

		if ($is_multiple) {
			$raw_items  = is_array($value) ? $value : ('' === (string) $value ? [] : [$value]);
			$normalized = [];
			foreach ($raw_items as $item) {
				if (is_array($item) && isset($item['choice'])) {
					$uuid = (string) $item['choice'];
					if (in_array($uuid, $allowed, true)) {
						$normalized[] = $uuid;
					}
				} elseif (is_scalar($item)) {
					$uuid = (string) $item;
					if (in_array($uuid, $allowed, true)) {
						$normalized[] = $uuid;
					}
				}
			}
			return array_values(array_unique($normalized));
		}

		if (is_array($value)) {
			if (isset($value['choice'])) {
				$value = (string) $value['choice'];
			} elseif (! empty($value)) {
				$value = (string) reset($value);
			} else {
				$value = '';
			}
		}
		$value = is_scalar($value) ? (string) $value : '';
		return in_array($value, $allowed, true) ? $value : '';
	}

	public function validate(mixed $value, array $definition): array {
		$errors      = [];
		$is_multiple = ! empty($definition['multiple']) || $this->multiple;
		$selected    = $is_multiple ? (array) $value : ('' === (string) $value ? [] : [(string) $value]);
		$choices     = [];
		foreach ((array) ($definition['choices'] ?? []) as $choice) {
			$choices[(string) ($choice['uuid'] ?? '')] = $choice;
		}

		if (! empty($definition['required']) && [] === $selected) {
			$errors[] = ['code' => 'required', 'params' => []];
		}
		if ((int) ($definition['minChoices'] ?? 0) > count($selected)) {
			$errors[] = ['code' => 'too_few_choices', 'params' => ['minimum' => (int) $definition['minChoices']]];
		}
		if ((int) ($definition['maxChoices'] ?? 0) > 0 && (int) $definition['maxChoices'] < count($selected)) {
			$errors[] = ['code' => 'too_many_choices', 'params' => ['maximum' => (int) $definition['maxChoices']]];
		}

		foreach ($selected as $choice_uuid) {
			if (! isset($choices[$choice_uuid])) {
				$errors[] = ['code' => 'unknown_choice', 'params' => ['choice' => $choice_uuid]];
			} elseif (! empty($choices[$choice_uuid]['disabled'])) {
				$errors[] = ['code' => 'disabled_choice', 'params' => ['choice' => $choice_uuid]];
			}
		}
		return $errors;
	}

	public function format_value(mixed $value, array $definition, array $context = []): string {
		$is_multiple = ! empty($definition['multiple']) || $this->multiple;
		$selected    = $is_multiple ? (array) $value : ('' === (string) $value ? [] : [(string) $value]);
		$labels      = [];
		foreach ((array) ($definition['choices'] ?? []) as $choice) {
			$cuuid = (string) ($choice['uuid'] ?? '');
			if (in_array($cuuid, $selected, true)) {
				$lbl = trim((string) ($choice['label'] ?? ''));
				$pid = max(0, (int) ($choice['productId'] ?? ($choice['linkedProductId'] ?? 0)));
				if (('' === $lbl || 'Choice' === $lbl) && $pid > 0 && function_exists('wc_get_product')) {
					$wc_prod = wc_get_product($pid);
					if ($wc_prod) {
						$lbl = wp_strip_all_tags($wc_prod->get_name());
					}
				}
				if ('' === $lbl) {
					$lbl = trim((string) ($choice['adminLabel'] ?? ''));
				}
				if (! empty($definition['enableQuantity'])) {
					$qty = ! empty($context['choiceQuantities'][$cuuid]) ? max(1, (int) $context['choiceQuantities'][$cuuid]) : 1;
					$lbl = sprintf('%s Count: %d,', $lbl, $qty);
				}
				if ('' !== $lbl) {
					$labels[] = $lbl;
				}
			}
		}
		return implode(', ', $labels);
	}

	public function accepts_customer_value(): bool {
		return true;
	}

	private function safe_color(string $value): string {
		$value = strtoupper(trim($value));
		return 1 === preg_match('/\A#[0-9A-F]{6}\z/', $value) ? $value : '';
	}

	private function safe_asset_url(string $value): string {
		$value = trim($value);
		// Imported definitions may only retain same-site, root-relative assets.
		// The admin media picker persists an attachment ID, which is resolved late.
		return 1 === preg_match('#\A/(?!/)[^\s<>"\']+\z#', $value) ? $value : '';
	}

	private function normalize_image_style(string $value): string {
		// Radio, checkbox, select support circle vs normal.
		if (in_array($this->type_key, ['radio', 'checkbox_group', 'select'], true)) {
			return 'circle' === $value ? 'circle' : 'normal';
		}
		// Product, image swatch and color swatch support overlay display styles.
		if (in_array($this->type_key, ['product', 'image_swatch', 'color_swatch'], true)) {
			return in_array($value, ['overlay', 'only_image'], true) ? $value : 'default';
		}
		return 'normal';
	}
}
