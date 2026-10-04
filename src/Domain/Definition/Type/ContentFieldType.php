<?php
/**
 * Static content field type.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Domain\Definition\Type;

final class ContentFieldType extends AbstractFieldType {
	public function __construct(private readonly string $type_key) {
	}

	public function key(): string {
		return $this->type_key;
	}

	public function normalize_definition(array $definition): array {
		$normalized = $this->base_definition($definition);
		$type       = $this->key();
		if (in_array($type, ['content', 'modal'], true)) {
			$raw_content           = (string) ($definition['content'] ?? '');
			$normalized['content'] = function_exists('wp_kses_post') ? wp_kses_post($raw_content) : $raw_content;
		} elseif (isset($definition['content']) && '' !== trim((string) $definition['content'])) {
			$normalized['content'] = function_exists('wp_kses_post') ? wp_kses_post((string) $definition['content']) : (string) $definition['content'];
		}
		if (isset($definition['height'])) {
			$normalized['height'] = (int) $definition['height'];
		}
		if (isset($definition['color']) && '' !== (string) $definition['color']) {
			$normalized['color'] = sanitize_hex_color((string) $definition['color']) ?: (string) $definition['color'];
		}
		if (isset($definition['buttonText'])) {
			$normalized['buttonText'] = self::plain_text((string) $definition['buttonText'], 200);
		}
		if (isset($definition['buttonStyle'])) {
			$normalized['buttonStyle'] = sanitize_key((string) $definition['buttonStyle']);
		}
		if (isset($definition['modalTitle'])) {
			$normalized['modalTitle'] = self::plain_text((string) $definition['modalTitle'], 200);
		}
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
