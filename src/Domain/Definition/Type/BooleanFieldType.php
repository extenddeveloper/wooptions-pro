<?php
/**
 * Boolean field type.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Domain\Definition\Type;

final class BooleanFieldType extends AbstractFieldType {
	public function __construct(private readonly string $type_key) {
	}

	public function key(): string {
		return $this->type_key;
	}

	public function normalize_definition(array $definition): array {
		return $this->base_definition($definition);
	}

	public function normalize_value(mixed $value, array $definition): bool {
		return in_array($value, [true, 1, '1', 'yes', 'on', 'true'], true);
	}

	public function validate(mixed $value, array $definition): array {
		if (! empty($definition['required']) && true !== $value) {
			return [['code' => 'required', 'params' => []]];
		}
		return [];
	}

	public function format_value(mixed $value, array $definition): string {
		return true === $value ? 'Yes' : 'No';
	}

	public function accepts_customer_value(): bool {
		return true;
	}
}
