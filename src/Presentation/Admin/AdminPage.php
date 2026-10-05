<?php
/**
 * WordPress-native administration shell.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Presentation\Admin;

use WooOptionsPro\Bootstrap\Requirements;
use WooOptionsPro\Bootstrap\Settings;
use WooOptionsPro\Domain\Font\CustomFontService;

final class AdminPage {
	private string $hook_suffix = '';

	public function register_menu(): void {
		$this->hook_suffix = (string) add_menu_page(
			__('WooOptions Pro', 'wooptions-pro'),
			__('WooOptions Pro', 'wooptions-pro'),
			'manage_wooptions-pro',
			'wooptions-pro',
			[$this, 'render'],
			'dashicons-screenoptions',
			56
		);

		$items = [
			['dashboard', __('Dashboard', 'wooptions-pro'), 'manage_wooptions-pro'],
			['option-sets', __('Option Sets', 'wooptions-pro'), 'edit_wooptions-pro_sets'],
			['templates', __('Templates', 'wooptions-pro'), 'edit_wooptions-pro_sets'],
			['analytics', __('Analytics', 'wooptions-pro'), 'view_wooptions-pro_analytics'],
			['settings', __('Settings', 'wooptions-pro'), 'manage_wooptions-pro_settings'],
		];
		foreach ($items as [$route, $label, $capability]) {
			$slug = 'dashboard' === $route ? 'wooptions-pro' : 'wooptions-pro-' . $route;
			add_submenu_page(
				'wooptions-pro',
				$label,
				$label,
				$capability,
				$slug,
				[$this, 'render']
			);
		}
	}

	public function enqueue(string $hook_suffix): void {
		if ($hook_suffix !== $this->hook_suffix && ! str_contains($hook_suffix, 'wooptions-pro')) {
			return;
		}
		$asset = WOOPTIONS_PRO_PATH . 'build/admin.asset.php';
		$meta  = is_readable($asset) ? require $asset : ['dependencies' => [], 'version' => WOOPTIONS_PRO_VERSION];
		wp_enqueue_media();
		if (function_exists('wp_enqueue_editor')) {
			wp_enqueue_editor();
		} elseif (file_exists(ABSPATH . WPINC . '/class-wp-editor.php')) {
			require_once ABSPATH . WPINC . '/class-wp-editor.php';
			if (class_exists('\_WP_Editors')) {
				\_WP_Editors::enqueue_default_editor();
			}
		}
		wp_enqueue_script('editor');
		wp_enqueue_script('quicktags');
		wp_enqueue_script('wp-tinymce');
		wp_enqueue_style('editor-buttons');
		wp_enqueue_script(
			'wooptions-pro-admin',
			WOOPTIONS_PRO_URL . 'build/admin.js',
			(array) ($meta['dependencies'] ?? []),
			(string) ($meta['version'] ?? WOOPTIONS_PRO_VERSION),
			true
		);
		wp_enqueue_style('wp-components');

		// Load the selectable typography families in the builder so the live
		// product canvas shows the real typeface instead of a synthesized fallback.
		$font_families = [
			'Inter:wght@300;400;500;600;700;800',
			'Manrope:wght@300;400;500;600;700;800',
			'Outfit:wght@300;400;500;600;700;800',
			'Plus Jakarta Sans:wght@300;400;500;600;700;800',
			'Poppins:wght@300;400;500;600;700;800',
			'Roboto:wght@300;400;500;600;700;800',
		];
		$font_query = implode(
			'&',
			array_map(
				static function (string $family): string {
					$encoded = rawurlencode($family);
					$encoded = str_replace(
						['%20', '%3A', '%40', '%3B'],
						['+', ':', '@', ';'],
						$encoded
					);
					return 'family=' . $encoded;
				},
				$font_families
			)
		);
		$font_url = 'https://fonts.googleapis.com/css2?' . $font_query . '&display=swap';
		wp_enqueue_style('wooptions-pro-builder-fonts', $font_url, [], null);

		wp_enqueue_style(
			'wooptions-pro-admin',
			WOOPTIONS_PRO_URL . 'build/admin.css',
			['wp-components', 'wooptions-pro-builder-fonts'],
			(string) ($meta['version'] ?? WOOPTIONS_PRO_VERSION)
		);
		wp_set_script_translations('wooptions-pro-admin', 'wooptions-pro', WOOPTIONS_PRO_PATH . 'languages');

		$field_types  = require WOOPTIONS_PRO_PATH . 'config/field-types.php';
		$palettes     = require WOOPTIONS_PRO_PATH . 'config/style-presets.php';
		$font_catalog = file_exists(WOOPTIONS_PRO_PATH . 'config/fonts.php') ? require WOOPTIONS_PRO_PATH . 'config/fonts.php' : [];
		$custom_fonts = CustomFontService::get_custom_fonts();
		if (! empty($custom_fonts) && is_array($font_catalog)) {
			$font_catalog = array_merge($custom_fonts, $font_catalog);
		}
		$custom_fonts_css = CustomFontService::generate_font_face_css();
		if ('' !== $custom_fonts_css) {
			wp_add_inline_style('wooptions-pro-admin', $custom_fonts_css);
			add_action('admin_head', static function () use ($custom_fonts_css): void {
				echo '<style id="wooptions-pro-custom-fonts-admin">' . $custom_fonts_css . '</style>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			});
		}

		$page         = isset($_GET['page']) ? sanitize_key(wp_unslash($_GET['page'])) : 'wooptions-pro'; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$initial_route= 'wooptions-pro-license' === $page ? 'license' : ('wooptions-pro' === $page ? 'dashboard' : str_replace('wooptions-pro-', '', $page));
		wp_add_inline_script(
			'wooptions-pro-admin',
			'window.WooOptionsProAdmin=' . wp_json_encode(
				[
					'restRoot'      => esc_url_raw(rest_url('wooptions-pro/v1/')),
					'nonce'         => wp_create_nonce('wp_rest'),
					'version'       => WOOPTIONS_PRO_VERSION,
					'initialRoute'  => $initial_route,
					'fieldTypes'    => is_array($field_types) ? $field_types : [],
					'palettes'      => is_array($palettes) ? $palettes : [],
					'fontCatalog'   => is_array($font_catalog) ? $font_catalog : [],
					'settings'      => Settings::all(),
					'license'       => [
						'active'         => class_exists('\WooOptionsPro\License\LicenseManager') ? \WooOptionsPro\License\LicenseManager::is_active() : true,
						'canConfigure'   => class_exists('\WooOptionsPro\License\LicenseGate') ? \WooOptionsPro\License\LicenseGate::can_configure() : true,
						'state'          => class_exists('\WooOptionsPro\License\LicenseGate') ? \WooOptionsPro\License\LicenseGate::state() : 'active',
						'message'        => class_exists('\WooOptionsPro\License\LicenseGate') ? \WooOptionsPro\License\LicenseGate::locked_message() : '',
						'key'            => class_exists('\WooOptionsPro\License\LicenseManager') ? \WooOptionsPro\License\LicenseManager::get_masked_key() : '',
						'expires'        => class_exists('\WooOptionsPro\License\LicenseManager') ? \WooOptionsPro\License\LicenseManager::get_expiry() : '',
						'licenseTitle'   => class_exists('\WooOptionsPro\License\LicenseManager') ? \WooOptionsPro\License\LicenseManager::get_license_title() : 'Unlimited Site (Lifetime)',
						'supportExpires' => class_exists('\WooOptionsPro\License\LicenseManager') ? \WooOptionsPro\License\LicenseManager::get_support_expiry() : 'Unlimited',
						'accountUrl'     => 'https://portal.themefic.com/my-account/',
						'purchaseUrl'    => 'https://themefic.com/plugins/woooptions-pro/',
						'licenseUrl'     => admin_url('admin.php?page=wooptions-pro-license'),
						'ajaxUrl'        => admin_url('admin-ajax.php'),
						'nonce'          => wp_create_nonce('wooptions_pro_license_nonce'),
					],
					'wooAvailable'  => Requirements::woocommerce_is_available(),
					'currency'        => Requirements::woocommerce_is_available() && function_exists('get_woocommerce_currency') ? (string) get_woocommerce_currency() : 'USD',
					'currencySymbol'  => Requirements::woocommerce_is_available() && function_exists('get_woocommerce_currency_symbol') ? html_entity_decode((string) get_woocommerce_currency_symbol(), ENT_QUOTES, 'UTF-8') : '$',
					'currencyPosition'=> Requirements::woocommerce_is_available() && function_exists('get_option') ? (string) get_option('woocommerce_currency_pos', 'left_space') : 'left_space',
					'currentUser'   => [
						'id'   => get_current_user_id(),
						'name' => wp_get_current_user()->display_name,
					],
					'urls'          => [
						'products'  => admin_url('edit.php?post_type=product'),
						'siteHealth'=> admin_url('site-health.php'),
						'license'   => admin_url('admin.php?page=wooptions-pro-license'),
					],
					'pluginUrl'     => WOOPTIONS_PRO_URL,
					'assetsUrl'     => WOOPTIONS_PRO_URL . 'assets/',
				],
				JSON_UNESCAPED_SLASHES
			) . ';',
			'before'
		);
	}

	public function render(): void {
		if (! current_user_can('manage_options') && ! current_user_can('manage_woocommerce') && ! current_user_can('manage_wooptions-pro')) {
			wp_die(esc_html__('You do not have permission to manage WooOptions Pro.', 'wooptions-pro'));
		}
		echo '<div class="wrap wof-admin-wrap">';
		echo '<div id="wooptions-pro-admin-root">';
		echo '<div class="wof-admin-loading"><span class="spinner is-active"></span><p>' . esc_html__('Opening your option workshop…', 'wooptions-pro') . '</p></div>';
		echo '</div>';
		// Preload WP Editor / TinyMCE scripts, quicktags, media buttons, and templates for dynamic React editor instances.
		if (function_exists('wp_editor')) {
			echo '<div style="display:none;" aria-hidden="true">';
			wp_editor('', 'wof_admin_dummy_editor', [
				'tinymce'       => true,
				'quicktags'     => true,
				'media_buttons' => true,
			]);
			echo '</div>';
		}
		echo '<noscript><div class="notice notice-error"><p>' . esc_html__('WooOptions Pro’s administration builder requires JavaScript. Storefront basic fields still have a server-rendered fallback.', 'wooptions-pro') . '</p></div></noscript>';
		echo '</div>';
	}

	public function activated_notice(): void {
		if (! get_transient('wooptions-pro_activated') || (! current_user_can('manage_options') && ! current_user_can('manage_woocommerce') && ! current_user_can('manage_wooptions-pro'))) {
			return;
		}
		delete_transient('wooptions-pro_activated');
		echo '<div class="notice notice-success is-dismissible"><p>';
		echo wp_kses_post(
			sprintf(
				/* translators: %s: plugin admin URL. */
				__('WooOptions Pro is ready. <a href="%s">Open the Precision Workshop</a> to import a template or build your first option set.', 'wooptions-pro'),
				esc_url(admin_url('admin.php?page=wooptions-pro#/templates'))
			)
		);
		echo '</p></div>';
	}

	public function admin_body_class(string $classes): string {
		$screen = function_exists('get_current_screen') ? get_current_screen() : null;
		if ($screen && (str_contains((string) $screen->id, 'wooptions-pro') || str_contains((string) $screen->base, 'wooptions-pro'))) {
			$classes .= ' wooptions-pro-admin-page';
		} elseif (isset($_GET['page']) && str_starts_with((string) $_GET['page'], 'wooptions-pro')) {
			$classes .= ' wooptions-pro-admin-page';
		}
		return $classes;
	}
}

