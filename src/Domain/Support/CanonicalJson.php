<?php
/**
 * Canonical JSON for immutable revision hashes.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Domain\Support;

use JsonException;

final class CanonicalJson {
	public static function encode(mixed $value): string {
		return json_encode(
			self::sort($value),
			JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION
		);
	}

	public static function hash(mixed $value): string {
		return hash('sha256', self::encode($value));
	}

	private static function sort(mixed $value): mixed {
		if (! is_array($value)) {
			return $value;
		}

		if (array_is_list($value)) {
			return array_map([self::class, 'sort'], $value);
		}

		ksort($value, SORT_STRING);
		foreach ($value as $key => $item) {
			$value[$key] = self::sort($item);
		}
		return $value;
	}

	/**
	 * @return array<string, mixed>
	 */
	public static function decode_object(string $json): array {
		$value = json_decode($json, true, 64, JSON_THROW_ON_ERROR);
		if (! is_array($value)) {
			throw new JsonException('wooptionsfic_json_object_required');
		}
		return $value;
	}
}
