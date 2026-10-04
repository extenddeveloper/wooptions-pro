<?php
/**
 * WordPress-native administration shell.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Presentation\Admin;

use WooptionsFic\Bootstrap\Requirements;
use WooptionsFic\Bootstrap\Settings;
use WooptionsFic\Domain\Font\CustomFontService;

final class AdminPage {
	private string $hook_suffix = '';

	public function register_menu(): void {
		$this->hook_suffix = (string) add_menu_page(
			__('WooptionsFic', 'wooptionsfic'),
			__('WooptionsFic', 'wooptionsfic'),
			'manage_wooptionsfic',
			'wooptionsfic',
			[$this, 'render'],
			'dashicons-screenoptions',
			56
		);

		$items = [
			['dashboard', __('Dashboard', 'wooptionsfic'), 'manage_wooptionsfic'],
			['option-sets', __('Option Sets', 'wooptionsfic'), 'edit_wooptionsfic_sets'],
			['templates', __('Templates', 'wooptionsfic'), 'edit_wooptionsfic_sets'],
			['analytics', __('Analytics', 'wooptionsfic'), 'view_wooptionsfic_analytics'],
			['settings', __('Settings', 'wooptionsfic'), 'manage_wooptionsfic_settings'],
		];
		foreach ($items as [$route, $label, $capability]) {
			$slug = 'dashboard' === $route ? 'wooptionsfic' : 'wooptionsfic-' . $route;
			add_submenu_page(
				'wooptionsfic',
				$label,
				$label,
				$capability,
				$slug,
				[$this, 'render']
			);
		}
	}

	public function enqueue(string $hook_suffix): void {
		if ($hook_suffix !== $this->hook_suffix && ! str_contains($hook_suffix, 'wooptionsfic')) {
			return;
		}
		$asset = WOOPTIONSFIC_PATH . 'build/admin.asset.php';
		$meta  = is_readable($asset) ? require $asset : ['dependencies' => [], 'version' => WOOPTIONSFIC_VERSION];
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
			'wooptionsfic-admin',
			WOOPTIONSFIC_URL . 'build/admin.js',
			(array) ($meta['dependencies'] ?? []),
			(string) ($meta['version'] ?? WOOPTIONSFIC_VERSION),
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
		wp_enqueue_style('wooptionsfic-builder-fonts', $font_url, [], null);

		wp_enqueue_style(
			'wooptionsfic-admin',
			WOOPTIONSFIC_URL . 'build/admin.css',
			['wp-components', 'wooptionsfic-builder-fonts'],
			(string) ($meta['version'] ?? WOOPTIONSFIC_VERSION)
		);
		wp_set_script_translations('wooptionsfic-admin', 'wooptionsfic', WOOPTIONSFIC_PATH . 'languages');

		$field_types  = require WOOPTIONSFIC_PATH . 'config/field-types.php';
		$palettes     = require WOOPTIONSFIC_PATH . 'config/style-presets.php';
		$font_catalog = file_exists(WOOPTIONSFIC_PATH . 'config/fonts.php') ? require WOOPTIONSFIC_PATH . 'config/fonts.php' : [];
		$custom_fonts = CustomFontService::get_custom_fonts();
		if (! empty($custom_fonts) && is_array($font_catalog)) {
			$font_catalog = array_merge($custom_fonts, $font_catalog);
		}
		$custom_fonts_css = CustomFontService::generate_font_face_css();
		if ('' !== $custom_fonts_css) {
			wp_add_inline_style('wooptionsfic-admin', $custom_fonts_css);
			add_action('admin_head', static function () use ($custom_fonts_css): void {
				echo '<style id="wooptionsfic-custom-fonts-admin">' . $custom_fonts_css . '</style>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			});
		}

		$page         = isset($_GET['page']) ? sanitize_key(wp_unslash($_GET['page'])) : 'wooptionsfic'; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$initial_route= 'wooptionsfic' === $page ? 'dashboard' : str_replace('wooptionsfic-', '', $page);
		wp_add_inline_script(
			'wooptionsfic-admin',
			'window.WooptionsFicAdmin=' . wp_json_encode(
				[
					'restRoot'      => esc_url_raw(rest_url('wooptionsfic/v1/')),
					'nonce'         => wp_create_nonce('wp_rest'),
					'version'       => WOOPTIONSFIC_VERSION,
					'initialRoute'  => $initial_route,
					'fieldTypes'    => is_array($field_types) ? $field_types : [],
					'palettes'      => is_array($palettes) ? $palettes : [],
					'fontCatalog'   => is_array($font_catalog) ? $font_catalog : [],
					'settings'      => Settings::all(),
					'wooAvailable'  => Requirements::woocommerce_is_available(),
					'currency'        => Requirements::woocommerce_is_available() && function_exists('get_woocommerce_currency') ? (string) get_woocommerce_currency() : 'USD',
					'currencySymbol'  => Requirements::woocommerce_is_available() && function_exists('get_woocommerce_currency_symbol') ? html_entity_decode((string) get_woocommerce_currency_symbol(), ENT_QUOTES, 'UTF-8') : '$',
					'currencyPosition'=> Requirements::woocommerce_is_available() && function_exists('get_option') ? (string) get_option('woocommerce_currency_pos', 'left_space') : 'left_space',
					'currentUser'   => [
						'id'   => get_current_user_id(),
						'name' => wp_get_current_user()->display_name,
					],
					'urls'          => [
						'products' => admin_url('edit.php?post_type=product'),
						'siteHealth'=> admin_url('site-health.php'),
					],
					'pluginUrl'     => WOOPTIONSFIC_URL,
					'assetsUrl'     => WOOPTIONSFIC_URL . 'assets/',
				],
				JSON_UNESCAPED_SLASHES
			) . ';',
			'before'
		);
	}

	public function render(): void {
		if (! current_user_can('manage_wooptionsfic')) {
			wp_die(esc_html__('You do not have permission to manage WooptionsFic.', 'wooptionsfic'));
		}
		echo '<div class="wrap wof-admin-wrap">';
		echo '<div id="wooptionsfic-admin-root">';
		echo '<div class="wof-admin-loading"><span class="spinner is-active"></span><p>' . esc_html__('Opening your option workshop…', 'wooptionsfic') . '</p></div>';
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
		echo '<noscript><div class="notice notice-error"><p>' . esc_html__('WooptionsFic’s administration builder requires JavaScript. Storefront basic fields still have a server-rendered fallback.', 'wooptionsfic') . '</p></div></noscript>';
		echo '</div>';
	}

	public function activated_notice(): void {
		if (! get_transient('wooptionsfic_activated') || ! current_user_can('manage_wooptionsfic')) {
			return;
		}
		delete_transient('wooptionsfic_activated');
		echo '<div class="notice notice-success is-dismissible"><p>';
		echo wp_kses_post(
			sprintf(
				/* translators: %s: plugin admin URL. */
				__('WooptionsFic is ready. <a href="%s">Open the Precision Workshop</a> to import a template or build your first option set.', 'wooptionsfic'),
				esc_url(admin_url('admin.php?page=wooptionsfic#/templates'))
			)
		);
		echo '</p></div>';
	}
}
