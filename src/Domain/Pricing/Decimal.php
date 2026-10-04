<?php
/**
 * Bounded fixed-scale decimal arithmetic.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Domain\Pricing;

use InvalidArgumentException;
use RuntimeException;

final class Decimal {
	public const SCALE  = 6;
	public const FACTOR = 1_000_000;

	private function __construct(private readonly int $raw) {
	}

	public static function zero(): self {
		return new self(0);
	}

	public static function one(): self {
		return new self(self::FACTOR);
	}

	public static function from_raw(int $raw): self {
		return new self($raw);
	}

	public static function from_int(int $value): self {
		if (0 !== $value && abs($value) > intdiv(PHP_INT_MAX, self::FACTOR)) {
			throw new InvalidArgumentException('wooptions-pro_decimal_out_of_range');
		}
		return new self($value * self::FACTOR);
	}

	public static function from_string(string|int $value): self {
		$value = trim((string) $value);
		if (1 !== preg_match('/\A([+-]?)(\d+)(?:\.(\d+))?\z/', $value, $matches)) {
			throw new InvalidArgumentException('wooptions-pro_invalid_decimal');
		}

		$integer = ltrim($matches[2], '0');
		$integer = '' === $integer ? '0' : $integer;
		if (strlen($integer) > 12) {
			throw new InvalidArgumentException('wooptions-pro_decimal_out_of_range');
		}

		$fraction = $matches[3] ?? '';
		$kept     = substr(str_pad($fraction, self::SCALE, '0'), 0, self::SCALE);
		$raw      = ((int) $integer * self::FACTOR) + (int) $kept;

		if (strlen($fraction) > self::SCALE && (int) $fraction[self::SCALE] >= 5) {
			++$raw;
		}

		if ('-' === $matches[1]) {
			$raw *= -1;
		}

		return new self($raw);
	}

	public function raw(): int {
		return $this->raw;
	}

	public function add(self $other): self {
		if (($other->raw > 0 && $this->raw > PHP_INT_MAX - $other->raw)
			|| ($other->raw < 0 && $this->raw < PHP_INT_MIN - $other->raw)
		) {
			throw new RuntimeException('wooptions-pro_decimal_overflow');
		}
		return new self($this->raw + $other->raw);
	}

	public function subtract(self $other): self {
		return $this->add($other->negate());
	}

	public function negate(): self {
		if (PHP_INT_MIN === $this->raw) {
			throw new RuntimeException('wooptions-pro_decimal_overflow');
		}
		return new self(-$this->raw);
	}

	public function absolute(): self {
		return $this->raw < 0 ? $this->negate() : $this;
	}

	public function multiply(self $other): self {
		if (0 === $this->raw || 0 === $other->raw) {
			return self::zero();
		}

		$a = abs($this->raw);
		$b = abs($other->raw);
		if ($a > intdiv(PHP_INT_MAX, $b)) {
			throw new RuntimeException('wooptions-pro_decimal_overflow');
		}

		return new self(self::rounded_divide($this->raw * $other->raw, self::FACTOR));
	}

	public function divide(self $other): self {
		if (0 === $other->raw) {
			throw new RuntimeException('wooptions-pro_formula_division_by_zero');
		}

		$a = abs($this->raw);
		if (0 !== $a && $a > intdiv(PHP_INT_MAX, self::FACTOR)) {
			throw new RuntimeException('wooptions-pro_decimal_overflow');
		}

		return new self(self::rounded_divide($this->raw * self::FACTOR, $other->raw));
	}

	public function modulo(self $other): self {
		if (0 === $other->raw) {
			throw new RuntimeException('wooptions-pro_formula_division_by_zero');
		}
		return new self($this->raw % $other->raw);
	}

	public function power(int $exponent): self {
		if ($exponent < 0 || $exponent > 10) {
			throw new RuntimeException('wooptions-pro_formula_exponent_out_of_range');
		}

		$result = self::one();
		$base   = $this;
		$power  = $exponent;

		while ($power > 0) {
			if (1 === ($power % 2)) {
				$result = $result->multiply($base);
			}
			$power = intdiv($power, 2);
			if ($power > 0) {
				$base = $base->multiply($base);
			}
		}
		return $result;
	}

	public function round(int $places = 0): self {
		$places = max(0, min(self::SCALE, $places));
		$unit   = 10 ** (self::SCALE - $places);
		return new self(self::rounded_divide($this->raw, $unit) * $unit);
	}

	public function floor(): self {
		$whole = intdiv($this->raw, self::FACTOR);
		if ($this->raw < 0 && 0 !== ($this->raw % self::FACTOR)) {
			--$whole;
		}
		return self::from_int($whole);
	}

	public function ceil(): self {
		$whole = intdiv($this->raw, self::FACTOR);
		if ($this->raw > 0 && 0 !== ($this->raw % self::FACTOR)) {
			++$whole;
		}
		return self::from_int($whole);
	}

	public function compare(self $other): int {
		return $this->raw <=> $other->raw;
	}

	public function is_zero(): bool {
		return 0 === $this->raw;
	}

	public function to_int(): int {
		return self::rounded_divide($this->raw, self::FACTOR);
	}

	public function to_string(bool $trim = true): string {
		$negative = $this->raw < 0;
		$absolute = abs($this->raw);
		$integer  = intdiv($absolute, self::FACTOR);
		$fraction = str_pad((string) ($absolute % self::FACTOR), self::SCALE, '0', STR_PAD_LEFT);

		if ($trim) {
			$fraction = rtrim($fraction, '0');
		}

		$output = (string) $integer;
		if ('' !== $fraction) {
			$output .= '.' . $fraction;
		}
		return ($negative ? '-' : '') . $output;
	}

	private static function rounded_divide(int $numerator, int $denominator): int {
		if (0 === $denominator) {
			throw new RuntimeException('wooptions-pro_formula_division_by_zero');
		}

		$negative = ($numerator < 0) xor ($denominator < 0);
		$a        = abs($numerator);
		$b        = abs($denominator);
		$quotient = intdiv($a, $b);
		$remainder= $a % $b;

		if ($remainder >= intdiv($b, 2) + ($b % 2)) {
			++$quotient;
		}

		return $negative ? -$quotient : $quotient;
	}
}
