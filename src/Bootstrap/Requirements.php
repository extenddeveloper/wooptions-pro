<?php
/**
 * Runtime and WooCommerce requirements.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Bootstrap;

final class Requirements {
	public const MIN_PHP = '8.1';
	public const MIN_WP  = '6.9';
	public const MIN_WC  = '9.0';

	public static function runtime_is_supported(): bool {
		global $wp_version;

		return version_compare(PHP_VERSION, self::MIN_PHP, '>=')
			&& is_string($wp_version)
			&& version_compare($wp_version, self::MIN_WP, '>=');
	}

	public static function woocommerce_is_available(): bool {
		if (! class_exists('WooCommerce')) {
			return false;
		}

		if (! defined('WC_VERSION')) {
			return false;
		}

		return version_compare((string) WC_VERSION, self::MIN_WC, '>=');
	}

	public static function register_runtime_notice(): void {
		add_action(
			'admin_notices',
			static function (): void {
				global $wp_version;

				$message = sprintf(
					/* translators: 1: PHP version, 2: WordPress version. */
					__('WooOptions Pro requires PHP %1$s or newer and WordPress %2$s or newer. The plugin has not loaded.', 'wooptions-pro'),
					self::MIN_PHP,
					self::MIN_WP
				);

				if (version_compare(PHP_VERSION, self::MIN_PHP, '<')) {
					$message .= ' ' . sprintf(
						/* translators: %s: current PHP version. */
						__('This site is running PHP %s.', 'wooptions-pro'),
						PHP_VERSION
					);
				} elseif (is_string($wp_version)) {
					$message .= ' ' . sprintf(
						/* translators: %s: current WordPress version. */
						__('This site is running WordPress %s.', 'wooptions-pro'),
						$wp_version
					);
				}

				echo '<div class="notice notice-error"><p>' . esc_html($message) . '</p></div>';
			}
		);
	}

	public static function register_woocommerce_notice(): void {
		add_action(
			'admin_notices',
			static function (): void {
				if (! current_user_can('activate_plugins')) {
					return;
				}

				$message = class_exists('WooCommerce') && defined('WC_VERSION')
					? sprintf(
						/* translators: 1: required WooCommerce version, 2: detected version. */
						__('WooOptions Pro requires WooCommerce %1$s or newer. Version %2$s is active, so commerce features are paused.', 'wooptions-pro'),
						self::MIN_WC,
						(string) WC_VERSION
					)
					: __('WooOptions Pro needs WooCommerce to render options and process configured products. Install and activate WooCommerce to enable commerce features.', 'wooptions-pro');

				echo '<div class="notice notice-warning"><p>' . esc_html($message) . '</p></div>';
			}
		);
	}

	public static function assert_activation_requirements(): void {
		global $wp_version;

		if (version_compare(PHP_VERSION, self::MIN_PHP, '<')) {
			wp_die(
				esc_html(
					sprintf(
						/* translators: %s: minimum PHP version. */
						__('WooOptions Pro requires PHP %s or newer.', 'wooptions-pro'),
						self::MIN_PHP
					)
				),
				esc_html__('Plugin activation failed', 'wooptions-pro'),
				['back_link' => true]
			);
		}

		if (! is_string($wp_version) || version_compare($wp_version, self::MIN_WP, '<')) {
			wp_die(
				esc_html(
					sprintf(
						/* translators: %s: minimum WordPress version. */
						__('WooOptions Pro requires WordPress %s or newer.', 'wooptions-pro'),
						self::MIN_WP
					)
				),
				esc_html__('Plugin activation failed', 'wooptions-pro'),
				['back_link' => true]
			);
		}
	}
}
