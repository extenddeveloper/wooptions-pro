<?php
/**
 * Calculated display field.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Domain\Definition\Type;

final class CalculatedFieldType extends AbstractFieldType {
	public function __construct(private readonly string $type_key) {
	}

	public function key(): string {
		return $this->type_key;
	}

	public function normalize_definition(array $definition): array {
		$normalized                  = $this->base_definition($definition);
		$normalized['expression']    = self::substring(trim((string) ($definition['expression'] ?? '0')), 0, 2000);
		$normalized['displayMode']   = in_array(($definition['displayMode'] ?? ''), ['number', 'currency', 'text'], true)
			? $definition['displayMode']
			: 'number';
		$normalized['decimalPlaces'] = max(0, min(6, (int) ($definition['decimalPlaces'] ?? 2)));
		$normalized['prefix']        = self::plain_text((string) ($definition['prefix'] ?? ''), 50);
		$normalized['suffix']        = self::plain_text((string) ($definition['suffix'] ?? ''), 50);
		$normalized['hideWhenZero']  = ! empty($definition['hideWhenZero']);
		return $normalized;
	}

	public function normalize_value(mixed $value, array $definition): null {
		return null;
	}

	public function validate(mixed $value, array $definition): array {
		return [];
	}

	public function format_value(mixed $value, array $definition): string {
		return '';
	}

	public function accepts_customer_value(): bool {
		return false;
	}
}
