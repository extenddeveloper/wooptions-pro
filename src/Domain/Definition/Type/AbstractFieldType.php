<?php
/**
 * Shared field definition normalization.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Domain\Definition\Type;

use WooptionsFic\Domain\Definition\FieldType;
use WooptionsFic\Domain\Support\Uuid;

abstract class AbstractFieldType implements FieldType {
	/**
	 * @param array<string, mixed> $definition Definition.
	 * @return array<string, mixed>
	 */
	protected function base_definition(array $definition): array {
		$uuid = (string) ($definition['uuid'] ?? '');
		if (! Uuid::is_valid($uuid)) {
			$uuid = Uuid::v4();
		}

		$width = (string) ($definition['width'] ?? '100%');
		if (! in_array($width, ['33%', '50%', '66%', '100%'], true)) {
			$width = '100%';
		}

		return [
			'uuid'        => strtolower($uuid),
			'type'        => $this->key(),
			'label'       => self::plain_text((string) ($definition['label'] ?? 'Untitled field'), 200),
			'description' => self::plain_text((string) ($definition['description'] ?? ''), 1000),
			'required'    => ! empty($definition['required']),
			'disabled'    => ! empty($definition['disabled']),
			'default'     => $definition['default'] ?? null,
			'validation'  => is_array($definition['validation'] ?? null) ? $definition['validation'] : [],
			'pricing'     => self::pricing(is_array($definition['pricing'] ?? null) ? $definition['pricing'] : []),
			'conditions'  => is_array($definition['conditions'] ?? null) ? $definition['conditions'] : [],
			'style'       => is_array($definition['style'] ?? null) ? $definition['style'] : [],
			'preview'     => is_array($definition['preview'] ?? null) ? $definition['preview'] : [],
			'help'             => self::plain_text((string) ($definition['help'] ?? ''), 1000),
			'helpTextPosition' => in_array((string) ($definition['helpTextPosition'] ?? 'below_title'), ['below_title', 'tooltip', 'below_field'], true)
				? (string) ($definition['helpTextPosition'] ?? 'below_title')
				: 'below_title',
			'width'            => $width,
		];
	}

	protected static function plain_text(string $value, int $maximum): string {
		$value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '';
		$value = trim(strip_tags($value));
		return self::substring($value, 0, $maximum);
	}

	protected static function substring(string $value, int $start, int $length): string {
		return function_exists('mb_substr')
			? (string) mb_substr($value, $start, $length)
			: substr($value, $start, $length);
	}

	protected static function length(string $value): int {
		return function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
	}

	protected static function is_empty(mixed $value): bool {
		return null === $value || '' === $value || [] === $value || false === $value;
	}

	/**
	 * @param array<string,mixed> $pricing Raw pricing.
	 * @return array<string,mixed>
	 */
	protected static function pricing(array $pricing): array {
		$strategy = (string) ($pricing['strategy'] ?? 'none');
		$allowed  = ['none', 'fixed', 'percentage', 'per_character', 'per_unit', 'setup', 'tiered', 'formula', 'product_linked'];
		if (! in_array($strategy, $allowed, true)) {
			$strategy = 'none';
		}
		$decimal = static function (mixed $value): string {
			$value = trim((string) $value);
			return 1 === preg_match('/\A-?\d{1,12}(?:\.\d{1,6})?\z/', $value) ? $value : '0';
		};
		$normalized = [
			'strategy' => $strategy,
			'amount'   => $decimal($pricing['amount'] ?? '0'),
			'percent'  => $decimal($pricing['percent'] ?? '0'),
			'mode'     => 'unit_price' === ($pricing['mode'] ?? '') ? 'unit_price' : 'adjustment',
		];
		if ('formula' === $strategy) {
			$normalized['expression'] = self::substring(trim((string) ($pricing['expression'] ?? '0')), 0, 2000);
		}
		if ('tiered' === $strategy) {
			$normalized['tiers'] = [];
			foreach (array_slice((array) ($pricing['tiers'] ?? []), 0, 100) as $tier) {
				if (is_array($tier)) {
					$normalized['tiers'][] = [
						'min'    => $decimal($tier['min'] ?? '0'),
						'amount' => $decimal($tier['amount'] ?? '0'),
					];
				}
			}
		}
		return $normalized;
	}
}
