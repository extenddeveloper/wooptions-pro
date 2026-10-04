<?php
/**
 * Immutable human-readable configuration snapshots.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Domain\Snapshot;

use DateTimeImmutable;
use DateTimeZone;
use WooptionsFic\Domain\Definition\FieldTypeRegistry;
use WooptionsFic\Domain\Support\CanonicalJson;
use WooptionsFic\Domain\Support\Uuid;

final class SnapshotFactory {
	public function __construct(private readonly FieldTypeRegistry $registry) {
	}

	/**
	 * @param array<string,mixed> $compiled Configuration.
	 * @param array<string,mixed> $values Values.
	 * @param array<string,mixed> $price Price breakdown.
	 * @return array<string,mixed>
	 */
	public function create(array $compiled, array $values, array $price, int $product_id, int $variation_id = 0, array $context = []): array {
		$summary = [];
		$snapshot_values = $values;
		foreach ((array) ($compiled['fields'] ?? []) as $field) {
			$type = $this->registry->get((string) ($field['type'] ?? ''));
			$uuid = (string) ($field['uuid'] ?? '');
			if (! $type || ! $type->accepts_customer_value() || ! array_key_exists($uuid, $values)) {
				continue;
			}
			if ('repeater' === (string) ($field['type'] ?? '')) {
				$repeatable       = ! isset($field['repeatable']) || ! empty($field['repeatable']);
				$repeat_label_tpl = (string) ($field['repeatLabel'] ?? ($field['rowTitle'] ?? 'Item {n}'));
				$rows             = (array) ($values[$uuid] ?? []);
				$children         = (array) ($field['children'] ?? []);
				$row_price_type   = (string) ($field['repeatPriceType'] ?? 'none');
				$has_row_price    = in_array($row_price_type, ['fixed', 'percentage'], true);
				$section_label    = trim((string) ($field['label'] ?? ''));

				foreach ($rows as $r_idx => $row) {
					$r_num     = $r_idx + 1;
					$item_name = str_replace(['{n}', '{index}'], (string) $r_num, $repeat_label_tpl);
					$r_values  = is_array($row['values'] ?? null) ? $row['values'] : (array) $row;

					if ($repeatable && $has_row_price) {
						$row_title = '' !== $section_label ? $section_label . ' (' . $item_name . ')' : $item_name;
						$summary[] = [
							'fieldUuid' => $uuid . ':row:' . $r_num,
							'type'      => 'repeater',
							'label'     => $row_title,
							'value'     => $item_name,
							'sensitive' => false,
						];
					}

					foreach ($children as $child) {
						$c_uuid = (string) ($child['uuid'] ?? '');
						$c_type = $this->registry->get((string) ($child['type'] ?? ''));
						if (! $c_type || ! $c_type->accepts_customer_value() || ! array_key_exists($c_uuid, $r_values)) {
							continue;
						}
						$c_val = $r_values[$c_uuid];
						$c_formatted = $c_type instanceof \WooptionsFic\Domain\Definition\Type\ChoiceFieldType
							? $c_type->format_value($c_val, $child, $context)
							: $c_type->format_value($c_val, $child);

						if ('' === $c_formatted && ! empty($c_val)) {
							$sel_uuids = is_array($c_val) ? $c_val : [(string) $c_val];
							$fallbacks = [];
							foreach ((array) ($child['choices'] ?? []) as $ch) {
								$ch_u = (string) ($ch['uuid'] ?? '');
								if (in_array($ch_u, $sel_uuids, true)) {
									$ch_lbl = trim((string) ($ch['label'] ?? ''));
									if ('' === $ch_lbl) {
										$ch_lbl = trim((string) ($ch['adminLabel'] ?? ''));
									}
									if ('' !== $ch_lbl && 'Choice' !== $ch_lbl) {
										$fallbacks[] = $ch_lbl;
									}
								}
							}
							if (! empty($fallbacks)) {
								$c_formatted = implode(', ', $fallbacks);
							}
						}

						if ('' === $c_formatted) {
							continue;
						}

						$c_label = trim((string) ($child['label'] ?? __('Option', 'wooptionsfic')));
						if ($repeatable) {
							$item_prefix   = '' !== $section_label ? $section_label . ' (' . $item_name . ')' : $item_name;
							$display_label = $item_prefix . ' - ' . $c_label;
							$child_field_uuid = $c_uuid . ':row:' . $r_num;
						} else {
							$display_label = '' !== $section_label ? $section_label . ' - ' . $c_label : $c_label;
							$child_field_uuid = $c_uuid;
						}

						$summary[] = [
							'fieldUuid' => $child_field_uuid,
							'type'      => (string) ($child['type'] ?? ''),
							'label'     => $display_label,
							'value'     => $c_formatted,
							'sensitive' => false,
						];
					}
				}
				continue;
			}

			$formatted = $type instanceof \WooptionsFic\Domain\Definition\Type\ChoiceFieldType
				? $type->format_value($values[$uuid], $field, $context)
				: $type->format_value($values[$uuid], $field);
			if ('' === $formatted && ! empty($values[$uuid])) {
				$selected_uuids = is_array($values[$uuid]) ? $values[$uuid] : [(string) $values[$uuid]];
				$fallback_labels = [];
				foreach ((array) ($field['choices'] ?? []) as $ch) {
					$ch_uuid = (string) ($ch['uuid'] ?? '');
					if (in_array($ch_uuid, $selected_uuids, true)) {
						$lbl = trim((string) ($ch['label'] ?? ''));
						$pid = max(0, (int) ($ch['productId'] ?? ($ch['linkedProductId'] ?? 0)));
						if (('' === $lbl || 'Choice' === $lbl) && $pid > 0 && function_exists('wc_get_product')) {
							$p = wc_get_product($pid);
							if ($p) {
								$lbl = wp_strip_all_tags($p->get_name());
							}
						}
						if ('' === $lbl) {
							$lbl = trim((string) ($ch['adminLabel'] ?? ''));
						}
						if (! empty($field['enableQuantity'])) {
							$qty = ! empty($context['choiceQuantities'][$ch_uuid]) ? max(1, (int) $context['choiceQuantities'][$ch_uuid]) : 1;
							$lbl = sprintf('%s Count: %d,', $lbl, $qty);
						}
						if ('' !== $lbl && 'Choice' !== $lbl) {
							$fallback_labels[] = $lbl;
						}
					}
				}
				if (! empty($fallback_labels)) {
					$formatted = implode(', ', $fallback_labels);
				}
			}
			if ('' === $formatted) {
				continue;
			}
			$summary[] = [
				'fieldUuid' => $uuid,
				'type'      => (string) ($field['type'] ?? ''),
				'label'     => (string) ($field['label'] ?? ''),
				'value'     => $formatted,
				'sensitive' => false,
			];
		}

		$snapshot = [
			'snapshotUuid' => Uuid::v4(),
			'schemaVersion'=> 1,
			'setUuid'      => (string) ($compiled['setUuid'] ?? ''),
			'revisionUuid' => (string) ($compiled['revisionUuid'] ?? ''),
			'revisionHash' => (string) ($compiled['contentHash'] ?? ''),
			'productId'    => $product_id,
			'variationId'  => $variation_id,
			'title'        => (string) ($compiled['title'] ?? ''),
			'values'       => $snapshot_values,
			'summary'      => $summary,
			'price'        => $price,
			'createdAtGmt' => (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s\Z'),
		];
		$snapshot['snapshotHash'] = CanonicalJson::hash($snapshot);
		return $snapshot;
	}
}
