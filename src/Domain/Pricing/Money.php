<?php
/**
 * Integer-minor-unit money.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Domain\Pricing;

use InvalidArgumentException;

final class Money {
	private function __construct(
		private readonly int $minor,
		private readonly string $currency,
		private readonly int $scale
	) {
		if ($scale < 0 || $scale > 6) {
			throw new InvalidArgumentException('wooptions-pro_invalid_currency_scale');
		}
		if (1 !== preg_match('/\A[A-Z]{3}\z/', $currency)) {
			throw new InvalidArgumentException('wooptions-pro_invalid_currency');
		}
	}

	public static function from_minor(int $minor, string $currency, int $scale = 2): self {
		return new self($minor, strtoupper($currency), $scale);
	}

	public static function from_decimal(string|int $amount, string $currency, int $scale = 2): self {
		$decimal = Decimal::from_string($amount);
		$divisor = 10 ** (Decimal::SCALE - $scale);
		$raw     = $decimal->raw();
		$sign    = $raw < 0 ? -1 : 1;
		$abs     = abs($raw);
		$minor   = intdiv($abs, $divisor);
		$remain  = $abs % $divisor;

		if ($remain >= intdiv($divisor, 2) + ($divisor % 2)) {
			++$minor;
		}

		return new self($minor * $sign, strtoupper($currency), $scale);
	}

	public function minor(): int {
		return $this->minor;
	}

	public function currency(): string {
		return $this->currency;
	}

	public function scale(): int {
		return $this->scale;
	}

	public function add(self $other): self {
		$this->assert_same_currency($other);
		return new self($this->minor + $other->minor, $this->currency, $this->scale);
	}

	public function subtract(self $other): self {
		$this->assert_same_currency($other);
		return new self($this->minor - $other->minor, $this->currency, $this->scale);
	}

	public function multiply_integer(int $quantity): self {
		return new self($this->minor * $quantity, $this->currency, $this->scale);
	}

	public function percentage(string|int $percent): self {
		$ratio   = Decimal::from_string($percent)->divide(Decimal::from_int(100));
		$current = Decimal::from_raw($this->minor * (10 ** (Decimal::SCALE - $this->scale)));
		return self::from_decimal($current->multiply($ratio)->to_string(false), $this->currency, $this->scale);
	}

	public function to_decimal(): string {
		$factor   = 10 ** $this->scale;
		$negative = $this->minor < 0;
		$absolute = abs($this->minor);
		$integer  = intdiv($absolute, $factor);
		$fraction = str_pad((string) ($absolute % $factor), $this->scale, '0', STR_PAD_LEFT);

		return ($negative ? '-' : '') . $integer . ($this->scale > 0 ? '.' . $fraction : '');
	}

	/**
	 * @return array{minor:int,decimal:string,currency:string,scale:int}
	 */
	public function to_array(): array {
		return [
			'minor'    => $this->minor,
			'decimal'  => $this->to_decimal(),
			'currency' => $this->currency,
			'scale'    => $this->scale,
		];
	}

	private function assert_same_currency(self $other): void {
		if ($this->currency !== $other->currency || $this->scale !== $other->scale) {
			throw new InvalidArgumentException('wooptions-pro_money_currency_mismatch');
		}
	}
}
