<?php
/**
 * Semantic storefront palette resolution.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Domain\Style;

final class PaletteRegistry {
	/** @var array<string, array<string,mixed>> */
	private array $palettes;

	/**
	 * @param array<string, array<string,mixed>> $palettes Presets.
	 */
	public function __construct(array $palettes, private readonly ContrastValidator $contrast) {
		$this->palettes = $palettes;
	}

	/**
	 * @return array<string, array<string,mixed>>
	 */
	public function all(): array {
		$palettes = $this->palettes;
		if (function_exists('did_action') && did_action('init')) {
			foreach ($palettes as &$palette) {
				if (isset($palette['name']) && is_string($palette['name'])) {
					$palette['name'] = translate($palette['name'], 'wooptions-pro');
				}
			}
			unset($palette);
		}
		return $palettes;
	}

	/**
	 * @param array<string, mixed> $style Style definition.
	 * @return array{palette:string,tokens:array<string,string>,typography:array<string,mixed>,errors:list<array<string,mixed>>,warnings:list<array<string,mixed>>}
	 */
	public function resolve(array $style): array {
		$palette_key = (string) ($style['palette'] ?? 'iris-studio');
		if (! isset($this->palettes[$palette_key])) {
			$palette_key = 'iris-studio';
		}
		$tokens    = (array) ($this->palettes[$palette_key]['tokens'] ?? []);
		$overrides = is_array($style['overrides'] ?? null) ? $style['overrides'] : (is_array($style['tokens'] ?? null) ? $style['tokens'] : []);
		$errors    = [];
		$warnings  = [];

		foreach ($overrides as $key => $value) {
			if (! array_key_exists($key, $tokens) || ! is_string($value)) {
				continue;
			}
			$value = trim($value);
			if (1 !== preg_match('/\A#[0-9A-Fa-f]{6}\z/', $value)) {
				$errors[] = ['code' => 'invalid_style_token', 'token' => (string) $key];
				continue;
			}
			$tokens[$key] = strtoupper($value);
		}

		if ('theme-native' !== $palette_key) {
			foreach ([
				['onPrimary', 'primary', 4.5],
				['text', 'background', 4.5],
				['text', 'surface', 4.5],
				['focus', 'background', 3.0],
				['danger', 'surface', 3.0],
			] as [$foreground, $background, $minimum]) {
				$ratio = $this->contrast->ratio((string) ($tokens[$foreground] ?? ''), (string) ($tokens[$background] ?? ''));
				if (null === $ratio || $ratio < $minimum) {
					$warnings[] = [
						'code'       => 'insufficient_contrast',
						'foreground' => $foreground,
						'background' => $background,
						'ratio'      => null === $ratio ? null : round($ratio, 2),
						'minimum'    => $minimum,
						'suggestion' => $this->contrast->suggested_on_color((string) ($tokens[$background] ?? '#FFFFFF')),
					];
				}
			}
		}

		$typography = $this->sanitize_typography((array) ($style['typography'] ?? []));

		return [
			'palette'    => $palette_key,
			'tokens'     => array_map('strval', $tokens),
			'typography' => $typography,
			'errors'     => $errors,
			'warnings'   => $warnings,
		];
	}

	/**
	 * @param array<string, mixed> $input Typography.
	 * @return array<string, mixed>
	 */
	private function sanitize_typography(array $input): array {
		$allowed_families = [
			'inherit', 'system-ui', 'Inter', 'Manrope', 'Poppins', 'Outfit',
			'Plus Jakarta Sans', 'Roboto',
		];
		$family = (string) ($input['family'] ?? 'inherit');
		if (! in_array($family, $allowed_families, true)) {
			$family = 'inherit';
		}

		return [
			'family'      => $family,
			'labelWeight' => max(400, min(800, (int) ($input['labelWeight'] ?? 600))),
			'bodyWeight'  => max(300, min(700, (int) ($input['bodyWeight'] ?? 400))),
			'desktopSize' => max(16, min(24, (int) ($input['desktopSize'] ?? 16))),
			'tabletSize'  => max(16, min(24, (int) ($input['tabletSize'] ?? 16))),
			'mobileSize'  => max(16, min(24, (int) ($input['mobileSize'] ?? 16))),
			'lineHeight'  => max(1.2, min(2.0, (float) ($input['lineHeight'] ?? 1.5))),
		];
	}
}
