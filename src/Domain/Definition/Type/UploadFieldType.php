<?php
/**
 * Opaque upload-reference field.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Domain\Definition\Type;

use WooOptionsPro\Domain\Support\Uuid;

final class UploadFieldType extends AbstractFieldType {
	public function key(): string {
		return 'file';
	}

	public function normalize_definition(array $definition): array {
		$normalized                      = $this->base_definition($definition);
		$normalized['allowedExtensions'] = array_values(array_filter(array_map('strval', (array) ($definition['allowedExtensions'] ?? []))));
		$normalized['maxFiles']          = max(1, min(10, (int) ($definition['maxFiles'] ?? 1)));
		$normalized['maxFileMb']         = max(1, min(50, (int) ($definition['maxFileMb'] ?? 5)));
		return $normalized;
	}

	public function normalize_value(mixed $value, array $definition): array {
		$values = is_array($value) ? $value : ('' === (string) $value ? [] : [$value]);
		$values = array_values(array_unique(array_map('strval', $values)));
		return array_values(array_filter($values, [Uuid::class, 'is_valid']));
	}

	public function validate(mixed $value, array $definition): array {
		$values = (array) $value;
		if (! empty($definition['required']) && [] === $values) {
			return [['code' => 'required', 'params' => []]];
		}
		if (count($values) > (int) ($definition['maxFiles'] ?? 1)) {
			return [['code' => 'too_many_files', 'params' => ['maximum' => (int) $definition['maxFiles']]]];
		}
		return [];
	}

	public function format_value(mixed $value, array $definition): string {
		$count = count((array) $value);
		return $count > 0 ? $count . ($count > 1 ? ' files' : ' file') : '';
	}

	public function accepts_customer_value(): bool {
		return true;
	}
}
