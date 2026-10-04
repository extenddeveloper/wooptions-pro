<?php
/**
 * UUID value helpers.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Domain\Support;

use InvalidArgumentException;

final class Uuid {
	public static function v4(): string {
		$bytes    = random_bytes(16);
		$bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
		$bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
		$hex      = bin2hex($bytes);

		return sprintf(
			'%s-%s-%s-%s-%s',
			substr($hex, 0, 8),
			substr($hex, 8, 4),
			substr($hex, 12, 4),
			substr($hex, 16, 4),
			substr($hex, 20, 12)
		);
	}

	public static function is_valid(string $value): bool {
		return 1 === preg_match(
			'/\A[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z/i',
			$value
		);
	}

	public static function from_hash(string $hash): string {
		$hex = strtolower(preg_replace('/[^0-9a-f]/i', '', $hash) ?? '');
		if (strlen($hex) < 32) {
			$hex = hash('sha256', $hash);
		}
		$hex     = substr($hex, 0, 32);
		$hex[12] = '5';
		$variant = hexdec($hex[16]);
		$hex[16] = dechex(($variant & 0x3) | 0x8);

		return sprintf(
			'%s-%s-%s-%s-%s',
			substr($hex, 0, 8),
			substr($hex, 8, 4),
			substr($hex, 12, 4),
			substr($hex, 16, 4),
			substr($hex, 20, 12)
		);
	}

	public static function assert(string $value): string {
		if (! self::is_valid($value)) {
			throw new InvalidArgumentException('wooptionsfic_invalid_uuid');
		}
		return strtolower($value);
	}
}
