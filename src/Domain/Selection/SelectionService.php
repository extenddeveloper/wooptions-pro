<?php
/**
 * Selection normalization and validation.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Domain\Selection;

use WooOptionsPro\Domain\Definition\FieldTypeRegistry;
use WooOptionsPro\Domain\Rule\RuleEngine;

final class SelectionService {
	public function __construct(
		private readonly FieldTypeRegistry $registry,
		private readonly RuleEngine $rules
	) {
	}

	/**
	 * @param array<string, mixed> $raw Raw selection.
	 * @param array<string, mixed> $compiled Compiled configuration.
	 * @param array<string, mixed> $context Context.
	 * @return array{
	 *   values:array<string,mixed>,
	 *   states:array<string,array<string,mixed>>,
	 *   errors:list<array<string,mixed>>,
	 *   warnings:list<array<string,mixed>>,
	 *   valid:bool
	 * }
	 */
	public function normalize_and_validate(array $raw, array $compiled, array $context = []): array {
		$values = [];
		foreach ((array) ($compiled['fields'] ?? []) as $field) {
			$type = $this->registry->get((string) ($field['type'] ?? ''));
			$uuid = (string) ($field['uuid'] ?? '');
			if ($type && '' !== $uuid && $type->accepts_customer_value()) {
				$values[$uuid] = $type->normalize_value($raw[$uuid] ?? null, $field);
			}
		}

		$states = $this->rules->resolve_field_states($compiled, $values, $context);
		$errors = [];

		foreach ((array) ($compiled['fields'] ?? []) as $field) {
			$type = $this->registry->get((string) ($field['type'] ?? ''));
			$uuid = (string) ($field['uuid'] ?? '');
			if (! $type || '' === $uuid || ! $type->accepts_customer_value()) {
				continue;
			}
			$state = $states[$uuid] ?? ['visible' => true, 'enabled' => true, 'required' => ! empty($field['required'])];
			if (empty($state['visible']) || empty($state['enabled'])) {
				unset($values[$uuid]);
				continue;
			}

			$effective_field             = $field;
			$effective_field['required'] = ! empty($state['required']);
			foreach ($type->validate($values[$uuid] ?? null, $effective_field) as $error) {
				$errors[] = [
					'code'      => 'field_' . $error['code'],
					'fieldUuid' => $uuid,
					'label'     => (string) ($field['label'] ?? ''),
					'params'    => $error['params'],
				];
			}
		}

		return [
			'values'   => $values,
			'states'   => $states,
			'errors'   => $errors,
			'warnings' => [],
			'valid'    => [] === $errors,
		];
	}
}
