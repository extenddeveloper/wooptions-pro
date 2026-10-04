<?php
/**
 * Deterministic price engine.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Domain\Pricing;

use RuntimeException;
use WooptionsFic\Domain\Pricing\Formula\Evaluator;
use WooptionsFic\Domain\Rule\RuleEngine;

final class PriceEngine
{
	public function __construct(
		private readonly RuleEngine $rules,
		private readonly Evaluator $formulas
	) {
	}

	/**
	 * @param array<string, mixed> $compiled Configuration.
	 * @param array<string, mixed> $values Normalized values.
	 * @param array<string, mixed> $context Price context.
	 * @return array<string, mixed>
	 */
	public function calculate(array $compiled, array $values, array $context): array
	{
		$currency = strtoupper((string) ($context['currency'] ?? 'USD'));
		$scale = max(0, min(6, (int) ($context['currencyScale'] ?? 2)));
		$base = Money::from_decimal((string) ($context['basePrice'] ?? '0'), $currency, $scale);
		$quantity = max(1, (int) ($context['quantity'] ?? 1));
		$states = $this->rules->resolve_field_states($compiled, $values, $context);
		$lines = [];
		$adjustment = Money::from_minor(0, $currency, $scale);
		$supplemental_adjustment = Money::from_minor(0, $currency, $scale);
		$override = null;
		$warnings = [];

		$formulas = [];
		$all_fields = (array) ($compiled['fields'] ?? []);
		$formula_variables = $this->resolve_formula_variables($all_fields, $values, $context);

		foreach ($all_fields as $field) {
			$uuid = (string) ($field['uuid'] ?? '');
			$state = $states[$uuid] ?? ['visible' => true, 'enabled' => true];
			if (empty($state['visible']) || empty($state['enabled'])) {
				continue;
			}

			if ('formula' === ($field['type'] ?? '')) {
				$expression = (string) ($field['expression'] ?? '0');
				try {
					$resolved = Formula\Evaluator::resolve_tokens($expression, $all_fields);
					$decimal = $this->formulas->evaluate(
						$resolved,
						[
							'base_price' => $base->to_decimal(),
							'product_price' => $base->to_decimal(),
							'quantity' => $quantity,
							'fields' => $formula_variables,
							'weight' => (string) ($context['weight'] ?? '0'),
							'width' => (string) ($context['width'] ?? '0'),
							'height' => (string) ($context['height'] ?? '0'),
							'length' => (string) ($context['length'] ?? '0'),
						],
						[]
					);
					$val_str = $decimal->to_string(false);
					$formula_variables[$uuid] = $val_str;
					if (!empty($field['label'])) {
						$formula_variables[(string) $field['label']] = $val_str;
						$formula_variables[strtolower((string) $field['label'])] = $val_str;
					}
					$formulas[$uuid] = [
						'value' => $val_str,
						'displayMode' => (string) ($field['displayMode'] ?? 'currency'),
						'decimalPlaces' => (int) ($field['decimalPlaces'] ?? 2),
						'prefix' => (string) ($field['prefix'] ?? ''),
						'suffix' => (string) ($field['suffix'] ?? ''),
						'currency' => $currency,
						'hideWhenZero' => !empty($field['hideWhenZero']),
					];

					// If formula field has pricing strategy configured, contribute to cart / product price
					$pricing_strat = (string) ($field['pricing']['strategy'] ?? 'none');
					$pricing_mode = (string) ($field['pricing']['mode'] ?? '');
					if ('formula' === $pricing_strat || (!empty($pricing_strat) && 'none' !== $pricing_strat && in_array($pricing_mode, ['adjustment', 'unit_price'], true))) {
						$money = Money::from_decimal($val_str, $currency, $scale);
						if ('unit_price' === $pricing_mode) {
							if (null !== $override) {
								throw new RuntimeException('wooptionsfic_multiple_price_overrides');
							}
							$override = $money;
							$delta = $money->subtract($base);
							$lines[] = $this->line(
								$field,
								'formula',
								$delta,
								['expression' => $expression, 'mode' => 'unit_price'],
								$val_str,
								false
							);
						} else {
							$line = $this->line($field, 'formula', $money, ['expression' => $expression], $val_str);
							$lines[] = $line;
							$line_money = Money::from_minor((int) $line['rounded']['minor'], $currency, $scale);
							$adjustment = $adjustment->add($line_money);
							$supplemental_adjustment = $supplemental_adjustment->add($line_money);
						}
					}
				} catch (\Throwable $e) {
					$formulas[$uuid] = [
						'value' => '0',
						'displayMode' => (string) ($field['displayMode'] ?? 'currency'),
						'decimalPlaces' => (int) ($field['decimalPlaces'] ?? 2),
						'prefix' => (string) ($field['prefix'] ?? ''),
						'suffix' => (string) ($field['suffix'] ?? ''),
						'currency' => $currency,
						'hideWhenZero' => !empty($field['hideWhenZero']),
						'error' => $e->getMessage(),
					];
				}
				continue;
			}

			$value = $values[$uuid] ?? null;
			$result = $this->field_contributions($field, $value, $base, $quantity, $values, $context, $currency, $scale, $formula_variables, $all_fields);
			foreach ($result['lines'] as $line) {
				$applies_to_adjustment = !isset($line['_applyToAdjustment']) || !empty($line['_applyToAdjustment']);
				unset($line['_applyToAdjustment']);
				$lines[] = $line;
				$line_money = Money::from_minor((int) $line['rounded']['minor'], $currency, $scale);
				$adjustment = $adjustment->add($line_money);
				if ($applies_to_adjustment) {
					$supplemental_adjustment = $supplemental_adjustment->add($line_money);
				}
			}
			if (isset($result['override'])) {
				if (null !== $override) {
					throw new RuntimeException('wooptionsfic_multiple_price_overrides');
				}
				$override = $result['override'];
			}
			$warnings = array_merge($warnings, $result['warnings']);
		}

		$unit = $override instanceof Money
			? $override->add($supplemental_adjustment)
			: $base->add($adjustment);
		if ($unit->minor() < 0 && empty($context['allowNegativeTotal'])) {
			$warnings[] = ['code' => 'negative_total_clamped', 'params' => []];
			$unit = Money::from_minor(0, $currency, $scale);
		}

		return [
			'base' => $base->to_array(),
			'contributions' => $lines,
			'formulas' => $formulas,
			'adjustment' => $adjustment->to_array(),
			'unitPrice' => $unit->to_array(),
			'quantity' => $quantity,
			'extendedTotal' => $unit->multiply_integer($quantity)->to_array(),
			'warnings' => $warnings,
			'revisionUuid' => (string) ($compiled['revisionUuid'] ?? ''),
			'revisionHash' => (string) ($compiled['contentHash'] ?? ''),
		];
	}

	/**
	 * @param array<string, mixed> $field Field.
	 * @param array<string, mixed> $values Values.
	 * @param array<string, mixed> $context Context.
	 * @return array{lines:list<array<string,mixed>>,override:?Money,warnings:list<array<string,mixed>>}
	 */
	private function field_contributions(
		array $field,
		mixed $value,
		Money $base,
		int $quantity,
		array $values,
		array $context,
		string $currency,
		int $scale,
		array $formula_variables = [],
		array $all_fields = []
	): array {
		$lines = [];
		$warnings = [];
		$override = null;
		$field_type = (string) ($field['type'] ?? '');
		$pricing = is_array($field['pricing'] ?? null) ? $field['pricing'] : ['strategy' => 'none'];
		$strategy = (string) ($pricing['strategy'] ?? 'none');

		if ('customer_defined_price' === $field_type && '' !== (string) $value) {
			$override = Money::from_decimal((string) $value, $currency, $scale);
			$lines[] = $this->line(
				$field,
				'customer_defined_price',
				$override->subtract($base),
				['entered' => (string) $value],
				$override->subtract($base)->to_decimal(),
				false
			);
		} elseif ('fixed' === $strategy && !$this->empty($value)) {
			$money = Money::from_decimal((string) ($pricing['amount'] ?? '0'), $currency, $scale);
			$lines[] = $this->line($field, $strategy, $money, [], $money->to_decimal());
		} elseif ('percentage' === $strategy && !$this->empty($value)) {
			$money = $base->percentage((string) ($pricing['percent'] ?? '0'));
			$lines[] = $this->line($field, $strategy, $money, ['base' => $base->to_decimal()], $money->to_decimal());
		} elseif ('per_character' === $strategy && is_string($value)) {
			$length = function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
			$unit = Money::from_decimal((string) ($pricing['amount'] ?? '0'), $currency, $scale);
			$money = $unit->multiply_integer($length);
			$lines[] = $this->line($field, $strategy, $money, ['characters' => $length], $money->to_decimal());
		} elseif ('per_unit' === $strategy && is_scalar($value) && '' !== (string) $value) {
			$decimal = Decimal::from_string((string) $value)
				->multiply(Decimal::from_string((string) ($pricing['amount'] ?? '0')));
			$money = Money::from_decimal($decimal->to_string(false), $currency, $scale);
			$lines[] = $this->line($field, $strategy, $money, ['units' => (string) $value], $decimal->to_string());
		} elseif ('setup' === $strategy && !$this->empty($value)) {
			$total = Decimal::from_string((string) ($pricing['amount'] ?? '0'));
			$per_unit = $total->divide(Decimal::from_int($quantity));
			$money = Money::from_decimal($per_unit->to_string(false), $currency, $scale);
			$lines[] = $this->line($field, $strategy, $money, ['cartQuantity' => $quantity], $per_unit->to_string());
			if ($money->multiply_integer($quantity)->minor() !== Money::from_decimal($total->to_string(false), $currency, $scale)->minor()) {
				$warnings[] = ['code' => 'setup_fee_rounding', 'params' => ['quantity' => $quantity]];
			}
		} elseif ('tiered' === $strategy && is_scalar($value) && '' !== (string) $value) {
			$amount = $this->tier_amount((string) $value, (array) ($pricing['tiers'] ?? []));
			$money = Money::from_decimal($amount, $currency, $scale);
			$lines[] = $this->line($field, $strategy, $money, ['value' => (string) $value], $amount);
		} elseif ('formula' === $strategy) {
			$expression = (string) ($pricing['expression'] ?? '0');
			$resolved = Formula\Evaluator::resolve_tokens($expression, $all_fields);
			$rows = 'repeater' === ($field['type'] ?? '')
				? array_values(
					array_map(
						static fn(mixed $row): array => is_array($row['values'] ?? null) ? $row['values'] : [],
						(array) $value
					)
				)
				: [];
			$decimal = $this->formulas->evaluate(
				$resolved,
				[
					'base_price' => $base->to_decimal(),
					'product_price' => $base->to_decimal(),
					'quantity' => $quantity,
					'fields' => !empty($formula_variables) ? $formula_variables : $values,
					'weight' => (string) ($context['weight'] ?? '0'),
					'width' => (string) ($context['width'] ?? '0'),
					'height' => (string) ($context['height'] ?? '0'),
					'length' => (string) ($context['length'] ?? '0'),
				],
				$rows
			);
			$money = Money::from_decimal($decimal->to_string(false), $currency, $scale);
			if ('unit_price' === ($pricing['mode'] ?? 'adjustment')) {
				$override = $money;
				$delta = $money->subtract($base);
				$lines[] = $this->line(
					$field,
					$strategy,
					$delta,
					['expression' => $expression, 'mode' => 'unit_price'],
					$decimal->to_string(),
					false
				);
			} else {
				$lines[] = $this->line($field, $strategy, $money, ['expression' => $expression], $decimal->to_string());
			}
		}

		if (isset($field['choices']) && is_array($field['choices'])) {
			$selected = is_array($value) ? array_values(array_map('strval', $value)) : ('' === (string) $value ? [] : [(string) $value]);
			$selected_labels = [];

			foreach ($field['choices'] as $choice) {
				$choice_uuid = (string) ($choice['uuid'] ?? '');
				if (!in_array($choice_uuid, $selected, true)) {
					continue;
				}

				$choice_label = trim((string) ($choice['label'] ?? ''));
				$choice_pricing = is_array($choice['pricing'] ?? null) ? $choice['pricing'] : [];
				$choice_strategy = (string) ($choice_pricing['strategy'] ?? 'none');
				// Always initialize so it is defined for the 'fixed' block below,
				// even when this choice belongs to a non-product field type.
				$selected_var_id = 0;

				if ('product' === $field_type) {
					$pid = (int) ($choice['productId'] ?? ($choice['linkedProductId'] ?? 0));
					if (('' === $choice_label || 'Choice' === $choice_label) && $pid > 0 && function_exists('wc_get_product')) {
						$wc_p = wc_get_product($pid);
						if ($wc_p) {
							$choice_label = wp_strip_all_tags($wc_p->get_name());
						}
					}
					if ('' === $choice_label) {
						$choice_label = __('Product', 'wooptionsfic');
					}
					$product_price = '';
					$selected_var_id = (int) ($context['productVariations'][$choice_uuid] ?? 0);
					if ($selected_var_id > 0 && function_exists('wc_get_product')) {
						$var_prod = wc_get_product($selected_var_id);
						if ($var_prod) {
							$product_price = (string) $var_prod->get_price();
							$var_attrs = method_exists($var_prod, 'get_variation_attributes') ? $var_prod->get_variation_attributes() : [];
							$clean_attrs = [];
							if (!empty($var_attrs)) {
								foreach ($var_attrs as $attr_k => $attr_v) {
									if ('' !== (string) $attr_v) {
										$attr_lbl = function_exists('wc_attribute_label') ? wc_attribute_label(str_replace('attribute_', '', (string) $attr_k)) : (string) $attr_k;
										$clean_attrs[] = $attr_lbl . ': ' . $attr_v;
									}
								}
							}
							if (!empty($clean_attrs)) {
								$choice_label .= ' (' . implode(', ', $clean_attrs) . ')';
							} else {
								$var_name = $var_prod->get_name();
								if ($var_name) {
									$choice_label .= ' (' . $var_name . ')';
								}
							}
						}
					}
					// Fallback to choice productInfo variations array if wc_get_product didn't return a price
					if ('' === $product_price && $selected_var_id > 0 && !empty($choice['productInfo']['variations']) && is_array($choice['productInfo']['variations'])) {
						foreach ($choice['productInfo']['variations'] as $v) {
							if ((int) ($v['id'] ?? 0) === $selected_var_id) {
								$product_price = (string) (((isset($v['salePrice']) && '' !== (string) $v['salePrice']) ? $v['salePrice'] : ($v['price'] ?? '')) ?? '');
								if (!empty($v['label'])) {
									$choice_label .= ' (' . $v['label'] . ')';
									$display_label = $this->choice_line_label($field, $choice_label);
								}
								break;
							}
						}
					}
					$pinfo = is_array($choice['productInfo'] ?? null) ? $choice['productInfo'] : [];
					if ('' === $product_price) {
						if (isset($pinfo['salePrice']) && '' !== (string) $pinfo['salePrice'] && is_numeric($pinfo['salePrice']) && (float) $pinfo['salePrice'] > 0) {
							$product_price = (string) $pinfo['salePrice'];
						} elseif (isset($choice_pricing['amount']) && '' !== (string) $choice_pricing['amount'] && is_numeric($choice_pricing['amount']) && (float) $choice_pricing['amount'] > 0) {
							$product_price = (string) $choice_pricing['amount'];
						} elseif (isset($pinfo['price']) && '' !== (string) $pinfo['price'] && is_numeric($pinfo['price']) && (float) $pinfo['price'] > 0) {
							$product_price = (string) $pinfo['price'];
						}
					}
					if ('' === $product_price) {
						$product_id = (int) ($choice['productId'] ?? ($choice['linkedProductId'] ?? 0));
						if ($product_id > 0 && function_exists('wc_get_product')) {
							$wc_prod = wc_get_product($product_id);
							if ($wc_prod) {
								$sale_p = (string) $wc_prod->get_sale_price();
								if ('' !== $sale_p && is_numeric($sale_p) && (float) $sale_p > 0) {
									$product_price = $sale_p;
								} else {
									$product_price = (string) $wc_prod->get_price();
									if ('' === $product_price && $wc_prod->is_type('variable') && method_exists($wc_prod, 'get_variation_price')) {
										$product_price = (string) $wc_prod->get_variation_price('min');
									}
								}
							}
						}
					}
					if ('' === $product_price) {
						if (!empty($pinfo['variations']) && is_array($pinfo['variations'])) {
							foreach ($pinfo['variations'] as $v) {
								$vp = (string) (((isset($v['salePrice']) && '' !== (string) $v['salePrice']) ? $v['salePrice'] : ($v['price'] ?? '')) ?? '');
								if ('' !== $vp) {
									$product_price = $vp;
									break;
								}
							}
						}
					}
					if ('' === $product_price) {
						$product_price = (string) ($choice_pricing['amount'] ?? '0');
					}

					if ('' !== $product_price && is_numeric($product_price)) {
						$choice_strategy = 'fixed';
						$choice_pricing['amount'] = $product_price;
					}
				}

				$qty_multiplier = 1;
				$qty_val = $context['choiceQuantities'][$choice_uuid] ?? null;
				if (!empty($field['enableQuantity'])) {
					$qty_multiplier = !empty($qty_val) ? max(1, (int) $qty_val) : 1;
				}

				$choice_display_label = $choice_label;
				if (!empty($field['enableQuantity'])) {
					$choice_display_label = sprintf('%s Count: %d,', $choice_label, $qty_multiplier);
				}

				$selected_labels[] = $choice_display_label;
				$display_label = $this->choice_line_label($field, $choice_display_label);

				if ('fixed' === $choice_strategy) {
					$raw_amount = (string) ($choice_pricing['amount'] ?? '0');
					// Guard against non-numeric config values that would crash Decimal::from_string().
					if ('' === $raw_amount || !is_numeric($raw_amount)) {
						$raw_amount = '0';
					}
					$money = Money::from_decimal($raw_amount, $currency, $scale);
					// Use multiply_integer() — Money::multiply() does not exist on this class.
					if ($qty_multiplier > 1) {
						$money = $money->multiply_integer($qty_multiplier);
					}
					$line_meta = ['choiceUuid' => $choice_uuid, 'choiceLabel' => $choice_display_label];
					if ($selected_var_id > 0) {
						$line_meta['variationId'] = $selected_var_id;
					}
					$line = $this->line($field, 'choice_fixed', $money, $line_meta, $money->to_decimal());
					$line['label'] = $display_label;
					$lines[] = $line;
				} elseif ('percentage' === $choice_strategy) {
					$money = $base->percentage((string) ($choice_pricing['percent'] ?? '0'));
					if ($qty_multiplier > 1) {
						$money = $money->multiply_integer($qty_multiplier);
					}
					$line = $this->line($field, 'choice_percentage', $money, ['choiceUuid' => $choice_uuid, 'choiceLabel' => $choice_display_label], $money->to_decimal());
					$line['label'] = $display_label;
					$lines[] = $line;
				} elseif ('none' === $strategy || 'none' === $choice_strategy) {
					// Itemized breakdown should still identify selected dropdown/radio choices,
					// even when that choice does not alter the price.
					$money = Money::from_minor(0, $currency, $scale);
					$line = $this->line($field, 'choice_none', $money, ['choiceUuid' => $choice_uuid, 'choiceLabel' => $choice_display_label], '0');
					$line['label'] = $display_label;
					$lines[] = $line;
				}
			}

			// A field-level adjustment on a dropdown or radio group should name the
			// selected choice instead of showing an ambiguous field-only row.
			if ([] !== $selected_labels && 'none' !== $strategy && 'product' !== $field_type) {
				$selection_label = (string) ($field['label'] ?? '');
				if ('' !== $selection_label) {
					$selection_label .= ': ';
				}
				$selection_label .= implode(', ', $selected_labels);
				foreach ($lines as &$line) {
					if (
						(string) ($line['sourceUuid'] ?? '') === (string) ($field['uuid'] ?? '')
						&& !str_starts_with((string) ($line['strategy'] ?? ''), 'choice_')
					) {
						$line['label'] = $selection_label;
					}
				}
				unset($line);
			}
		}

		if ('repeater' === $field_type && is_array($value)) {
			$repeatable = ! isset($field['repeatable']) || ! empty($field['repeatable']);
			if (! $repeatable) {
				$first_row = reset($value);
				$row_values = is_array($first_row['values'] ?? null) ? $first_row['values'] : (array) $first_row;
				foreach ((array) ($field['children'] ?? []) as $child) {
					$child_uuid = (string) ($child['uuid'] ?? '');
					$child_result = $this->field_contributions(
						$child,
						$row_values[$child_uuid] ?? null,
						$base,
						$quantity,
						$values,
						$context,
						$currency,
						$scale
					);
					foreach ($child_result['lines'] as $child_line) {
						if (! empty($field['label'])) {
							$child_line['label'] = $field['label'] . ' - ' . $child_line['label'];
						}
						$lines[] = $child_line;
					}
				}
			} else {
				$row_price_type   = (string) ($field['repeatPriceType'] ?? ($field['pricing']['strategy'] ?? 'none'));
				$repeat_label_tpl = (string) ($field['repeatLabel'] ?? ($field['rowTitle'] ?? 'Item {n}'));

				foreach ($value as $row_index => $row) {
					$item_label = str_replace(['{n}', '{index}'], (string) ($row_index + 1), $repeat_label_tpl);

					// If repeater has row price (fixed or percentage)
					if (in_array($row_price_type, ['fixed', 'percentage'], true)) {
						$raw_price = (string) ($field['repeatRegularPrice'] ?? '');
						if (isset($field['repeatSalePrice']) && '' !== (string) $field['repeatSalePrice']) {
							$raw_price = (string) $field['repeatSalePrice'];
						}
						if ('' !== $raw_price && is_numeric($raw_price) && (float) $raw_price > 0) {
							if ('percentage' === $row_price_type) {
								$ratio = Decimal::from_string($raw_price)->divide(Decimal::from_int(100), 8);
								$unrounded_dec = $base->to_decimal()->multiply($ratio, 8);
								$row_money = Money::from_decimal($unrounded_dec->to_string(false), $currency, $scale);
							} else {
								$row_money = Money::from_decimal($raw_price, $currency, $scale);
							}
							$row_line = $this->line(
								$field,
								$row_price_type,
								$row_money,
								['row' => $row_index + 1, 'price' => $raw_price],
								$row_money->to_decimal()
							);
							$row_line['label'] = (string) ($field['label'] ?? '') . ' (' . $item_label . ')';
							$row_line['sourceUuid'] = $field['uuid'] . ':row:' . ($row_index + 1);
							$lines[] = $row_line;
						}
					}

					$row_values = is_array($row['values'] ?? null) ? $row['values'] : [];
					$item_prefix = '' !== (string) ($field['label'] ?? '') ? $field['label'] . ' (' . $item_label . ')' : $item_label;
					foreach ((array) ($field['children'] ?? []) as $child) {
						$child_uuid = (string) ($child['uuid'] ?? '');
						$child_result = $this->field_contributions(
							$child,
							$row_values[$child_uuid] ?? null,
							$base,
							$quantity,
							$values,
							$context,
							$currency,
							$scale
						);
						foreach ($child_result['lines'] as $child_line) {
							$child_line['label'] = $item_prefix . ' - ' . $child_line['label'];
							$child_line['sourceUuid'] = $child_uuid . ':row:' . ($row_index + 1);
							$lines[] = $child_line;
						}
					}
				}
			}
		}

		return ['lines' => $lines, 'override' => $override, 'warnings' => $warnings];
	}

	private function choice_line_label(array $field, string $choice_label): string
	{
		$field_label = trim((string) ($field['label'] ?? ''));
		$choice_label = trim($choice_label);
		if ('' === $field_label) {
			return $choice_label;
		}
		if ('' === $choice_label) {
			return $field_label;
		}
		return $field_label . ': ' . $choice_label;
	}

	/**
	 * @param array<string, mixed> $field Field.
	 * @param array<string, mixed> $operands Operands.
	 * @return array<string, mixed>
	 */
	private function line(
		array $field,
		string $strategy,
		Money $money,
		array $operands,
		string $unrounded,
		bool $apply_to_adjustment = true
	): array {
		return [
			'sourceUuid' => (string) ($field['uuid'] ?? ''),
			'label' => (string) ($field['label'] ?? ''),
			'strategy' => $strategy,
			'operands' => $operands,
			'unrounded' => $unrounded,
			'rounded' => $money->to_array(),
			'_applyToAdjustment' => $apply_to_adjustment,
		];
	}

	/**
	 * @param list<array<string,mixed>> $tiers Tiers.
	 */
	private function tier_amount(string $value, array $tiers): string
	{
		$number = Decimal::from_string($value);
		$amount = '0';
		usort(
			$tiers,
			static fn(array $a, array $b): int => Decimal::from_string((string) ($a['min'] ?? '0'))
				->compare(Decimal::from_string((string) ($b['min'] ?? '0')))
		);
		foreach ($tiers as $tier) {
			if ($number->compare(Decimal::from_string((string) ($tier['min'] ?? '0'))) >= 0) {
				$amount = (string) ($tier['amount'] ?? '0');
			}
		}
		return $amount;
	}

	private function empty(mixed $value): bool
	{
		return null === $value || '' === $value || [] === $value || false === $value;
	}

	/**
	 * Calculates the actual numeric price of any choice option.
	 *
	 * Handles fixed amount, percentage (calculated from base price), setup fee,
	 * product choices (selected variation, linked product, productInfo sale/regular price),
	 * direct choice price attributes, and inherited field-level pricing.
	 *
	 * @param array<string, mixed> $choice Choice definition.
	 * @param array<string, mixed> $field Parent field definition.
	 * @param float|string $base_price Base product price.
	 * @param array<string, mixed> $context Execution context.
	 * @return float Option unit price.
	 */
	public static function calculate_choice_price(array $choice, array $field, float|string $base_price = 0.0, array $context = []): float
	{
		$base_float = (float) $base_price;
		$type = (string) ($field['type'] ?? '');
		$pricing = is_array($choice['pricing'] ?? null) ? $choice['pricing'] : [];
		$strategy = (string) ($pricing['strategy'] ?? 'none');

		// 1. Product choices
		if ('product' === $type) {
			$c_uuid = (string) ($choice['uuid'] ?? '');
			$selected_var_id = (int) ($context['productVariations'][$c_uuid] ?? 0);
			if ($selected_var_id > 0) {
				if (function_exists('wc_get_product')) {
					$var_prod = wc_get_product($selected_var_id);
					if ($var_prod && is_numeric($var_prod->get_price())) {
						return (float) $var_prod->get_price();
					}
				}
				if (!empty($choice['productInfo']['variations']) && is_array($choice['productInfo']['variations'])) {
					foreach ($choice['productInfo']['variations'] as $v) {
						if ((int) ($v['id'] ?? 0) === $selected_var_id) {
							$vp = (string) (((isset($v['salePrice']) && '' !== (string) $v['salePrice']) ? $v['salePrice'] : ($v['price'] ?? '')) ?? '');
							if ('' !== $vp && is_numeric($vp)) {
								return (float) $vp;
							}
						}
					}
				}
			}
			$pinfo = is_array($choice['productInfo'] ?? null) ? $choice['productInfo'] : [];
			if (isset($pinfo['salePrice']) && '' !== (string) $pinfo['salePrice'] && is_numeric($pinfo['salePrice']) && (float) $pinfo['salePrice'] > 0) {
				return (float) $pinfo['salePrice'];
			}
			if (isset($pricing['amount']) && '' !== (string) $pricing['amount'] && is_numeric($pricing['amount']) && (float) $pricing['amount'] > 0) {
				return (float) $pricing['amount'];
			}
			if (isset($pinfo['price']) && '' !== (string) $pinfo['price'] && is_numeric($pinfo['price']) && (float) $pinfo['price'] > 0) {
				return (float) $pinfo['price'];
			}

			$pid = (int) ($choice['productId'] ?? ($choice['linkedProductId'] ?? 0));
			if ($pid > 0 && function_exists('wc_get_product')) {
				$wc_p = wc_get_product($pid);
				if ($wc_p) {
					$sale_p = (string) $wc_p->get_sale_price();
					if ('' !== $sale_p && is_numeric($sale_p) && (float) $sale_p > 0) {
						return (float) $sale_p;
					}
					$p = (string) $wc_p->get_price();
					if ('' === $p && $wc_p->is_type('variable') && method_exists($wc_p, 'get_variation_price')) {
						$p = (string) $wc_p->get_variation_price('min');
					}
					if ('' !== $p && is_numeric($p)) {
						return (float) $p;
					}
				}
			}
			if (!empty($pinfo['variations']) && is_array($pinfo['variations'])) {
				foreach ($pinfo['variations'] as $v) {
					$vp = (string) (((isset($v['salePrice']) && '' !== (string) $v['salePrice']) ? $v['salePrice'] : ($v['price'] ?? '')) ?? '');
					if ('' !== $vp && is_numeric($vp)) {
						return (float) $vp;
					}
				}
			}
		}

		// 2. Choice-level explicit pricing
		if ('percentage' === $strategy && isset($pricing['percent']) && is_numeric($pricing['percent'])) {
			return ($base_float * (float) $pricing['percent']) / 100.0;
		}
		if (('fixed' === $strategy || 'setup' === $strategy) && isset($pricing['amount']) && is_numeric($pricing['amount'])) {
			return (float) $pricing['amount'];
		}
		if (isset($pricing['amount']) && is_numeric($pricing['amount']) && (float) $pricing['amount'] != 0.0) {
			return (float) $pricing['amount'];
		}
		if (isset($pricing['percent']) && is_numeric($pricing['percent']) && (float) $pricing['percent'] != 0.0) {
			return ($base_float * (float) $pricing['percent']) / 100.0;
		}

		// 3. Direct choice price properties
		if (isset($choice['price']) && is_numeric($choice['price'])) {
			return (float) $choice['price'];
		}
		if (isset($choice['salePrice']) && is_numeric($choice['salePrice'])) {
			return (float) $choice['salePrice'];
		}
		if (isset($choice['regularPrice']) && is_numeric($choice['regularPrice'])) {
			return (float) $choice['regularPrice'];
		}
		if (isset($choice['amount']) && is_numeric($choice['amount'])) {
			return (float) $choice['amount'];
		}

		// 4. Numeric value property
		if (isset($choice['value']) && is_numeric($choice['value']) && '' !== trim((string) $choice['value'])) {
			return (float) $choice['value'];
		}

		// 5. Choice label contains a price or number (e.g. "$25", "Option 2 ($25.00)")
		$c_lbl = trim((string) ($choice['label'] ?? ($choice['title'] ?? ($choice['adminLabel'] ?? ''))));
		if ('' !== $c_lbl) {
			if (is_numeric($c_lbl)) {
				return (float) $c_lbl;
			}
			if (preg_match('/\(\s*[$€£¥]?\s*([+-]?\d+(?:\.\d+)?)\s*\)/', $c_lbl, $m)) {
				return (float) $m[1];
			}
			if (preg_match('/^[+$€£¥]\s*([+-]?\d+(?:\.\d+)?)/', $c_lbl, $m)) {
				return (float) $m[1];
			}
		}

		// 6. Inherited field-level pricing if choice has no extra adjustment
		$field_pricing = is_array($field['pricing'] ?? null) ? $field['pricing'] : [];
		$field_strategy = (string) ($field_pricing['strategy'] ?? 'none');
		if ('fixed' === $field_strategy && isset($field_pricing['amount']) && is_numeric($field_pricing['amount'])) {
			return (float) $field_pricing['amount'];
		}
		if ('percentage' === $field_strategy && isset($field_pricing['percent']) && is_numeric($field_pricing['percent'])) {
			return ($base_float * (float) $field_pricing['percent']) / 100.0;
		}

		return 0.0;
	}

	/**
	 * Resolves formula variables including base price, field values, choice options, and aggregate properties.
	 *
	 * @param list<array<string, mixed>> $all_fields All field definitions.
	 * @param array<string, mixed> $values Current submitted or selected field values.
	 * @param array<string, mixed> $context Execution context (quantities, variations, basePrice).
	 * @return array<string, string> Map of field and choice property tokens to resolved numeric/string values.
	 */
	public static function resolve_formula_variables(array $all_fields, array $values, array $context): array
	{
		$resolved = [];
		$to_slug = static fn(string $s): string => (string) preg_replace('/\s+/', '_', trim($s));

		// Base product price
		$base_price = (string) ($context['basePrice'] ?? ($context['productPrice'] ?? '0'));
		if ('0' === $base_price && !empty($context['productId']) && function_exists('wc_get_product')) {
			$wc_prod = wc_get_product((int) $context['productId']);
			if ($wc_prod && is_numeric($wc_prod->get_price())) {
				$base_price = (string) $wc_prod->get_price();
			}
		}
		$resolved['base_price'] = $base_price;
		$resolved['product_price'] = $base_price;
		$resolved['__base_price__'] = $base_price;
		$resolved['productprice'] = $base_price;
		$resolved['baseprice'] = $base_price;

		// Quantity & dimension variables
		$qty_val = (string) ($context['quantity'] ?? 1);
		$resolved['quantity'] = $qty_val;
		$resolved['cart_quantity'] = $qty_val;
		$resolved['cartquantity'] = $qty_val;
		$resolved['weight'] = (string) ($context['weight'] ?? '0');
		$resolved['width'] = (string) ($context['width'] ?? '0');
		$resolved['height'] = (string) ($context['height'] ?? '0');
		$resolved['length'] = (string) ($context['length'] ?? '0');

		foreach ($all_fields as $field) {
			if (!is_array($field)) {
				continue;
			}
			$uuid = (string) ($field['uuid'] ?? '');
			$label = trim((string) ($field['label'] ?? ''));
			$name = trim((string) ($field['name'] ?? ''));
			$type = (string) ($field['type'] ?? '');
			$val = $values[$uuid] ?? null;

			// All alias keys for this field (e.g. Button_Field, Button Field, segmented, etc.)
			$f_slug = '' !== $label ? $to_slug($label) : $to_slug($type);
			$field_aliases = array_filter(array_unique([
				$uuid,
				strtolower($uuid),
				$label,
				strtolower($label),
				$f_slug,
				strtolower($f_slug),
				str_replace('-', '_', $f_slug),
				strtolower(str_replace('-', '_', $f_slug)),
				str_replace('_', '-', $f_slug),
				strtolower(str_replace('_', '-', $f_slug)),
				preg_replace('/[^a-z0-9]/', '', strtolower($label)),
				$name,
				strtolower($name),
				$type,
				strtolower($type),
			]));

			$field_num = '0';
			$field_props = [];

			if (in_array($type, ['number', 'range', 'customer_defined_price'], true)) {
				if (is_numeric($val) && '' !== (string) $val) {
					$field_num = (string) $val;
				} elseif (isset($field['default']) && is_numeric($field['default']) && '' !== (string) $field['default']) {
					$field_num = (string) $field['default'];
				} else {
					$field_num = '0';
				}
				$field_props['value'] = $field_num;
			} elseif (in_array($type, ['checkbox', 'toggle', 'switch'], true)) {
				$is_checked = !empty($val) || (null === $val && !empty($field['default']));
				if ($is_checked) {
					$amount = $field['pricing']['amount'] ?? null;
					$field_num = (is_numeric($amount) && (float) $amount != 0) ? (string) $amount : '1';
				} else {
					$field_num = '0';
				}
				$field_props['checked'] = $field_num;
				$field_props['selected'] = $field_num;
				$field_props['is-checked'] = $is_checked ? '1' : '0';
				$field_props['is_checked'] = $is_checked ? '1' : '0';
				$field_props['formula-value'] = $field_num;
				$field_props['formula_value'] = $field_num;
				$field_props['qty'] = $is_checked ? '1' : '0';
				$field_props['quantity'] = $is_checked ? '1' : '0';
				$field_props['value'] = $field_num;
			} elseif (in_array($type, ['text', 'textarea', 'email', 'url', 'tel'], true)) {
				$str_val = is_scalar($val) ? (string) $val : (isset($field['default']) && is_scalar($field['default']) ? (string) $field['default'] : '');
				$char_count = function_exists('mb_strlen') ? mb_strlen($str_val) : strlen($str_val);
				$word_count = str_word_count($str_val);
				if (is_numeric($str_val) && '' !== trim($str_val)) {
					$field_num = trim($str_val);
				} elseif (preg_match('/^\s*([+-]?\d+(?:\.\d+)?)/', trim($str_val), $m)) {
					$field_num = $m[1];
				} else {
					$field_num = (string) $char_count;
				}
				$field_props['char-count'] = (string) $char_count;
				$field_props['char_count'] = (string) $char_count;
				$field_props['word-count'] = (string) $word_count;
				$field_props['word_count'] = (string) $word_count;
				$field_props['value'] = $str_val;
			} elseif (in_array($type, ['date', 'datetime', 'date_range'], true)) {
				$date_str = '';
				if (is_string($val)) {
					$date_str = $val;
				} elseif (is_array($val)) {
					$date_str = (string) ($val['start'] ?? reset($val) ?? '');
				}
				$ts = !empty($date_str) ? strtotime($date_str) : null;
				if ($ts && $ts > 0) {
					$days_diff = (int) floor(($ts - strtotime('today')) / 86400);
					$field_props['days-from-today'] = (string) $days_diff;
					$field_props['days_from_today'] = (string) $days_diff;
					$field_props['year'] = (string) date('Y', $ts);
					$field_props['month'] = (string) (int) date('m', $ts);
					$field_props['day'] = (string) (int) date('d', $ts);
					$field_props['weekday'] = (string) (int) date('N', $ts);
					$field_num = (string) $days_diff;
				} else {
					$field_props['days-from-today'] = '0';
					$field_props['days_from_today'] = '0';
					$field_props['year'] = (string) date('Y');
					$field_props['month'] = (string) (int) date('m');
					$field_props['day'] = (string) (int) date('d');
					$field_props['weekday'] = (string) (int) date('N');
				}
				$field_props['value'] = $date_str;
			}

			// Choice field handling (select, radio, segmented, checkbox_group, button, color_swatch, image_swatch, product, font)
			$choices = (array) ($field['choices'] ?? ($field['options'] ?? []));
			if (!empty($choices)) {
				$selected_uuids = is_array($val)
					? array_values(array_map('strval', $val))
					: ('' === (string) $val || null === $val ? [] : [(string) $val]);

				// Check defaults only if field was not submitted in values or is null
				if ([] === $selected_uuids && (!array_key_exists($uuid, $values) || null === $val)) {
					foreach ($choices as $choice) {
						if (!empty($choice['default'])) {
							$selected_uuids[] = (string) ($choice['uuid'] ?? '');
						}
					}
				}

				$selected_uuids_lower = array_map('strtolower', $selected_uuids);

				$total_num = 0.0;
				$selected_count = 0;
				$selected_formulas = [];
				$total_qty = 0;

				foreach ($choices as $ci => $choice) {
					$c_uuid = (string) ($choice['uuid'] ?? '');
					$c_val = (string) ($choice['value'] ?? '');
					$c_lbl = trim((string) ($choice['label'] ?? ($choice['title'] ?? ($choice['productTitle'] ?? ($choice['adminLabel'] ?? ($choice['value'] ?? ('Option ' . ($ci + 1))))))));

					$is_selected = in_array($c_uuid, $selected_uuids, true)
						|| in_array(strtolower($c_uuid), $selected_uuids_lower, true)
						|| in_array($c_val, $selected_uuids, true)
						|| ('' !== $c_lbl && in_array(strtolower($c_lbl), $selected_uuids_lower, true));

					// Quantity multiplier
					$qty_mult = 1;
					if (!empty($field['enableQuantity']) && !empty($context['choiceQuantities'][$c_uuid])) {
						$qty_mult = max(1, (int) $context['choiceQuantities'][$c_uuid]);
					}

					// Choice price calculation
					$c_num = self::calculate_choice_price($choice, $field, $base_price, $context);

					if ($is_selected) {
						++$selected_count;
						$total_num += ($c_num * $qty_mult);
						$selected_formulas[] = ($c_num * $qty_mult);
						$total_qty += $qty_mult;
					}

					// Choice properties
					$c_price = (string) $c_num;
					$c_formula = $is_selected ? (string) ($c_num * $qty_mult) : '0';
					$c_qty = $is_selected ? (string) $qty_mult : '0';
					// .checked / .selected: returns the actual option price when checked (or 1 if option is free), 0 when unchecked
					$c_checked = $is_selected ? ($c_num > 0 ? (string) ($c_num * $qty_mult) : '1') : '0';
					$c_is_checked = $is_selected ? '1' : '0';

					// Choice slug and aliases
					$c_slug = $to_slug($c_lbl);
					$choice_aliases = array_filter(array_unique([
						$c_uuid,
						strtolower($c_uuid),
						$c_lbl,
						strtolower($c_lbl),
						$c_slug,
						strtolower($c_slug),
						str_replace('-', '_', $c_slug),
						strtolower(str_replace('-', '_', $c_slug)),
						str_replace('_', '-', $c_slug),
						strtolower(str_replace('_', '-', $c_slug)),
						preg_replace('/[^a-z0-9]/', '', strtolower($c_lbl)),
						$c_val,
						strtolower($c_val),
						$to_slug($c_val),
						strtolower($to_slug($c_val)),
					]));

					// Register choice option tokens: {field}.options.{choice}.{prop} and {field}.{choice}.{prop}
					foreach ($field_aliases as $fa) {
						foreach ($choice_aliases as $ca) {
							// Direct choice reference without property suffix
							$resolved["{$fa}.options.{$ca}"] = $c_formula;
							$resolved["{$fa}.{$ca}"] = $c_formula;

							$prefix = "{$fa}.options.{$ca}.";
							$prefix_short = "{$fa}.{$ca}.";

							$props = [
								'formula' => $c_formula,
								'formula-value' => $c_formula,
								'formula_value' => $c_formula,
								'value' => $c_formula,
								'checked' => $c_checked,
								'selected' => $c_checked,
								'is-checked' => $c_is_checked,
								'is_checked' => $c_is_checked,
								'price' => $c_price,
								'qty' => $c_qty,
								'quantity' => $c_qty,
							];

							foreach ($props as $pk => $pv) {
								$resolved[$prefix . $pk] = $pv;
								$resolved[$prefix_short . $pk] = $pv;
							}
						}
					}

					// Register direct standalone choice tokens without field prefix
					foreach ($choice_aliases as $ca) {
						$resolved[$ca] = $c_formula;
						$resolved["{$ca}.formula"] = $c_formula;
						$resolved["{$ca}.formula-value"] = $c_formula;
						$resolved["{$ca}.formula_value"] = $c_formula;
						$resolved["{$ca}.value"] = $c_formula;
						$resolved["{$ca}.checked"] = $c_checked;
						$resolved["{$ca}.selected"] = $c_checked;
						$resolved["{$ca}.is-checked"] = $c_is_checked;
						$resolved["{$ca}.is_checked"] = $c_is_checked;
						$resolved["{$ca}.price"] = $c_price;
						$resolved["{$ca}.qty"] = $c_qty;
						$resolved["{$ca}.quantity"] = $c_qty;
					}

					// Colon syntax: {field_uuid}:option:{choice_uuid}:{prop}
					if ('' !== $uuid && '' !== $c_uuid) {
						$c_colon = "{$uuid}:option:{$c_uuid}:";
						$resolved[$c_colon . 'formula'] = $c_formula;
						$resolved[$c_colon . 'checked'] = $c_checked;
						$resolved[$c_colon . 'selected'] = $c_checked;
						$resolved[$c_colon . 'price'] = $c_price;
						$resolved[$c_colon . 'qty'] = $c_qty;
					}
				}

				$total_choices = count($choices);
				$field_num = $selected_count > 0 ? (string) (floor($total_num) == $total_num ? (int) $total_num : $total_num) : '0';

				// Choice aggregate properties
				$min_formula = !empty($selected_formulas) ? (string) min($selected_formulas) : '0';
				$max_formula = !empty($selected_formulas) ? (string) max($selected_formulas) : '0';
				$sum_formula = !empty($selected_formulas) ? (string) array_sum($selected_formulas) : '0';

				$field_props['selected-none'] = 0 === $selected_count ? '1' : '0';
				$field_props['selected_none'] = 0 === $selected_count ? '1' : '0';
				$field_props['selected-any'] = $selected_count > 0 ? '1' : '0';
				$field_props['selected_any'] = $selected_count > 0 ? '1' : '0';
				$field_props['selected-all'] = ($selected_count === $total_choices && $total_choices > 0) ? '1' : '0';
				$field_props['selected_all'] = ($selected_count === $total_choices && $total_choices > 0) ? '1' : '0';
				$field_props['count-selected'] = (string) $selected_count;
				$field_props['count_selected'] = (string) $selected_count;
				$field_props['min-formula'] = $min_formula;
				$field_props['min_formula'] = $min_formula;
				$field_props['max-formula'] = $max_formula;
				$field_props['max_formula'] = $max_formula;
				$field_props['sum-formula'] = $sum_formula;
				$field_props['sum_formula'] = $sum_formula;
				$field_props['total-qty'] = (string) $total_qty;
				$field_props['total_qty'] = (string) $total_qty;
				$field_props['selected-formula'] = $sum_formula;
				$field_props['selected_formula'] = $sum_formula;
				$field_props['qty'] = (string) $total_qty;
				$field_props['value'] = $field_num;
			} elseif (isset($field_props['value'])) {
				// Non-choice field with value property
				$field_props['value'] = $field_num;
			} else {
				if (is_numeric($val) && '' !== (string) $val) {
					$field_num = (string) $val;
				} elseif (isset($field['default']) && is_numeric($field['default']) && '' !== (string) $field['default']) {
					$field_num = (string) $field['default'];
				} elseif (is_string($val) && '' !== trim($val)) {
					$field_num = $val;
				} else {
					$field_num = '0';
				}
				$field_props['value'] = $field_num;
			}

			// Register field-level properties and direct aliases
			foreach ($field_aliases as $fa) {
				$resolved[$fa] = $field_num;
				foreach ($field_props as $prop_name => $prop_val) {
					$resolved["{$fa}.{$prop_name}"] = $prop_val;
				}
			}
		}

		return $resolved;
	}
}
