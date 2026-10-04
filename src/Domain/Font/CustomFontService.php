<?php
/**
 * Custom Font Service.
 *
 * Handles WordPress font upload MIME types, custom font retrieval,
 * and @font-face CSS generation for admin and storefront.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Domain\Font;

use WooptionsFic\Bootstrap\Settings;

final class CustomFontService {
	public static function register(): void {
		add_filter('upload_mimes', [self::class, 'filter_upload_mimes']);
		add_filter('wp_check_filetype_and_ext', [self::class, 'filter_filetype_and_ext'], 10, 4);
	}

	/**
	 * Allow font MIME types in WordPress media uploader.
	 *
	 * @param array<string, string> $mimes Allowed MIME types.
	 * @return array<string, string>
	 */
	public static function filter_upload_mimes(array $mimes): array {
		$mimes['woff2'] = 'font/woff2';
		$mimes['woff']  = 'font/woff';
		$mimes['ttf']   = 'font/ttf';
		$mimes['otf']   = 'font/otf';
		$mimes['eot']   = 'application/vnd.ms-fontobject';
		return $mimes;
	}

	/**
	 * Ensure font files pass WordPress filetype and extension verification.
	 *
	 * @param array<string, mixed> $data     File data.
	 * @param string               $file     Full path to the file.
	 * @param string               $filename Filename.
	 * @param array<string, mixed> $mimes    Mime types.
	 * @return array<string, mixed>
	 */
	public static function filter_filetype_and_ext(array $data, string $file, string $filename, ?array $mimes): array {
		if (empty($data['ext']) && '' !== $filename) {
			$ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
			if (in_array($ext, ['woff', 'woff2', 'ttf', 'otf', 'eot'], true)) {
				$type = match ($ext) {
					'woff2' => 'font/woff2',
					'woff'  => 'font/woff',
					'ttf'   => 'font/ttf',
					'otf'   => 'font/otf',
					'eot'   => 'application/vnd.ms-fontobject',
					default => 'font/' . $ext,
				};
				$data['ext']             = $ext;
				$data['type']            = $type;
				$data['proper_filename'] = $filename;
			}
		}
		return $data;
	}

	/**
	 * Retrieve all saved custom fonts from Settings.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function get_custom_fonts(): array {
		$raw = Settings::get('custom_fonts', []);
		if (! is_array($raw)) {
			return [];
		}

		$fonts = [];
		foreach ($raw as $item) {
			if (! is_array($item) || empty($item['name'])) {
				continue;
			}
			$name   = trim((string) $item['name']);
			$id     = ! empty($item['id']) ? sanitize_key((string) $item['id']) : sanitize_title($name);
			$family = ! empty($item['family']) ? trim((string) $item['family']) : "'" . $name . "', sans-serif";
			$weight = ! empty($item['weight']) ? (string) $item['weight'] : '400';
			$style  = ! empty($item['style']) && in_array($item['style'], ['normal', 'italic'], true) ? (string) $item['style'] : 'normal';
			$raw_files = is_array($item['files'] ?? null) ? $item['files'] : [];
			$files     = [];
			foreach ($raw_files as $fmt => $furl) {
				if (is_string($furl)) {
					$files[$fmt] = self::normalize_url($furl);
				}
			}

			$fonts[] = [
				'id'          => $id,
				'name'        => $name,
				'family'      => $family,
				'category'    => 'Custom',
				'source'      => 'custom',
				'googleParam' => null,
				'weight'      => $weight,
				'style'       => $style,
				'files'       => $files,
			];
		}

		return $fonts;
	}

	/**
	 * Normalize font URL to match HTTPS scheme when page is served over SSL.
	 */
	public static function normalize_url(string $url): string {
		$url = esc_url_raw(trim($url));
		if ('' === $url) {
			return '';
		}
		if (is_ssl() || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && 'https' === $_SERVER['HTTP_X_FORWARDED_PROTO']) || str_starts_with(home_url(), 'https://') || (isset($_SERVER['HTTPS']) && 'off' !== $_SERVER['HTTPS'])) {
			$url = (string) preg_replace('/^http:\/\//i', 'https://', $url);
		}
		return (string) set_url_scheme($url);
	}

	/**
	 * Generate @font-face CSS for all or specific custom fonts.
	 *
	 * @param array<int, array<string, mixed>>|null $fonts Optional list of fonts; defaults to all saved.
	 * @return string
	 */
	public static function generate_font_face_css(?array $fonts = null): string {
		$fonts = $fonts ?? self::get_custom_fonts();
		if (empty($fonts)) {
			return '';
		}

		$css = '';
		foreach ($fonts as $font) {
			$files = is_array($font['files'] ?? null) ? $font['files'] : [];
			if (empty($files)) {
				continue;
			}

			$sources = [];
			// WOFF2
			if (! empty($files['woff2'])) {
				$url       = self::normalize_url((string) $files['woff2']);
				$sources[] = "url('" . $url . "') format('woff2')";
				$sources[] = "url('" . $url . "')";
			}
			// WOFF
			if (! empty($files['woff'])) {
				$url       = self::normalize_url((string) $files['woff']);
				$sources[] = "url('" . $url . "') format('woff')";
				$sources[] = "url('" . $url . "')";
			}
			// TTF
			if (! empty($files['ttf'])) {
				$url       = self::normalize_url((string) $files['ttf']);
				$sources[] = "url('" . $url . "') format('truetype')";
				$sources[] = "url('" . $url . "') format('opentype')";
				$sources[] = "url('" . $url . "')";
			}
			// OTF (Support both OpenType CFF and TrueType outlines, plus direct URL fallback)
			if (! empty($files['otf'])) {
				$url       = self::normalize_url((string) $files['otf']);
				$sources[] = "url('" . $url . "') format('opentype')";
				$sources[] = "url('" . $url . "') format('truetype')";
				$sources[] = "url('" . $url . "')";
			}

			if (empty($sources)) {
				continue;
			}

			$clean_family = trim(explode(',', (string) ($font['family'] ?? $font['name']))[0], " \t\n\r\0\x0B'\"");
			$style        = ! empty($font['style']) ? esc_attr((string) $font['style']) : 'normal';

			// Range 100-900 allows elements styled as 400, 500, 600, or 700 to display the font
			$css .= "@font-face {\n";
			$css .= "  font-family: '" . esc_attr($clean_family) . "';\n";
			$css .= "  src: " . implode(",\n       ", $sources) . ";\n";
			$css .= "  font-weight: 100 900;\n";
			$css .= "  font-style: " . $style . ";\n";
			$css .= "  font-display: swap;\n";
			$css .= "}\n";

			// Also output unquoted family declaration for browsers looking up raw identifier
			if (str_contains($clean_family, ' ')) {
				$css .= "@font-face {\n";
				$css .= "  font-family: " . esc_attr($clean_family) . ";\n";
				$css .= "  src: " . implode(",\n       ", $sources) . ";\n";
				$css .= "  font-weight: 100 900;\n";
				$css .= "  font-style: " . $style . ";\n";
				$css .= "  font-display: swap;\n";
				$css .= "}\n";
			}
		}

		return $css;
	}
}
