<?php
/**
 * Bounded plugin settings.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Bootstrap;

final class Settings {
	public const OPTION = 'wooptionsfic_settings';

	/**
	 * @return array<string, mixed>
	 */
	public static function defaults(): array {
		return [
			'analytics_enabled'          => true,
			'analytics_retention_days'   => 395,
			'upload_max_file_mb'         => 5,
			'upload_max_total_mb'        => 15,
			'upload_allowed_extensions'  => ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
			'abandoned_upload_hours'     => 24,
			'saved_config_expiry_days'   => 90,
			'share_link_expiry_days'     => 30,
			'allow_negative_total'       => false,
			'default_palette'            => 'iris-studio',
			'delete_data_on_uninstall'   => false,
			'admin_theme'                => 'system',
			'formula_operation_limit'    => 500,
			'rule_node_limit'            => 500,
			'max_fields'                 => 200,
			'max_choices'                => 1000,
			'max_repeater_rows'          => 25,
			'quote_rate_limit_per_minute'=> 60,
			'cleanup_unplaced_upload_days' => 0,
			'cleanup_placed_upload_days'   => 0,
			'cleanup_completed_upload_days'=> 0,
			'enable_addons_total_text'     => false,
			'addons_total_text'            => 'Total Price',
			'enable_summary_status_text'   => false,
			'summary_status_text'          => 'Ready for your choices',
			'enable_summary_notice_text'   => false,
			'summary_notice_text'          => 'Server-confirmed total, before shipping.',
			'hide_addon_in_cart'           => false,
			'hide_addon_in_checkout'       => false,
			'custom_fonts'                 => [],
		];
	}

	/**
	 * @return array<string, mixed>
	 */
	public static function all(): array {
		$value = get_option(self::OPTION, []);
		if (! is_array($value)) {
			$value = [];
		}
		$merged = array_replace(self::defaults(), $value);
		if (! empty($merged['custom_fonts']) && is_array($merged['custom_fonts'])) {
			$is_ssl = is_ssl() || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && 'https' === $_SERVER['HTTP_X_FORWARDED_PROTO']) || str_starts_with(home_url(), 'https://') || (isset($_SERVER['HTTPS']) && 'off' !== $_SERVER['HTTPS']);
			if ($is_ssl) {
				foreach ($merged['custom_fonts'] as &$cfont) {
					if (! empty($cfont['files']) && is_array($cfont['files'])) {
						foreach ($cfont['files'] as &$cf_url) {
							if (is_string($cf_url)) {
								$cf_url = preg_replace('/^http:\/\//i', 'https://', $cf_url);
							}
						}
						unset($cf_url);
					}
				}
				unset($cfont);
			}
		}
		return $merged;
	}

	public static function get(string $key, mixed $fallback = null): mixed {
		$settings = self::all();
		return $settings[$key] ?? $fallback;
	}

	/**
	 * @param array<string, mixed> $input Raw settings.
	 * @return array<string, mixed>
	 */
	public static function sanitize(array $input): array {
		$current = self::all();

		$boolean_keys = [
			'analytics_enabled',
			'allow_negative_total',
			'delete_data_on_uninstall',
			'enable_addons_total_text',
			'enable_summary_status_text',
			'enable_summary_notice_text',
			'hide_addon_in_cart',
			'hide_addon_in_checkout',
		];

		foreach ($boolean_keys as $boolean_key) {
			if (array_key_exists($boolean_key, $input)) {
				$current[$boolean_key] = ! empty($input[$boolean_key]);
			}
		}

		$integer_bounds = [
			'analytics_retention_days'    => [30, 1095],
			'upload_max_file_mb'          => [1, 50],
			'upload_max_total_mb'         => [1, 200],
			'abandoned_upload_hours'      => [1, 168],
			'saved_config_expiry_days'    => [1, 3650],
			'share_link_expiry_days'      => [1, 365],
			'formula_operation_limit'     => [50, 2000],
			'rule_node_limit'             => [25, 2000],
			'max_fields'                  => [10, 500],
			'max_choices'                 => [10, 5000],
			'max_repeater_rows'           => [1, 100],
			'quote_rate_limit_per_minute' => [10, 300],
			'cleanup_unplaced_upload_days'=> [0, 3650],
			'cleanup_placed_upload_days'  => [0, 3650],
			'cleanup_completed_upload_days'=> [0, 3650],
		];

		foreach ($integer_bounds as $key => [$minimum, $maximum]) {
			$value         = absint($input[$key] ?? $current[$key]);
			$current[$key] = max($minimum, min($maximum, $value));
		}

		foreach (['addons_total_text', 'summary_status_text', 'summary_notice_text'] as $text_key) {
			if (array_key_exists($text_key, $input)) {
				$current[$text_key] = sanitize_text_field((string) $input[$text_key]);
			}
		}

		$allowed_extensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'txt', 'csv'];
		$extensions         = $input['upload_allowed_extensions'] ?? $current['upload_allowed_extensions'];
		if (is_string($extensions)) {
			$extensions = preg_split('/[\s,]+/', $extensions) ?: [];
		}
		$extensions = array_values(
			array_intersect(
				$allowed_extensions,
				array_unique(array_map('sanitize_key', (array) $extensions))
			)
		);
		$current['upload_allowed_extensions'] = $extensions ?: ['jpg', 'jpeg', 'png', 'pdf'];

		$palettes = array_keys((array) require WOOPTIONSFIC_PATH . 'config/style-presets.php');
		$palette  = sanitize_key((string) ($input['default_palette'] ?? $current['default_palette']));
		$current['default_palette'] = in_array($palette, $palettes, true) ? $palette : 'iris-studio';

		$theme = sanitize_key((string) ($input['admin_theme'] ?? $current['admin_theme']));
		$current['admin_theme'] = in_array($theme, ['system', 'light', 'dark'], true) ? $theme : 'system';

		if (isset($input['custom_fonts']) && is_array($input['custom_fonts'])) {
			$sanitized_fonts = [];
			foreach ($input['custom_fonts'] as $font) {
				if (! is_array($font) || empty($font['name'])) {
					continue;
				}
				$name = sanitize_text_field((string) $font['name']);
				if ('' === $name) {
					continue;
				}
				$id        = ! empty($font['id']) ? sanitize_key((string) $font['id']) : sanitize_title($name);
				$raw_files = is_array($font['files'] ?? null) ? $font['files'] : [];
				$files     = [];
				foreach (['woff2', 'woff', 'ttf', 'otf'] as $fmt) {
					if (! empty($raw_files[$fmt])) {
						$files[$fmt] = esc_url_raw((string) $raw_files[$fmt]);
					}
				}
				if (empty($files)) {
					continue;
				}
				$sanitized_fonts[] = [
					'id'       => $id,
					'name'     => $name,
					'family'   => "'" . $name . "', sans-serif",
					'category' => 'Custom',
					'source'   => 'custom',
					'weight'   => sanitize_text_field((string) ($font['weight'] ?? '400')),
					'style'    => in_array($font['style'] ?? '', ['normal', 'italic'], true) ? (string) $font['style'] : 'normal',
					'files'    => $files,
				];
			}
			$current['custom_fonts'] = $sanitized_fonts;
		}

		return $current;
	}

	public static function install_defaults(): void {
		if (false === get_option(self::OPTION, false)) {
			add_option(self::OPTION, self::defaults(), '', false);
		}
	}
}
