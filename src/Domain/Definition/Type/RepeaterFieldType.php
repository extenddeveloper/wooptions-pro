<?php
/**
 * First-class repeatable section.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Domain\Definition\Type;

use WooptionsFic\Domain\Definition\FieldTypeRegistry;
use WooptionsFic\Domain\Support\Uuid;

final class RepeaterFieldType extends AbstractFieldType {
	public function __construct(
		private readonly FieldTypeRegistry $registry,
		private readonly int $maximum_rows = 25
	) {
	}

	public function key(): string {
		return 'repeater';
	}

	public function normalize_definition(array $definition): array {
		$normalized                = $this->base_definition($definition);
		$limit                     = max(1, min(100, $this->maximum_rows));

		// Section & Accordion properties
		$style                     = (string) ($definition['sectionStyle'] ?? 'section');
		$normalized['sectionStyle'] = in_array($style, ['section', 'accordion', 'blank'], true) ? $style : 'section';

		$initial_state             = (string) ($definition['initialState'] ?? 'open');
		$normalized['initialState'] = in_array($initial_state, ['open', 'close'], true) ? $initial_state : 'open';

		$normalized['hideSectionTitle'] = ! empty($definition['hideSectionTitle']);

		// Repeater properties
		$repeatable                = ! isset($definition['repeatable']) || ! empty($definition['repeatable']);
		$normalized['repeatable']  = $repeatable;

		$repeat_method             = (string) ($definition['repeatMethod'] ?? 'button');
		$normalized['repeatMethod'] = in_array($repeat_method, ['button', 'quantity'], true) ? $repeat_method : 'button';

		$repeat_label              = (string) ($definition['repeatLabel'] ?? $definition['rowTitle'] ?? 'Item {n}');
		$normalized['repeatLabel'] = self::plain_text($repeat_label, 100);
		$normalized['rowTitle']    = $normalized['repeatLabel'];

		$price_type                = (string) ($definition['repeatPriceType'] ?? 'none');
		$normalized['repeatPriceType'] = in_array($price_type, ['none', 'fixed', 'percentage'], true) ? $price_type : 'none';
		$normalized['repeatRegularPrice'] = (string) ($definition['repeatRegularPrice'] ?? '');
		$normalized['repeatSalePrice']    = (string) ($definition['repeatSalePrice'] ?? '');

		$normalized['buttonLabel'] = self::plain_text((string) ($definition['buttonLabel'] ?? 'Add Another'), 60);

		$max_repeats               = max(0, (int) ($definition['maxRepeats'] ?? $definition['maxRows'] ?? 0));
		$min_repeats               = max(0, (int) ($definition['minRepeats'] ?? $definition['minRows'] ?? 0));
		$normalized['maxRepeats']  = $max_repeats;
		$normalized['minRepeats']  = $min_repeats;

		$normalized['minRows']     = max(0, min($limit, $min_repeats > 0 ? $min_repeats : (int) ($definition['minRows'] ?? 0)));
		$normalized['defaultRows'] = max($normalized['minRows'], min($limit, (int) ($definition['defaultRows'] ?? 1)));
		$normalized['maxRows']     = $max_repeats > 0 ? min($limit, $max_repeats) : $limit;

		$normalized['children']    = [];

		foreach ((array) ($definition['children'] ?? []) as $child) {
			if (! is_array($child) || 'repeater' === ($child['type'] ?? '')) {
				continue;
			}
			$type = $this->registry->get((string) ($child['type'] ?? ''));
			if ($type) {
				$normalized['children'][] = $type->normalize_definition($child);
			}
		}
		return $normalized;
	}

	public function normalize_value(mixed $value, array $definition): array {
		$repeatable = ! isset($definition['repeatable']) || ! empty($definition['repeatable']);
		if (! $repeatable) {
			if (is_array($value) && isset($value[0]['values'])) {
				$source = $value[0]['values'];
			} elseif (is_array($value) && isset($value['rows'])) {
				$first = reset($value['rows']);
				$source = is_array($first) && isset($first['values']) ? $first['values'] : (array) $first;
			} else {
				$source = (array) $value;
			}
			$values = [];
			foreach ((array) ($definition['children'] ?? []) as $child) {
				$type = $this->registry->get((string) ($child['type'] ?? ''));
				$uuid = (string) ($child['uuid'] ?? '');
				if ($type && '' !== $uuid) {
					$values[$uuid] = $type->normalize_value($source[$uuid] ?? null, $child);
				}
			}
			return [['rowUuid' => 'static', 'values' => $values]];
		}

		if (is_array($value) && isset($value['rows']) && is_array($value['rows'])) {
			$value = $value['rows'];
		}
		$rows = [];
		$max_repeats = (int) ($definition['maxRepeats'] ?? $definition['maxRows'] ?? 0);
		$max_limit   = $max_repeats > 0 ? $max_repeats : $this->maximum_rows;

		foreach ((array) $value as $row_key => $row) {
			if (! is_array($row)) {
				continue;
			}
			$row_uuid = (string) ($row['rowUuid'] ?? $row_key);
			if (! Uuid::is_valid($row_uuid)) {
				$row_uuid = Uuid::v4();
			}
			$source = is_array($row['values'] ?? null) ? $row['values'] : $row;
			$values = [];
			foreach ((array) ($definition['children'] ?? []) as $child) {
				$type = $this->registry->get((string) ($child['type'] ?? ''));
				$uuid = (string) ($child['uuid'] ?? '');
				if ($type && '' !== $uuid) {
					$values[$uuid] = $type->normalize_value($source[$uuid] ?? null, $child);
				}
			}
			$rows[] = ['rowUuid' => strtolower($row_uuid), 'values' => $values];
			if (count($rows) >= $max_limit) {
				break;
			}
		}
		return $rows;
	}

	public function validate(mixed $value, array $definition): array {
		$rows       = (array) $value;
		$errors     = [];
		$count      = count($rows);
		$repeatable = ! isset($definition['repeatable']) || ! empty($definition['repeatable']);

		if ($repeatable) {
			$min = (int) ($definition['minRepeats'] ?? $definition['minRows'] ?? 0);
			$max = (int) ($definition['maxRepeats'] ?? $definition['maxRows'] ?? 0);

			if ($min > 0 && $count < $min) {
				$errors[] = ['code' => 'too_few_rows', 'params' => ['minimum' => $min]];
			}
			if ($max > 0 && $count > $max) {
				$errors[] = ['code' => 'too_many_rows', 'params' => ['maximum' => $max]];
			}
		}

		foreach ($rows as $row_index => $row) {
			$row_values = is_array($row['values'] ?? null) ? $row['values'] : [];
			foreach ((array) ($definition['children'] ?? []) as $child) {
				$type = $this->registry->get((string) ($child['type'] ?? ''));
				$uuid = (string) ($child['uuid'] ?? '');
				if (! $type || '' === $uuid) {
					continue;
				}
				foreach ($type->validate($row_values[$uuid] ?? null, $child) as $error) {
					if ($repeatable) {
						$error['params']['row'] = $row_index + 1;
					}
					$error['params']['field'] = $uuid;
					$errors[]                 = $error;
				}
			}
		}
		return $errors;
	}

	public function format_value(mixed $value, array $definition): string {
		$rows = (array) $value;
		if (empty($rows)) {
			return '';
		}
		$repeatable       = ! isset($definition['repeatable']) || ! empty($definition['repeatable']);
		$repeat_label_tpl = (string) ($definition['repeatLabel'] ?? ($definition['rowTitle'] ?? 'Item {n}'));
		$children         = (array) ($definition['children'] ?? []);

		$formatted_rows = [];
		foreach ($rows as $idx => $row) {
			$r_num     = $idx + 1;
			$item_name = str_replace(['{n}', '{index}'], (string) $r_num, $repeat_label_tpl);
			$r_values  = is_array($row['values'] ?? null) ? $row['values'] : (array) $row;

			$child_summaries = [];
			foreach ($children as $child) {
				$c_uuid = (string) ($child['uuid'] ?? '');
				$c_type = $this->registry->get((string) ($child['type'] ?? ''));
				if (! $c_type || ! array_key_exists($c_uuid, $r_values)) {
					continue;
				}
				$c_val = $r_values[$c_uuid];
				$c_fmt = $c_type->format_value($c_val, $child);
				if ('' !== $c_fmt) {
					$c_label           = trim((string) ($child['label'] ?? ''));
					$child_summaries[] = '' !== $c_label ? "$c_label: $c_fmt" : $c_fmt;
				}
			}

			if (! empty($child_summaries)) {
				$details          = implode(', ', $child_summaries);
				$formatted_rows[] = $repeatable ? "$item_name ($details)" : $details;
			} elseif ($repeatable) {
				$formatted_rows[] = $item_name;
			}
		}

		if (empty($formatted_rows)) {
			$count = count($rows);
			return $count . (1 === $count ? ' item' : ' items');
		}

		return implode(' | ', $formatted_rows);
	}

	public function accepts_customer_value(): bool {
		return true;
	}
}
