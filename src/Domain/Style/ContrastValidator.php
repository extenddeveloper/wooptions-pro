<?php
/**
 * WCAG contrast calculations.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Domain\Style;

final class ContrastValidator {
	public function ratio(string $foreground, string $background): ?float {
		$foreground_rgb = $this->rgb($foreground);
		$background_rgb = $this->rgb($background);
		if (null === $foreground_rgb || null === $background_rgb) {
			return null;
		}

		$lighter = max($this->luminance($foreground_rgb), $this->luminance($background_rgb));
		$darker  = min($this->luminance($foreground_rgb), $this->luminance($background_rgb));
		return ($lighter + 0.05) / ($darker + 0.05);
	}

	public function passes(string $foreground, string $background, float $minimum = 4.5): bool {
		$ratio = $this->ratio($foreground, $background);
		return null !== $ratio && $ratio >= $minimum;
	}

	public function suggested_on_color(string $background): string {
		$black = $this->ratio('#000000', $background) ?? 0.0;
		$white = $this->ratio('#FFFFFF', $background) ?? 0.0;
		return $white >= $black ? '#FFFFFF' : '#000000';
	}

	/**
	 * @return array{0:int,1:int,2:int}|null
	 */
	private function rgb(string $hex): ?array {
		$hex = strtoupper(trim($hex));
		if (1 !== preg_match('/\A#([0-9A-F]{6})\z/', $hex, $matches)) {
			return null;
		}
		return [
			hexdec(substr($matches[1], 0, 2)),
			hexdec(substr($matches[1], 2, 2)),
			hexdec(substr($matches[1], 4, 2)),
		];
	}

	/**
	 * @param array{0:int,1:int,2:int} $rgb RGB.
	 */
	private function luminance(array $rgb): float {
		$channels = array_map(
			static function (int $channel): float {
				$value = $channel / 255;
				return $value <= 0.04045
					? $value / 12.92
					: (($value + 0.055) / 1.055) ** 2.4;
			},
			$rgb
		);
		return (0.2126 * $channels[0]) + (0.7152 * $channels[1]) + (0.0722 * $channels[2]);
	}
}
