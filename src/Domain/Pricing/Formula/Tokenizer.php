<?php
/**
 * Formula tokenizer.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Domain\Pricing\Formula;

use RuntimeException;

final class Tokenizer {
	/**
	 * @return list<array{type:string,value:string,position:int}>
	 */
	public function tokenize(string $source): array {
		if (strlen($source) > 2000) {
			throw new RuntimeException('wooptions-pro_formula_too_long');
		}

		$tokens = [];
		$length = strlen($source);
		$index  = 0;

		while ($index < $length) {
			$character = $source[$index];
			if (ctype_space($character)) {
				++$index;
				continue;
			}

			if (ctype_digit($character) || ('.' === $character && isset($source[$index + 1]) && ctype_digit($source[$index + 1]))) {
				$start   = $index;
				$has_dot = false;
				while ($index < $length) {
					$current = $source[$index];
					if ('.' === $current && ! $has_dot) {
						$has_dot = true;
						++$index;
						continue;
					}
					if (! ctype_digit($current)) {
						break;
					}
					++$index;
				}
				$value = substr($source, $start, $index - $start);
				if (str_starts_with($value, '.')) {
					$value = '0' . $value;
				}
				$tokens[] = ['type' => 'number', 'value' => $value, 'position' => $start];
				continue;
			}

			if (ctype_alpha($character) || '_' === $character) {
				$start = $index;
				++$index;
				while ($index < $length && (ctype_alnum($source[$index]) || '_' === $source[$index])) {
					++$index;
				}
				$tokens[] = [
					'type'     => 'identifier',
					'value'    => substr($source, $start, $index - $start),
					'position' => $start,
				];
				continue;
			}

			if ('"' === $character || "'" === $character) {
				$quote  = $character;
				$start  = $index;
				$value  = '';
				$closed = false;
				++$index;
				while ($index < $length) {
					$current = $source[$index];
					if ('\\' === $current && isset($source[$index + 1])) {
						$next = $source[$index + 1];
						if ($next === $quote || '\\' === $next) {
							$value .= $next;
							$index += 2;
							continue;
						}
					}
					if ($current === $quote) {
						$closed = true;
						++$index;
						break;
					}
					$value .= $current;
					++$index;
				}
				if (! $closed) {
					throw new RuntimeException('wooptions-pro_formula_unterminated_string');
				}
				$tokens[] = ['type' => 'string', 'value' => $value, 'position' => $start];
				continue;
			}

			$two = substr($source, $index, 2);
			if (in_array($two, ['>=', '<=', '==', '!=', '&&', '||'], true)) {
				$tokens[] = ['type' => 'operator', 'value' => $two, 'position' => $index];
				$index   += 2;
				continue;
			}

			if (str_contains('+-*/%^><!(),', $character)) {
				$type     = in_array($character, ['(', ')', ','], true) ? 'punctuation' : 'operator';
				$tokens[] = ['type' => $type, 'value' => $character, 'position' => $index];
				++$index;
				continue;
			}

			throw new RuntimeException('wooptions-pro_formula_invalid_character_at_' . $index);
		}

		if (count($tokens) > 1000) {
			throw new RuntimeException('wooptions-pro_formula_too_many_tokens');
		}

		$tokens[] = ['type' => 'eof', 'value' => '', 'position' => $length];
		return $tokens;
	}
}
