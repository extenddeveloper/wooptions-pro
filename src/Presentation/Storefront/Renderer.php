<?php
/**
 * Accessible server-rendered configurator baseline.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Presentation\Storefront;

use WooOptionsPro\Application\AnalyticsService;
use WooOptionsPro\Application\QuoteService;
use WooOptionsPro\Bootstrap\Settings;
use WooOptionsPro\Domain\Definition\Type\ScalarFieldType;
use WooOptionsPro\Domain\Font\CustomFontService;
use WooOptionsPro\Domain\Support\Uuid;
use WooOptionsPro\Infrastructure\WooCommerce\ProductContext;
use WooOptionsPro\Infrastructure\WordPress\SessionGuard;

final class Renderer {
	/** @var array<int,bool> */
	private array $rendered_products = [];

	public function __construct(
		private readonly QuoteService $quotes,
		private readonly ProductContext $products,
		private readonly SessionGuard $sessions,
		private readonly AnalyticsService $analytics
	) {
	}

	public function render_for_current_product(): void {
		global $product;
		if (! $product instanceof \WC_Product) {
			return;
		}
		$this->render((int) $product->get_id());
	}

	public function render_block(array $attributes = []): string {
		$product_id = max(0, (int) ($attributes['productId'] ?? get_the_ID()));
		ob_start();
		$this->render($product_id);
		return (string) ob_get_clean();
	}

	public function render(int $product_id): void {
		if ($product_id <= 0 || isset($this->rendered_products[$product_id])) {
			return;
		}
		try {
			$context = $this->products->make(
				$product_id,
				0,
				1,
				get_current_user_id(),
				$this->sessions->session_hash()
			);
			$config = $this->quotes->configuration($context);
		} catch (\Throwable) {
			return;
		}
		if (! is_array($config) || [] === (array) ($config['fields'] ?? [])) {
			return;
		}
		$this->rendered_products[$product_id] = true;

		wp_enqueue_script('wooptions-pro-storefront');
		wp_enqueue_style('wooptions-pro-storefront');
		$this->enqueue_typography_font((array) ($config['style']['typography'] ?? []));
		$this->enqueue_font_field_fonts((array) ($config['fields'] ?? []));

		$token  = $this->sessions->issue($product_id, (string) $config['revisionUuid']);
		$tokens = (array) ($config['style']['tokens'] ?? []);
		$style  = $this->css_variables($tokens, (array) ($config['style']['typography'] ?? []));

		$total_text  = ! empty(Settings::get('enable_addons_total_text'))
			? (string) Settings::get('addons_total_text', 'Total Price')
			: __('Configured price', 'wooptions-pro');
		$status_text = ! empty(Settings::get('enable_summary_status_text'))
			? (string) Settings::get('summary_status_text', 'Ready for your choices')
			: __('Ready for your choices', 'wooptions-pro');
		$notice_text = ! empty(Settings::get('enable_summary_notice_text'))
			? (string) Settings::get('summary_notice_text', 'Server-confirmed total, before shipping.')
			: __('Server-confirmed total, before shipping.', 'wooptions-pro');

		$payload= [
			'configuration' => $config,
			'token'         => $token,
			'currency'      => (string) $context['currency'],
			'currencyScale' => (int) $context['currencyScale'],
			'basePrice'     => (string) $context['basePrice'],
			'labels'        => [
				'summaryTotal'  => $total_text,
				'summaryStatus' => $status_text,
				'summaryNotice' => $notice_text,
			],
		];

		$layout = in_array(($config['layout']['type'] ?? ''), ['stack', 'inline', 'grid', 'accordion', 'tabs', 'wizard'], true)
			? (string) $config['layout']['type']
			: 'stack';
		$show_price_breakdown     = ! empty($config['settings']['showPriceBreakdown']);
		$sticky_summary           = ! empty($config['settings']['stickySummary']);
		$save_enabled             = ! empty($config['settings']['saveEnabled']);
		$share_enabled            = ! empty($config['settings']['shareEnabled']);
		$customer_actions_enabled = $save_enabled || $share_enabled;
		$action_title             = ($save_enabled && $share_enabled)
			? __('Save or share this configuration', 'wooptions-pro')
			: ($share_enabled ? __('Share this configuration', 'wooptions-pro') : __('Save this configuration', 'wooptions-pro'));

		echo '<section class="wof-configurator wof-layout--' . esc_attr($layout) . '" data-wof-root data-layout="' . esc_attr($layout) . '" data-product-id="' . esc_attr((string) $product_id) . '"';
		echo ' data-revision="' . esc_attr((string) $config['revisionUuid']) . '"';
		echo ' data-show-price-breakdown="' . ($show_price_breakdown ? '1' : '0') . '"';
		echo ' data-sticky-summary="' . ($sticky_summary ? '1' : '0') . '"';
		echo ' data-save-enabled="' . ($save_enabled ? '1' : '0') . '"';
		echo ' style="' . esc_attr($style) . '">';
		echo '<div class="wof-configurator__grid">';
		if ($sticky_summary) {
			$this->render_summary($show_price_breakdown, true, $save_enabled, $share_enabled);
		}
		echo '<div class="wof-fields" data-wof-fields aria-live="off">';
		foreach ((array) $config['fields'] as $field) {
			if (is_array($field)) {
				$this->render_field($field);
			}
		}
		echo '</div>';
		if (! $sticky_summary) {
			$this->render_summary($show_price_breakdown, false, $save_enabled, $share_enabled);
		}
		echo '</div>';
		echo '<div class="wof-errors" data-wof-errors role="alert" tabindex="-1" hidden></div>';
		echo '<input type="hidden" name="wooptions-pro_token" value="' . esc_attr($token) . '">';
		echo '<input type="hidden" name="wooptions-pro_revision" value="' . esc_attr((string) $config['revisionUuid']) . '">';
		echo '<input type="hidden" name="wooptions-pro_selection_json" value="" data-wof-selection-json>';
		echo '<script type="application/json" data-wof-config>';
		echo wp_json_encode($payload, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES);
		echo '</script>';
		echo '</section>';

		$this->analytics->record(
			'view',
			[
				'productId'     => $product_id,
				'optionSetUuid' => (string) ($config['setUuid'] ?? ''),
				'revisionUuid'  => (string) ($config['revisionUuid'] ?? ''),
			]
		);
	}

	private function render_summary(bool $show_price_breakdown, bool $sticky, bool $save_enabled = false, bool $share_enabled = false): void {
		$summary_class            = $sticky ? 'wof-summary is-sticky' : 'wof-summary';
		$customer_actions_enabled = $save_enabled || $share_enabled;
		$action_pill_text         = ($save_enabled && $share_enabled)
			? __('Save / Share', 'wooptions-pro')
			: ($share_enabled ? __('Share link', 'wooptions-pro') : __('Save', 'wooptions-pro'));
		$action_pill_title        = ($save_enabled && $share_enabled)
			? __('Save or share configuration', 'wooptions-pro')
			: ($share_enabled ? __('Share configuration link', 'wooptions-pro') : __('Save configuration', 'wooptions-pro'));
		$modal_title              = ($save_enabled && $share_enabled)
			? __('Save or share configuration', 'wooptions-pro')
			: ($share_enabled ? __('Share configuration', 'wooptions-pro') : __('Save configuration', 'wooptions-pro'));

		$total_text  = ! empty(Settings::get('enable_addons_total_text'))
			? (string) Settings::get('addons_total_text', 'Total Price')
			: __('Total Price', 'wooptions-pro');
		$status_text = ! empty(Settings::get('enable_summary_status_text'))
			? (string) Settings::get('summary_status_text', 'Price confirmed')
			: __('Price confirmed', 'wooptions-pro');
		$notice_text = ! empty(Settings::get('enable_summary_notice_text'))
			? (string) Settings::get('summary_notice_text', 'Server-confirmed total, before shipping.')
			: __('Server-confirmed total, before shipping.', 'wooptions-pro');

		echo '<aside class="' . esc_attr($summary_class) . '" data-wof-summary aria-live="polite">';
		echo '<div class="wof-summary__main">';
		echo '<div class="wof-summary__info">';
		echo '<span class="wof-summary__title">' . esc_html($total_text) . '</span>';
		if ('' !== $notice_text) {
			echo '<p class="wof-summary__notice">' . esc_html($notice_text) . '</p>';
		}
		echo '</div>';

		echo '<div class="wof-summary__price-wrap">';
		echo '<strong class="wof-summary__total-val" data-wof-total>—</strong>';
		echo '</div>';
		echo '</div>';

		echo '<div class="wof-summary__meta">';
		echo '<div class="wof-summary__status-badge" data-wof-status>';
		echo '<span class="wof-status-dot" aria-hidden="true"></span>';
		echo '<span data-wof-status-text>' . esc_html($status_text) . '</span>';
		echo '</div>';

		echo '<div class="wof-summary__actions">';
		echo '<button type="button" class="wof-action-pill" data-wof-breakdown-trigger aria-haspopup="dialog" aria-expanded="false"' . ($show_price_breakdown ? '' : ' hidden') . ' title="' . esc_attr__('View price breakdown', 'wooptions-pro') . '">';
		echo '<svg viewBox="0 0 20 20" width="13" height="13" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h7a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>';
		echo '<span>' . esc_html__('Breakdown', 'wooptions-pro') . '</span>';
		echo '<span class="wof-breakdown-badge" data-wof-breakdown-count hidden>0</span>';
		echo '</button>';

		echo '<button type="button" class="wof-action-pill" data-wof-save-modal-trigger aria-haspopup="dialog" aria-expanded="false" title="' . esc_attr($action_pill_title) . '"' . ($customer_actions_enabled ? '' : ' hidden') . '>';
		echo '<svg viewBox="0 0 20 20" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"/></svg>';
		echo '<span data-wof-save-btn-text>' . esc_html($action_pill_text) . '</span>';
		echo '</button>';
		echo '</div>';
		echo '</div>';

		// Keep hidden rows container for backward compatibility/screen readers
		echo '<div class="wof-summary__rows" data-wof-summary-rows hidden></div>';

		// Breakdown Modal Dialog
		echo '<div class="wof-breakdown-modal" data-wof-breakdown-modal role="dialog" aria-modal="true" aria-label="' . esc_attr__('Price breakdown', 'wooptions-pro') . '" hidden>';
		echo '<div class="wof-breakdown-modal__backdrop" data-wof-breakdown-close></div>';
		echo '<div class="wof-breakdown-modal__dialog">';
		echo '<div class="wof-breakdown-modal__header">';
		echo '<div class="wof-breakdown-modal__title-area">';
		echo '<div class="wof-breakdown-modal__icon" aria-hidden="true"><svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h7a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/></svg></div>';
		echo '<div><h3 class="wof-breakdown-modal__title">' . esc_html__('Price breakdown', 'wooptions-pro') . '</h3>';
		echo '<p class="wof-breakdown-modal__subtitle">' . esc_html__('Summary of your selected options', 'wooptions-pro') . '</p></div>';
		echo '</div>';
		echo '<button type="button" class="wof-breakdown-modal__close" data-wof-breakdown-close aria-label="' . esc_attr__('Close breakdown', 'wooptions-pro') . '">';
		echo '<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>';
		echo '</button>';
		echo '</div>';
		echo '<div class="wof-breakdown-modal__body" data-wof-breakdown-modal-items>';
		echo '<p class="wof-breakdown-modal__empty">' . esc_html__('No additional options selected.', 'wooptions-pro') . '</p>';
		echo '</div>';
		echo '<div class="wof-breakdown-modal__footer">';
		echo '<div class="wof-breakdown-modal__total-row">';
		echo '<span>' . esc_html($total_text) . '</span>';
		echo '<strong data-wof-breakdown-total>—</strong>';
		echo '</div>';
		echo '<button type="button" class="wof-button wof-breakdown-modal__done" data-wof-breakdown-close>' . esc_html__('Done', 'wooptions-pro') . '</button>';
		echo '</div>';
		echo '</div>';
		echo '</div>';

		// Save & Share Modal Dialog
		echo '<div class="wof-save-modal" data-wof-save-modal data-wof-save-panel role="dialog" aria-modal="true" aria-label="' . esc_attr($modal_title) . '" hidden>';
		echo '<div class="wof-save-modal__backdrop" data-wof-save-modal-close></div>';
		echo '<div class="wof-save-modal__dialog">';
		echo '<div class="wof-save-modal__header">';
		echo '<div class="wof-save-modal__title-area">';
		echo '<div class="wof-save-modal__icon" aria-hidden="true"><svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"/></svg></div>';
		echo '<div><h3 class="wof-save-modal__title">' . esc_html($modal_title) . '</h3>';
		echo '<p class="wof-save-modal__subtitle">' . esc_html__('Save your custom options or create a shareable link', 'wooptions-pro') . '</p></div>';
		echo '</div>';
		echo '<button type="button" class="wof-save-modal__close" data-wof-save-modal-close aria-label="' . esc_attr__('Close dialog', 'wooptions-pro') . '">';
		echo '<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>';
		echo '</button>';
		echo '</div>';

		echo '<div class="wof-save-modal__body">';
		echo '<div class="wof-save-modal__section" data-wof-save-section' . ($save_enabled ? '' : ' hidden') . '>';
		echo '<label class="wof-save-label" for="wof-save-name-input">' . esc_html__('Configuration name', 'wooptions-pro') . '</label>';
		echo '<div class="wof-save-input-row">';
		echo '<input id="wof-save-name-input" type="text" maxlength="191" value="' . esc_attr__('My configuration', 'wooptions-pro') . '" class="wof-save-input" data-wof-save-name placeholder="' . esc_attr__('e.g. My Custom Build', 'wooptions-pro') . '">';
		echo '<button type="button" class="wof-button wof-button--save" data-wof-save' . ($save_enabled ? '' : ' hidden') . '>';
		echo '<svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>';
		echo '<span>' . esc_html__('Save', 'wooptions-pro') . '</span>';
		echo '</button>';
		echo '</div>';
		echo '</div>';

		echo '<div class="wof-save-modal__section" data-wof-share-section' . ($share_enabled ? '' : ' hidden') . '>';
		echo '<div class="wof-save-modal__share-row">';
		echo '<div><strong class="wof-save-modal__label">' . esc_html__('Shareable Link', 'wooptions-pro') . '</strong>';
		echo '<p class="wof-save-modal__hint">' . esc_html__('Create a link with your selections to share or bookmark.', 'wooptions-pro') . '</p></div>';
		echo '<button type="button" class="wof-button wof-button--share" data-wof-share' . ($share_enabled ? '' : ' hidden') . '>';
		echo '<svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/></svg>';
		echo '<span>' . esc_html__('Create link', 'wooptions-pro') . '</span>';
		echo '</button>';
		echo '</div>';
		echo '<div class="wof-share-link" data-wof-share-link hidden>';
		echo '<input type="url" readonly aria-label="' . esc_attr__('Share link', 'wooptions-pro') . '" class="wof-share-input">';
		echo '<button type="button" class="wof-button wof-button--copy" data-wof-copy-share>';
		echo '<svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/></svg>';
		echo '<span>' . esc_html__('Copy', 'wooptions-pro') . '</span>';
		echo '</button>';
		echo '</div>';
		echo '</div>';

		echo '<p class="wof-save-status" data-wof-save-status aria-live="polite"></p>';
		echo '</div>';

		echo '<div class="wof-save-modal__footer">';
		echo '<button type="button" class="wof-button wof-save-modal__done" data-wof-save-modal-close>' . esc_html__('Done', 'wooptions-pro') . '</button>';
		echo '</div>';
		echo '</div>';
		echo '</div>';

		echo '</aside>';
	}

	/**
	 * @param array<string,mixed> $field Field definition.
	 */
	private function render_field(array $field, string $name_prefix = 'wooptions-pro_selection', string $row_uuid = ''): void {
		$type = (string) ($field['type'] ?? '');
		$uuid = (string) ($field['uuid'] ?? '');
		if ('' === $uuid) {
			return;
		}
		if ('spacer' === $type) {
			$height = (int) ($field['height'] ?? ($field['style']['height'] ?? 24));
			if ($height < 0) {
				$height = 24;
			}
			$width = (string) ($field['width'] ?? '100%');
			if (! in_array($width, ['33%', '50%', '66%', '100%'], true)) {
				$width = '100%';
			}
			$is_disabled = ! empty($field['disabled']);
			$classes     = 'wof-field wof-field--spacer wof-spacer wof-field--width-' . str_replace('%', '', $width);
			if ($is_disabled) {
				$classes .= ' is-disabled';
			}
			$style = 'height:' . $height . 'px;min-height:' . $height . 'px;';
			if ($is_disabled) {
				$style .= 'display:none;';
			}
			echo '<div class="' . esc_attr($classes) . '" data-wof-field="' . esc_attr($uuid) . '" data-wof-type="spacer" style="' . esc_attr($style) . '"' . ($is_disabled ? ' hidden' : '') . ' aria-hidden="true"></div>';
			return;
		}
		if (in_array($type, ['heading', 'paragraph', 'help', 'separator', 'content', 'modal'], true)) {
			$this->render_content($field);
			return;
		}
		if ('formula' === $type) {
			$is_disabled    = ! empty($field['disabled']);
			$width          = (string) ($field['width'] ?? '100%');
			if (! in_array($width, ['33%', '50%', '66%', '100%'], true)) {
				$width = '100%';
			}
			$classes        = 'wof-field wof-field--formula wof-field--width-' . str_replace('%', '', $width);
			if ($is_disabled) {
				$classes .= ' is-disabled';
			}
			$style          = $is_disabled ? ' style="display:none;"' : '';
			$display_mode   = in_array(($field['displayMode'] ?? ''), ['number', 'currency', 'text'], true) ? $field['displayMode'] : 'currency';
			$decimal_places = max(0, min(6, (int) ($field['decimalPlaces'] ?? 2)));
			$prefix         = esc_attr((string) ($field['prefix'] ?? ''));
			$suffix         = esc_attr((string) ($field['suffix'] ?? ''));
			$currency_symbol = function_exists('get_woocommerce_currency_symbol')
				? html_entity_decode((string) get_woocommerce_currency_symbol(), ENT_QUOTES, 'UTF-8')
				: '$';
			$currency_pos   = function_exists('get_option')
				? (string) get_option('woocommerce_currency_pos', 'left_space')
				: 'left_space';
			$initial_val    = '—';
			if ('text' !== $display_mode) {
				$formatted_zero = number_format(0, $decimal_places);
				if ('' !== $prefix) {
					$initial_val = $prefix . $formatted_zero . $suffix;
				} else {
					if ('right' === $currency_pos) {
						$initial_val = $formatted_zero . $currency_symbol . $suffix;
					} elseif ('right_space' === $currency_pos) {
						$initial_val = $formatted_zero . ' ' . $currency_symbol . $suffix;
					} elseif ('left' === $currency_pos) {
						$initial_val = $currency_symbol . $formatted_zero . $suffix;
					} else {
						$initial_val = $currency_symbol . ' ' . $formatted_zero . $suffix;
					}
				}
			}
			$hide_zero      = ! empty($field['hideWhenZero']) ? ' data-wof-hide-zero="1"' : '';
			$help_text      = trim((string) ($field['help'] ?? $field['description'] ?? ''));
			$help_pos       = (string) ($field['helpTextPosition'] ?? 'below_title');
			$row_suffix     = '' !== $row_uuid ? '-' . $row_uuid : '';
			$description_id = 'wof-description-' . str_replace('-', '', $uuid) . str_replace('-', '', $row_suffix);

			echo '<div class="' . esc_attr($classes) . '" data-wof-field="' . esc_attr($uuid) . '" data-wof-type="formula"' . $style . ($is_disabled ? ' hidden' : '') . '>';

			echo '<div class="wof-formula-header">';
			if (! empty($field['label'])) {
				echo '<label class="wof-field__label" for="wof-' . esc_attr($uuid . $row_suffix) . '">';
				echo esc_html((string) $field['label']);
				echo '</label>';
			}
			echo '<span class="wof-formula-output-wrap">';
			echo '<output data-wof-calculated="' . esc_attr($uuid) . '"'
				. ' id="wof-' . esc_attr($uuid . $row_suffix) . '"'
				. ' class="wof-formula-output"'
				. ' data-wof-display-mode="' . esc_attr($display_mode) . '"'
				. ' data-wof-decimal-places="' . esc_attr((string) $decimal_places) . '"'
				. ' data-wof-prefix="' . $prefix . '"'
				. ' data-wof-suffix="' . $suffix . '"'
				. $hide_zero
				. '>' . esc_html($initial_val) . '</output>';
			echo '</span>';
			if ('' !== $help_text && 'tooltip' === $help_pos) {
				echo $this->render_tooltip_icon($help_text);
			}
			echo '</div>';

			if ('' !== $help_text && 'below_title' === $help_pos) {
				echo '<p class="wof-field__help wof-field__help--below-title" id="' . esc_attr($description_id) . '">' . esc_html($help_text) . '</p>';
			}

			if ('' !== $help_text && 'below_field' === $help_pos) {
				echo '<p class="wof-field__help wof-field__help--below-field">' . esc_html($help_text) . '</p>';
			}
			echo '</div>';
			return;
		}

		$row_suffix     = '' !== $row_uuid ? '-' . $row_uuid : '';
		$description_id = 'wof-description-' . str_replace('-', '', $uuid) . str_replace('-', '', $row_suffix);
		$required       = ! empty($field['required']);
		$is_disabled    = ! empty($field['disabled']);
		$width          = (string) ($field['width'] ?? '100%');
		if (! in_array($width, ['33%', '50%', '66%', '100%'], true)) {
			$width = '100%';
		}
		$classes        = 'wof-field wof-field--' . sanitize_html_class($type);
		$classes       .= ' wof-field--width-' . str_replace('%', '', $width);
		if ($is_disabled) {
			$classes .= ' is-disabled';
		}
		// Apply imageStyle modifier class for visual style variants.
		if (in_array($type, ['color_swatch', 'image_swatch', 'product'], true)) {
			$img_style_val = (string) ($field['imageStyle'] ?? 'default');
			if (in_array($img_style_val, ['overlay', 'only_image'], true)) {
				$classes .= ' wof-image-style--' . sanitize_html_class($img_style_val);
			}
		}

		if ('repeater' === $type) {
			$section_style = (string) ($field['sectionStyle'] ?? 'section');
			$classes .= ' wof-section wof-section--' . sanitize_html_class($section_style);
			if ('accordion' === $section_style) {
				$init_state = (string) ($field['initialState'] ?? 'open');
				if ('close' !== $init_state) {
					$classes .= ' is-open';
				}
			}
		}

		echo '<div class="' . esc_attr($classes) . '" data-wof-field="' . esc_attr($uuid) . '" data-wof-type="' . esc_attr($type) . '"';
		if ($is_disabled) {
			echo ' hidden style="display:none;"';
		}
		if ('repeater' === $type && 'accordion' === ($field['sectionStyle'] ?? 'section')) {
			$init_state = (string) ($field['initialState'] ?? 'open');
			echo ' data-wof-accordion="1" data-wof-initial-state="' . esc_attr($init_state) . '"';
		}
		if ('image_swatch' === $type && ! empty($field['updateProductImage'])) {
			echo ' data-wof-update-product-image="1"';
		}
		if (! empty($field['minChoices'])) {
			echo ' data-wof-min-choices="' . esc_attr((string) $field['minChoices']) . '"';
		}
		if (! empty($field['maxChoices'])) {
			echo ' data-wof-max-choices="' . esc_attr((string) $field['maxChoices']) . '"';
		}
		if ('font' === $type) {
			$applied = (array) ($field['appliedFields'] ?? []);
			echo ' data-wof-font-picker="1" data-wof-applied-fields="' . esc_attr((string) wp_json_encode(array_values($applied))) . '"';
		}
		echo '>';


		$help_text = trim((string) ($field['help'] ?? ''));
		$help_pos  = (string) ($field['helpTextPosition'] ?? 'below_title');

		$price_text = $this->choice_price_text($field, false);

		if (! in_array($type, ['checkbox', 'toggle', 'repeater'], true)) {
			echo '<label class="wof-field__label" for="wof-' . esc_attr($uuid . $row_suffix) . '">';
			echo esc_html((string) ($field['label'] ?? __('Option', 'wooptions-pro')));
			if ($required) {
				echo ' <span class="wof-required" aria-hidden="true">*</span><span class="screen-reader-text">' . esc_html__('required', 'wooptions-pro') . '</span>';
			}
			if ('' !== $price_text && in_array($type, ['text', 'textarea', 'number', 'tel', 'email', 'url', 'range', 'customer_defined_price', 'file'], true)) {
				echo ' <span class="wof-field__price">' . esc_html($price_text) . '</span>';
			}
			if ('' !== $help_text && 'tooltip' === $help_pos) {
				echo $this->render_tooltip_icon($help_text);
			}
			echo '</label>';
		}
		if ('' !== $help_text && 'below_title' === $help_pos && ! in_array($type, ['checkbox', 'toggle', 'repeater'], true)) {
			echo '<p class="wof-field__help wof-field__help--below-title" id="' . esc_attr($description_id) . '">' . esc_html($help_text) . '</p>';
		}

		$name = $name_prefix . '[' . $uuid . ']';
		if (in_array($type, ['select', 'font'], true)) {
			$this->render_select($field, $name, $description_id, $row_uuid);
		} elseif ('color_swatch' === $type) {
			$this->render_color_swatches($field, $name, $description_id, $row_uuid);
		} elseif ('image_swatch' === $type) {
			$this->render_image_swatches($field, $name, $description_id, $row_uuid);
		} elseif ('radio' === $type) {
			$this->render_radio_list($field, $name, $description_id, $row_uuid);
		} elseif ('checkbox_group' === $type) {
			$this->render_checkbox_list($field, $name, $description_id, $row_uuid);
		} elseif (in_array($type, ['segmented'], true)) {
			$this->render_choices($field, $name, $description_id, $row_uuid);
		} elseif ('product' === $type) {
			$this->render_product_choices($field, $name, $description_id, $row_uuid);
		} elseif (in_array($type, ['checkbox', 'toggle'], true)) {
			$this->render_boolean($field, $name, $description_id, $row_uuid);
		} elseif ('file' === $type) {
			$this->render_upload($field, $name, $description_id, $row_uuid);
		} elseif ('repeater' === $type) {
			$this->render_repeater($field, $name);
		} elseif ('color_picker' === $type) {
			$this->render_color_picker($field, $name, $description_id, $row_uuid);
		} else {
			$this->render_scalar($field, $name, $description_id, $row_uuid);
		}

		if ('' !== $help_text && 'below_field' === $help_pos) {
			echo '<p class="wof-field__help wof-field__help--below-field">' . esc_html($help_text) . '</p>';
		}
		echo '<p class="wof-field__error" data-wof-field-error aria-live="polite"></p>';
		echo '</div>';
	}

	/**
	 * @param array<string,mixed> $field Field.
	 */
	private function render_select(array $field, string $name, string $description_id, string $row_uuid = ''): void {
		$uuid         = (string) $field['uuid'];
		$type         = (string) ($field['type'] ?? 'select');
		$is_font_type = 'font' === $type;
		$image_style  = (string) ($field['imageStyle'] ?? 'normal');
		$img_base_cls = 'circle' === $image_style ? 'wof-choice-img wof-choice-img--circle' : 'wof-choice-img';
		$choices      = (array) ($field['choices'] ?? []);

		// Find default selected choice
		$default_uuid        = '';
		$default_label       = $is_font_type ? __('Choose a font', 'wooptions-pro') : __('Choose an option', 'wooptions-pro');
		$default_font_family = '';
		$default_img         = '';
		$default_price       = '';

		foreach ($choices as $choice) {
			$choice_uuid = (string) ($choice['uuid'] ?? '');
			$selected    = ! empty($choice['default']) || (string) ($field['default'] ?? '') === $choice_uuid;
			if ($selected) {
				$default_uuid        = $choice_uuid;
				$default_label       = (string) ($choice['label'] ?? '');
				$default_font_family = (string) ($choice['fontFamily'] ?? $default_label);
				$default_img         = ! empty($choice['imageUrl']) ? (string) $choice['imageUrl'] : '';
				if (empty($default_img) && ! empty($choice['imageId'])) {
					$default_img = (string) wp_get_attachment_image_url((int) $choice['imageId'], 'thumbnail');
				}
				$default_price = $this->choice_price_text((array) $choice, false);
				break;
			}
		}

		$container_cls = 'wof-custom-select' . ($is_font_type ? ' wof-custom-select--font' : '');
		echo '<div class="' . esc_attr($container_cls) . '" data-wof-custom-select>';
		echo '<div class="wof-custom-select__trigger" data-wof-custom-select-trigger role="combobox" tabindex="0" aria-haspopup="listbox" aria-expanded="false" aria-describedby="' . esc_attr($description_id) . '">';
		echo '<span class="wof-custom-select__selected" data-wof-custom-select-selected>';
		$style_img = '' === $default_img ? ' style="display:none;"' : '';
		echo '<img class="' . esc_attr($img_base_cls . ' wof-custom-select__img') . '" src="' . esc_url($default_img) . '" alt=""' . $style_img . ' data-wof-selected-img>';
		$title_style = ($is_font_type && '' !== $default_font_family && '' !== $default_uuid) ? ' style="font-family:' . esc_attr($default_font_family) . ';"' : '';
		echo '<span class="wof-custom-select__title" data-wof-selected-title' . $title_style . '>' . esc_html($default_label) . '</span>';
		$style_price = '' === $default_price ? ' style="display:none;"' : '';
		echo '<span class="wof-custom-select__price"' . $style_price . ' data-wof-selected-price>' . esc_html($default_price) . '</span>';
		echo '</span>';
		echo '<svg class="wof-custom-select__chevron" viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/></svg>';
		echo '</div>';

		echo '<div class="wof-custom-select__dropdown" data-wof-custom-select-dropdown role="listbox" tabindex="-1">';
		$is_empty_selected = '' === $default_uuid;
		$empty_label       = $is_font_type ? __('Choose a font', 'wooptions-pro') : __('Choose an option', 'wooptions-pro');
		echo '<div class="wof-custom-select__option' . ($is_empty_selected ? ' is-selected' : '') . '" data-wof-option-value="" data-wof-option-label="' . esc_attr($empty_label) . '" data-wof-option-image="" data-wof-option-price="" role="option" aria-selected="' . ($is_empty_selected ? 'true' : 'false') . '">';
		echo '<span class="wof-custom-select__option-label">' . esc_html($empty_label) . '</span>';
		echo '</div>';

		foreach ($choices as $choice) {
			$choice_uuid = (string) ($choice['uuid'] ?? '');
			$is_selected = $choice_uuid === $default_uuid;
			$choice_font = (string) ($choice['fontFamily'] ?? ($choice['label'] ?? ''));
			$choice_img  = ! empty($choice['imageUrl']) ? (string) $choice['imageUrl'] : '';
			if (empty($choice_img) && ! empty($choice['imageId'])) {
				$choice_img = (string) wp_get_attachment_image_url((int) $choice['imageId'], 'thumbnail');
			}
			$price_text  = $this->choice_price_text((array) $choice, false);
			$is_disabled = ! empty($choice['disabled']);

			$opt_cls = 'wof-custom-select__option' . ($is_selected ? ' is-selected' : '') . ($is_disabled ? ' is-disabled' : '') . ($is_font_type ? ' wof-custom-select__option--font' : '');
			echo '<div class="' . esc_attr($opt_cls) . '"';
			echo ' data-wof-option-value="' . esc_attr($choice_uuid) . '"';
			echo ' data-wof-option-label="' . esc_attr((string) $choice['label']) . '"';
			if ($is_font_type && '' !== $choice_font) {
				echo ' data-font-family="' . esc_attr($choice_font) . '"';
			}
			if ('' !== $choice_img) {
				echo ' data-wof-option-image="' . esc_url($choice_img) . '"';
			}
			if ('' !== $price_text) {
				echo ' data-wof-option-price="' . esc_attr($price_text) . '"';
			}
			echo ' role="option" aria-selected="' . ($is_selected ? 'true' : 'false') . '"';
			if ($is_disabled) {
				echo ' aria-disabled="true"';
			}
			echo '>';

			if ('' !== $choice_img) {
				echo '<img class="' . esc_attr($img_base_cls . ' wof-custom-select__img') . '" src="' . esc_url($choice_img) . '" alt="">';
			}

			if ($is_font_type) {
				echo '<span class="wof-custom-select__option-label" style="font-family:' . esc_attr($choice_font) . '; font-size:15px;">' . esc_html((string) $choice['label']) . '</span>';
			} else {
				echo '<span class="wof-custom-select__option-label">' . esc_html((string) $choice['label']) . '</span>';
			}

			if ('' !== (string) ($choice['description'] ?? '')) {
				echo '<small class="wof-custom-select__option-desc">' . esc_html((string) $choice['description']) . '</small>';
			}
			if ('' !== $price_text) {
				echo '<span class="wof-custom-select__option-price">' . esc_html($price_text) . '</span>';
			}
			echo '</div>';
		}
		echo '</div>';

		// Native select
		echo '<select id="wof-' . esc_attr($uuid) . ('' !== $row_uuid ? '-' . esc_attr($row_uuid) : '') . '" name="' . esc_attr($name) . '" class="wof-custom-select__native" tabindex="-1" aria-hidden="true"';
		echo $this->input_attributes($field, $description_id) . '>';
		echo '<option value="">' . esc_html($empty_label) . '</option>';
		foreach ($choices as $choice) {
			$choice_uuid = (string) ($choice['uuid'] ?? '');
			$selected    = $choice_uuid === $default_uuid;
			$choice_font = (string) ($choice['fontFamily'] ?? ($choice['label'] ?? ''));
			$choice_img  = ! empty($choice['imageUrl']) ? (string) $choice['imageUrl'] : '';
			if (empty($choice_img) && ! empty($choice['imageId'])) {
				$choice_img = (string) wp_get_attachment_image_url((int) $choice['imageId'], 'thumbnail');
			}
			echo '<option value="' . esc_attr($choice_uuid) . '"' . selected($selected, true, false);
			if ('' !== $choice_img) {
				echo ' data-image="' . esc_url($choice_img) . '"';
			}
			if ($is_font_type && '' !== $choice_font) {
				echo ' data-font-family="' . esc_attr($choice_font) . '"';
			}
			echo disabled(! empty($choice['disabled']), true, false) . '>';
			echo esc_html((string) $choice['label'] . $this->choice_price_text((array) $choice));
			echo '</option>';
		}
		echo '</select>';

		echo '</div>';
	}

	/**
	 * @param array<string,mixed> $field Field.
	 */
	private function render_choices(array $field, string $name, string $description_id, string $row_uuid = ''): void {
		$type     = (string) $field['type'];
		$multiple = ! empty($field['multiple']) || 'product' === $type;
		$input    = $multiple ? 'checkbox' : 'radio';
		$group    = $multiple ? $name . '[]' : $name;
		$choice_item_style = '';
		if (isset($field['choiceWidth']) && '' !== (string) $field['choiceWidth']) {
			$choice_item_style .= 'min-width:' . esc_attr((string) $field['choiceWidth']) . 'px;';
		}
		if (isset($field['choiceHeight']) && '' !== (string) $field['choiceHeight']) {
			$choice_item_style .= 'min-height:' . esc_attr((string) $field['choiceHeight']) . 'px;';
		}
		if (isset($field['choiceBorderRadius']) && '' !== (string) $field['choiceBorderRadius']) {
			$choice_item_style .= 'border-radius:' . esc_attr((string) $field['choiceBorderRadius']) . 'px;';
		}

		// Determine display direction for segmented (button choices) field.
		$is_vertical     = 'segmented' === $type && 'vertical' === (string) ($field['displayDirection'] ?? 'horizontal');
		$grid_class      = 'wof-choice-grid';
		if ($is_vertical) {
			$grid_class .= ' wof-choice-grid--vertical';
		}
		$dir_attr = $is_vertical ? ' data-direction="vertical"' : '';

		echo '<div class="' . esc_attr($grid_class) . '" role="group" aria-label="' . esc_attr((string) $field['label']) . '"' . $dir_attr . '>';
		foreach ((array) ($field['choices'] ?? []) as $choice) {
			$choice_uuid  = (string) ($choice['uuid'] ?? '');
			$id           = 'wof-' . $field['uuid'] . '-' . $choice_uuid . ('' !== $row_uuid ? '-' . $row_uuid : '');
			$checked      = ! empty($choice['default']);
			$label_class  = 'segmented' === $type ? 'wof-choice wof-choice--btn' : 'wof-choice';
			echo '<label class="' . esc_attr($label_class) . '" for="' . esc_attr($id) . '"' . ('' !== $choice_item_style ? ' style="' . $choice_item_style . '"' : '') . '>';
			echo '<input id="' . esc_attr($id) . '" type="' . esc_attr($input) . '" name="' . esc_attr($group) . '" value="' . esc_attr($choice_uuid) . '"';
			echo checked($checked, true, false) . disabled(! empty($choice['disabled']), true, false);
			echo ' aria-describedby="' . esc_attr($description_id) . '">';
			if ('color_swatch' === $type && '' !== (string) ($choice['color'] ?? '')) {
				echo '<span class="wof-choice__swatch" style="--wof-swatch:' . esc_attr((string) $choice['color']) . '" aria-hidden="true"></span>';
			}
			$image_html = '';
			if ((int) ($choice['imageId'] ?? 0) > 0) {
				$image_html = (string) wp_get_attachment_image((int) $choice['imageId'], 'thumbnail', false, ['class' => 'wof-choice__image', 'alt' => '']);
			}
			if ('' === $image_html && '' !== (string) ($choice['imageUrl'] ?? '')) {
				$image_html = '<img class="wof-choice__image" src="' . esc_url((string) $choice['imageUrl']) . '" alt="">';
			}
			echo wp_kses_post($image_html);
			echo '<span class="wof-choice__body"><strong>' . esc_html((string) $choice['label']) . '</strong>';
			if ('' !== (string) ($choice['description'] ?? '')) {
				echo '<small class="wof-choice__description">' . esc_html((string) $choice['description']) . '</small>';
			}
			echo '<span class="wof-choice__price">' . esc_html($this->choice_price_text((array) $choice)) . '</span>';
			if (! empty($field['enableQuantity'])) {
				$min_qty = max(1, (int) ($field['minQuantity'] ?? 1));
				$max_qty = ! empty($field['maxQuantity']) ? max($min_qty, (int) $field['maxQuantity']) : 9999;
				echo '<span class="wof-choice-qty-wrap" onclick="event.stopPropagation();"><input type="number" class="wof-choice-qty-input" name="' . esc_attr('wooptions-pro_qty[' . $choice_uuid . ']') . '" data-wof-choice-uuid="' . esc_attr($choice_uuid) . '" data-wof-field-uuid="' . esc_attr((string) $field['uuid']) . '" value="' . esc_attr((string) $min_qty) . '" min="' . esc_attr((string) $min_qty) . '" max="' . esc_attr((string) $max_qty) . '" aria-label="' . esc_attr__('Quantity', 'wooptions-pro') . '"></span>';
			}
			echo '</span>';
			echo '<span class="wof-choice__check" aria-hidden="true"><svg viewBox="0 0 20 20" width="12" height="12" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg></span></label>';
		}
		echo '</div>';
	}

	/**
	 * Render product choices as image tiles with title, price (with sale), variation dropdown, and quantity.
	 *
	 * @param array<string,mixed> $field Field.
	 */
	private function render_product_choices(array $field, string $name, string $description_id, string $row_uuid = ''): void {
		$multiple     = ! empty($field['multiple']);
		$merge_vars   = ! empty($field['mergeVariationProducts']);
		$input        = $multiple ? 'checkbox' : 'radio';
		$group        = $multiple ? $name . '[]' : $name;
		$thumb_style  = '';
		if (isset($field['choiceWidth']) && '' !== (string) $field['choiceWidth']) {
			$thumb_style .= 'width:' . esc_attr((string) $field['choiceWidth']) . 'px;';
		}
		if (isset($field['choiceHeight']) && '' !== (string) $field['choiceHeight']) {
			$thumb_style .= 'height:' . esc_attr((string) $field['choiceHeight']) . 'px;';
		}
		if (isset($field['choiceBorderRadius']) && '' !== (string) $field['choiceBorderRadius']) {
			$thumb_style .= 'border-radius:' . esc_attr((string) $field['choiceBorderRadius']) . 'px;overflow:hidden;';
		}

		$has_any_variable = false;
		foreach ((array) ($field['choices'] ?? []) as $c) {
			$c_is_var   = ! empty($c['isVariable']) || ! empty($c['productInfo']['isVariable']);
			$c_sel_vars = array_map('absint', (array) ($c['selectedVariationIds'] ?? []));
			if ($c_is_var && ($merge_vars || ! empty($c_sel_vars))) {
				$has_any_variable = true;
				break;
			}
		}

		echo '<div class="wof-product-choices" role="group" aria-label="' . esc_attr((string) $field['label']) . '">';
		foreach ((array) ($field['choices'] ?? []) as $choice) {
			$choice_uuid  = (string) ($choice['uuid'] ?? '');
			$id           = 'wof-' . $field['uuid'] . '-' . $choice_uuid . ('' !== $row_uuid ? '-' . $row_uuid : '');
			$checked      = ! empty($choice['default']);
			$is_variable  = ! empty($choice['isVariable']) || ! empty($choice['productInfo']['isVariable']);
			$product_info = is_array($choice['productInfo'] ?? null) ? $choice['productInfo'] : [];

			// Variations setup early to support price display
			$selected_var_ids = array_map('absint', (array) ($choice['selectedVariationIds'] ?? []));
			$variations       = (array) ($product_info['variations'] ?? []);
			$target_prod_id   = ! empty($choice['productId']) ? (int) $choice['productId'] : (int) ($choice['linkedProductId'] ?? 0);

			if (empty($variations) && $target_prod_id > 0 && function_exists('wc_get_product')) {
				$wc_p = wc_get_product($target_prod_id);
				if ($wc_p && $wc_p->is_type('variable') && method_exists($wc_p, 'get_children')) {
					$is_variable = true;
					foreach ($wc_p->get_children() as $var_id) {
						$var = wc_get_product((int) $var_id);
						if (! $var) {
							continue;
						}
						$var_attrs = [];
						if (method_exists($var, 'get_variation_attributes')) {
							foreach ($var->get_variation_attributes() as $attr_key => $attr_val) {
								$var_attrs[wc_attribute_label(str_replace('attribute_', '', $attr_key))] = $attr_val;
							}
						}
						$var_label = $var->get_name();
						if ($var_label === $wc_p->get_name() && ! empty($var_attrs)) {
							$var_label = implode(', ', array_values($var_attrs));
						}
						$variations[] = [
							'id'           => (int) $var_id,
							'label'        => wp_strip_all_tags((string) $var_label),
							'price'        => (string) $var->get_price(),
							'regularPrice' => (string) $var->get_regular_price(),
							'salePrice'    => (string) $var->get_sale_price(),
						];
					}
				}
			}

			// If specific variations are selected (unmerged), filter to only those selected
			if ($is_variable && ! $merge_vars) {
				$variations = array_values(array_filter($variations, function ($v) use ($selected_var_ids) {
					return in_array((int) ($v['id'] ?? 0), $selected_var_ids, true);
				}));
			}

			$has_active_vars = $is_variable && ($merge_vars || ! empty($selected_var_ids));

			// Image from productInfo first, then choice imageUrl
			$image_url = (string) ($product_info['image'] ?? '');
			if ('' === $image_url && '' !== (string) ($choice['imageUrl'] ?? '')) {
				$image_url = (string) $choice['imageUrl'];
			}

			// Pricing: use productInfo prices if available, else fallback to choice pricing
			$regular_price = (string) ($product_info['regularPrice'] ?? '');
			$sale_price    = (string) ($product_info['salePrice'] ?? '');
			$price         = (string) ($product_info['price'] ?? '');

			// Fallback: if variable product has empty price, use first variation's price
			if ('' === $price && '' === $regular_price && '' === $sale_price && ! empty($variations)) {
				$first_v = reset($variations);
				if (is_array($first_v)) {
					$price         = (string) ($first_v['price'] ?? '');
					$regular_price = (string) ($first_v['regularPrice'] ?? '');
					$sale_price    = (string) ($first_v['salePrice'] ?? '');
				}
			}
			// Fallback to choice pricing helper
			$choice_price_text = $this->choice_price_text((array) $choice, false);

			echo '<label class="wof-product-choice-tile" for="' . esc_attr($id) . '"' . ('' !== $thumb_style ? ' style="' . $thumb_style . '"' : '') . '>';
			echo '<input id="' . esc_attr($id) . '" type="' . esc_attr($input) . '" name="' . esc_attr($group) . '" value="' . esc_attr($choice_uuid) . '"';
			echo checked($checked, true, false) . disabled(! empty($choice['disabled']), true, false);
			echo ' aria-describedby="' . esc_attr($description_id) . '"';
			if ('' !== (string) ($choice['productId'] ?? '')) {
				echo ' data-wof-product-id="' . esc_attr((string) $choice['productId']) . '"';
			}
			echo '>';

			// Product thumbnail
			echo '<span class="wof-product-choice-tile__img" aria-hidden="true">';
			if ('' !== $image_url) {
				echo '<img src="' . esc_url($image_url) . '" alt="" loading="lazy">';
			}
			echo '<span class="wof-choice__check" aria-hidden="true"><svg viewBox="0 0 20 20" width="12" height="12" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg></span>';
			echo '</span>';

			// Body: title, description, price
			echo '<span class="wof-choice__body">';
			echo '<strong>' . esc_html((string) $choice['label']) . '</strong>';
			if ('' !== (string) ($choice['description'] ?? '')) {
				echo '<small class="wof-choice__description">' . esc_html((string) $choice['description']) . '</small>';
			}

			// Price display: if both regular and sale price available, show del+ins
			if ('' !== $regular_price && '' !== $sale_price && $regular_price !== $sale_price) {
				$currency = function_exists('get_woocommerce_currency_symbol') ? get_woocommerce_currency_symbol() : '';
				echo '<span class="wof-choice__price wof-choice__price--sale">';
				echo '<del>' . esc_html($currency . $regular_price) . '</del> ';
				echo '<ins>' . esc_html($currency . $sale_price) . '</ins>';
				echo '</span>';
			} elseif ('' !== $price) {
				$currency = function_exists('get_woocommerce_currency_symbol') ? get_woocommerce_currency_symbol() : '';
				echo '<span class="wof-choice__price">' . esc_html($currency . $price) . '</span>';
			} elseif ('' !== $choice_price_text) {
				echo '<span class="wof-choice__price">' . esc_html($choice_price_text) . '</span>';
			}
			echo '</span>';

			if ($has_active_vars && ! empty($variations)) {
				echo '<select class="wof-product-variation-select" name="' . esc_attr('wooptions-pro_var[' . $choice_uuid . ']') . '" data-wof-choice-uuid="' . esc_attr($choice_uuid) . '" data-wof-field-uuid="' . esc_attr((string) $field['uuid']) . '" onclick="event.stopPropagation();" aria-label="' . esc_attr__('Select variation', 'wooptions-pro') . '">';
				echo '<option value="">' . esc_html__('Select variation', 'wooptions-pro') . '</option>';
				foreach ($variations as $var) {
					$var_id      = (int) ($var['id'] ?? 0);
					$var_label   = (string) ($var['label'] ?? '');
					$var_price   = (string) ($var['price'] ?? '');
					$var_regular = (string) ($var['regularPrice'] ?? '');
					$var_sale    = (string) ($var['salePrice'] ?? '');
					$currency    = function_exists('get_woocommerce_currency_symbol') ? get_woocommerce_currency_symbol() : '';
					echo '<option value="' . esc_attr((string) $var_id) . '" data-price="' . esc_attr($var_price) . '" data-regular-price="' . esc_attr($var_regular) . '" data-sale-price="' . esc_attr($var_sale) . '">' . esc_html($var_label . ('' !== $var_price ? ' — ' . $currency . $var_price : '')) . '</option>';
				}
				echo '</select>';
			} elseif ($has_any_variable) {
				echo '<div class="wof-product-variation-spacer" aria-hidden="true"></div>';
			}

			// Quantity spinner
			if (! empty($field['enableQuantity'])) {
				$min_qty = max(1, (int) ($field['minQuantity'] ?? 1));
				$max_qty = ! empty($field['maxQuantity']) ? max($min_qty, (int) $field['maxQuantity']) : 9999;
				echo '<span class="wof-choice-qty-wrap" onclick="event.stopPropagation();"><input type="number" class="wof-choice-qty-input" name="' . esc_attr('wooptions-pro_qty[' . $choice_uuid . ']') . '" data-wof-choice-uuid="' . esc_attr($choice_uuid) . '" data-wof-field-uuid="' . esc_attr((string) $field['uuid']) . '" value="' . esc_attr((string) $min_qty) . '" min="' . esc_attr((string) $min_qty) . '" max="' . esc_attr((string) $max_qty) . '" aria-label="' . esc_attr__('Quantity', 'wooptions-pro') . '"></span>';
			}

			echo '</label>';
		}
		echo '</div>';
	}

	/**
	 * Render color swatches as color blocks with label + price below.
	 *
	 * @param array<string,mixed> $field Field.
	 */
	private function render_color_swatches(array $field, string $name, string $description_id, string $row_uuid = ''): void {
		$multiple = ! empty($field['multiple']);
		$input    = $multiple ? 'checkbox' : 'radio';
		$group    = $multiple ? $name . '[]' : $name;
		$swatch_style = '';
		if (isset($field['choiceWidth']) && '' !== (string) $field['choiceWidth']) {
			$swatch_style .= 'width:' . esc_attr((string) $field['choiceWidth']) . 'px;';
		}
		if (isset($field['choiceHeight']) && '' !== (string) $field['choiceHeight']) {
			$swatch_style .= 'height:' . esc_attr((string) $field['choiceHeight']) . 'px;';
		}
		if (isset($field['choiceBorderRadius']) && '' !== (string) $field['choiceBorderRadius']) {
			$swatch_style .= 'border-radius:' . esc_attr((string) $field['choiceBorderRadius']) . 'px;overflow:hidden;';
		}

		echo '<div class="wof-swatches" role="group" aria-label="' . esc_attr((string) $field['label']) . '">';
		foreach ((array) ($field['choices'] ?? []) as $choice) {
			$choice_uuid = (string) ($choice['uuid'] ?? '');
			$id          = 'wof-' . $field['uuid'] . '-' . $choice_uuid . ('' !== $row_uuid ? '-' . $row_uuid : '');
			$checked     = ! empty($choice['default']);
			$color       = (string) ($choice['color'] ?? '#ddd');
			echo '<label class="wof-swatch-item" for="' . esc_attr($id) . '">';
			echo '<input id="' . esc_attr($id) . '" type="' . esc_attr($input) . '" name="' . esc_attr($group) . '" value="' . esc_attr($choice_uuid) . '"';
			echo checked($checked, true, false) . disabled(! empty($choice['disabled']), true, false);
			echo ' aria-describedby="' . esc_attr($description_id) . '">';
			echo '<span class="wof-swatch-item__color" style="background:' . esc_attr($color) . ';' . $swatch_style . '" aria-hidden="true">';
			echo '<span class="wof-swatch-item__check" aria-hidden="true"><svg viewBox="0 0 20 20" width="11" height="11" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg></span>';
			echo '</span>';
			echo '<span class="wof-choice__body">';
			echo '<span class="wof-swatch-item__label">' . esc_html((string) $choice['label']) . '</span>';
			if ('' !== (string) ($choice['description'] ?? '')) {
				echo '<small class="wof-choice__description">' . esc_html((string) $choice['description']) . '</small>';
			}
			$price_text = $this->choice_price_text((array) $choice, false);
			if ('' !== $price_text) {
				echo '<span class="wof-swatch-item__price">' . esc_html($price_text) . '</span>';
			}
			echo '</span>';
			if (! empty($field['enableQuantity'])) {
				$min_qty = max(1, (int) ($field['minQuantity'] ?? 1));
				$max_qty = ! empty($field['maxQuantity']) ? max($min_qty, (int) $field['maxQuantity']) : 9999;
				echo '<span class="wof-choice-qty-wrap" onclick="event.stopPropagation();"><input type="number" class="wof-choice-qty-input" name="' . esc_attr($name . '_qty[' . $choice_uuid . ']') . '" value="' . esc_attr((string) $min_qty) . '" min="' . esc_attr((string) $min_qty) . '" max="' . esc_attr((string) $max_qty) . '" aria-label="' . esc_attr__('Quantity', 'wooptions-pro') . '"></span>';
			}
			echo '</label>';
		}
		echo '</div>';
	}

	/**
	 * Render image swatches as thumbnail tiles with label + price below.
	 *
	 * @param array<string,mixed> $field Field.
	 */
	private function render_image_swatches(array $field, string $name, string $description_id, string $row_uuid = ''): void {
		$multiple = ! empty($field['multiple']);
		$input    = $multiple ? 'checkbox' : 'radio';
		$group    = $multiple ? $name . '[]' : $name;
		$thumb_style = '';
		if (isset($field['choiceWidth']) && '' !== (string) $field['choiceWidth']) {
			$thumb_style .= 'width:' . esc_attr((string) $field['choiceWidth']) . 'px;';
		}
		if (isset($field['choiceHeight']) && '' !== (string) $field['choiceHeight']) {
			$thumb_style .= 'height:' . esc_attr((string) $field['choiceHeight']) . 'px;';
		}
		if (isset($field['choiceBorderRadius']) && '' !== (string) $field['choiceBorderRadius']) {
			$thumb_style .= 'border-radius:' . esc_attr((string) $field['choiceBorderRadius']) . 'px;overflow:hidden;';
		}

		echo '<div class="wof-image-swatches" role="group" aria-label="' . esc_attr((string) $field['label']) . '">';
		foreach ((array) ($field['choices'] ?? []) as $choice) {
			$choice_uuid = (string) ($choice['uuid'] ?? '');
			$id          = 'wof-' . $field['uuid'] . '-' . $choice_uuid . ('' !== $row_uuid ? '-' . $row_uuid : '');
			$checked     = ! empty($choice['default']);
			echo '<label class="wof-image-swatch-item" for="' . esc_attr($id) . '">';
			echo '<input id="' . esc_attr($id) . '" type="' . esc_attr($input) . '" name="' . esc_attr($group) . '" value="' . esc_attr($choice_uuid) . '"';
			echo checked($checked, true, false) . disabled(! empty($choice['disabled']), true, false);
			if (! empty($field['updateProductImage'])) {
				$product_image_url = '';
				if ((int) ($choice['imageId'] ?? 0) > 0) {
					$resolved = wp_get_attachment_image_url((int) $choice['imageId'], 'woocommerce_single');
					if (! is_string($resolved) || '' === $resolved) {
						$resolved = wp_get_attachment_image_url((int) $choice['imageId'], 'full');
					}
					$product_image_url = is_string($resolved) ? $resolved : '';
				}
				if ('' === $product_image_url) {
					$product_image_url = (string) ($choice['imageUrl'] ?? '');
				}
				if ('' !== $product_image_url) {
					echo ' data-wof-product-image-url="' . esc_url($product_image_url) . '"';
				}
			}
			echo ' aria-describedby="' . esc_attr($description_id) . '">';
			echo '<span class="wof-image-swatch-item__thumb" style="' . $thumb_style . '" aria-hidden="true">';
			$image_html = '';
			if ((int) ($choice['imageId'] ?? 0) > 0) {
				$image_html = (string) wp_get_attachment_image((int) $choice['imageId'], 'thumbnail', false, ['class' => 'wof-image-swatch-item__img', 'alt' => '']);
			}
			if ('' === $image_html && '' !== (string) ($choice['imageUrl'] ?? '')) {
				$image_html = '<img class="wof-image-swatch-item__img" src="' . esc_url((string) $choice['imageUrl']) . '" alt="">';
			}
			if ('' !== $image_html) {
				echo wp_kses_post($image_html);
			} else {
				echo '<svg class="wof-image-swatch-item__placeholder" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.5 5.5h15v13h-15zM7.5 15l3.2-3.5 2.4 2.3 1.9-2 2.5 3.2M9 9.2h.01" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/></svg>';
			}
			echo '<span class="wof-image-swatch-item__check" aria-hidden="true"><svg viewBox="0 0 20 20" width="11" height="11" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg></span>';
			echo '</span>';
			echo '<span class="wof-choice__body">';
			echo '<span class="wof-image-swatch-item__label">' . esc_html((string) $choice['label']) . '</span>';
			if ('' !== (string) ($choice['description'] ?? '')) {
				echo '<small class="wof-choice__description">' . esc_html((string) $choice['description']) . '</small>';
			}
			$price_text = $this->choice_price_text((array) $choice, false);
			if ('' !== $price_text) {
				echo '<span class="wof-image-swatch-item__price">' . esc_html($price_text) . '</span>';
			}
			echo '</span>';
			if (! empty($field['enableQuantity'])) {
				$min_qty = max(1, (int) ($field['minQuantity'] ?? 1));
				$max_qty = ! empty($field['maxQuantity']) ? max($min_qty, (int) $field['maxQuantity']) : 9999;
				echo '<span class="wof-choice-qty-wrap" onclick="event.stopPropagation();"><input type="number" class="wof-choice-qty-input" name="' . esc_attr($name . '_qty[' . $choice_uuid . ']') . '" value="' . esc_attr((string) $min_qty) . '" min="' . esc_attr((string) $min_qty) . '" max="' . esc_attr((string) $max_qty) . '" aria-label="' . esc_attr__('Quantity', 'wooptions-pro') . '"></span>';
			}
			echo '</label>';
		}
		echo '</div>';
	}

	/**
	 * Render radio field as a vertical list with standard radio buttons.
	 *
	 * @param array<string,mixed> $field Field.
	 */
	private function render_radio_list(array $field, string $name, string $description_id, string $row_uuid = ''): void {
		$is_two_cols  = in_array((string) ($field['columns'] ?? 'one'), ['two', '2'], true);
		$list_class   = 'wof-radio-list' . ($is_two_cols ? ' wof-radio-list--cols-2' : '');
		$col_attr     = $is_two_cols ? ' data-columns="2"' : '';
		$image_style  = (string) ($field['imageStyle'] ?? 'normal');
		$img_base_cls = 'circle' === $image_style ? 'wof-choice-img wof-choice-img--circle' : 'wof-choice-img';

		echo '<div class="' . esc_attr($list_class) . '" role="radiogroup" aria-label="' . esc_attr((string) $field['label']) . '"' . $col_attr . '>';
		foreach ((array) ($field['choices'] ?? []) as $choice) {
			$choice_uuid = (string) ($choice['uuid'] ?? '');
			$id          = 'wof-' . $field['uuid'] . '-' . $choice_uuid . ('' !== $row_uuid ? '-' . $row_uuid : '');
			$checked     = ! empty($choice['default']) || (string) ($field['default'] ?? '') === $choice_uuid;
			echo '<label class="wof-radio-item" for="' . esc_attr($id) . '">';
			echo '<input id="' . esc_attr($id) . '" type="radio" name="' . esc_attr($name) . '" value="' . esc_attr($choice_uuid) . '"';
			echo checked($checked, true, false) . disabled(! empty($choice['disabled']), true, false);
			echo ' aria-describedby="' . esc_attr($description_id) . '">';

			$image_html = '';
			if ((int) ($choice['imageId'] ?? 0) > 0) {
				$image_html = (string) wp_get_attachment_image((int) $choice['imageId'], 'thumbnail', false, ['class' => $img_base_cls, 'alt' => '']);
			}
			if ('' === $image_html && '' !== (string) ($choice['imageUrl'] ?? '')) {
				$image_html = '<img class="' . esc_attr($img_base_cls) . '" src="' . esc_url((string) $choice['imageUrl']) . '" alt="">';
			}
			if ('' !== $image_html) {
				echo wp_kses_post($image_html);
			}

			echo '<span class="wof-radio-item__text">';
			echo '<span class="wof-radio-item__label">' . esc_html((string) $choice['label']) . '</span>';
			if ('' !== (string) ($choice['description'] ?? '')) {
				echo '<small class="wof-choice__description">' . esc_html((string) $choice['description']) . '</small>';
			}
			echo '</span>';
			$price_text = $this->choice_price_text((array) $choice, false);
			if ('' !== $price_text) {
				echo '<span class="wof-radio-item__price">' . esc_html($price_text) . '</span>';
			}
			echo '</label>';
		}
		echo '</div>';
	}

	/**
	 * Render checkbox group as a vertical list with standard checkboxes.
	 *
	 * @param array<string,mixed> $field Field.
	 */
	private function render_checkbox_list(array $field, string $name, string $description_id, string $row_uuid = ''): void {
		$is_two_cols  = in_array((string) ($field['columns'] ?? 'one'), ['two', '2'], true);
		$list_class   = 'wof-checkbox-list' . ($is_two_cols ? ' wof-checkbox-list--cols-2' : '');
		$col_attr     = $is_two_cols ? ' data-columns="2"' : '';
		$image_style  = (string) ($field['imageStyle'] ?? 'normal');
		$img_base_cls = 'circle' === $image_style ? 'wof-choice-img wof-choice-img--circle' : 'wof-choice-img';

		echo '<div class="' . esc_attr($list_class) . '" role="group" aria-label="' . esc_attr((string) $field['label']) . '"' . $col_attr . '>';
		foreach ((array) ($field['choices'] ?? []) as $choice) {
			$choice_uuid = (string) ($choice['uuid'] ?? '');
			$id          = 'wof-' . $field['uuid'] . '-' . $choice_uuid . ('' !== $row_uuid ? '-' . $row_uuid : '');
			$checked     = ! empty($choice['default']) || (is_array($field['default'] ?? null) && in_array($choice_uuid, (array) $field['default'], true)) || (string) ($field['default'] ?? '') === $choice_uuid;
			echo '<label class="wof-checkbox-item" for="' . esc_attr($id) . '">';
			echo '<input id="' . esc_attr($id) . '" type="checkbox" name="' . esc_attr($name . '[]') . '" value="' . esc_attr($choice_uuid) . '"';
			echo checked($checked, true, false) . disabled(! empty($choice['disabled']), true, false);
			echo ' aria-describedby="' . esc_attr($description_id) . '">';

			$image_html = '';
			if ((int) ($choice['imageId'] ?? 0) > 0) {
				$image_html = (string) wp_get_attachment_image((int) $choice['imageId'], 'thumbnail', false, ['class' => $img_base_cls, 'alt' => '']);
			}
			if ('' === $image_html && '' !== (string) ($choice['imageUrl'] ?? '')) {
				$image_html = '<img class="' . esc_attr($img_base_cls) . '" src="' . esc_url((string) $choice['imageUrl']) . '" alt="">';
			}
			if ('' !== $image_html) {
				echo wp_kses_post($image_html);
			}

			echo '<span class="wof-checkbox-item__text">';
			echo '<span class="wof-checkbox-item__label">' . esc_html((string) $choice['label']) . '</span>';
			if ('' !== (string) ($choice['description'] ?? '')) {
				echo '<small class="wof-choice__description">' . esc_html((string) $choice['description']) . '</small>';
			}
			echo '</span>';
			$price_text = $this->choice_price_text((array) $choice, false);
			if ('' !== $price_text) {
				echo '<span class="wof-checkbox-item__price">' . esc_html($price_text) . '</span>';
			}
			echo '</label>';
		}
		echo '</div>';
	}

	/**
	 * @param array<string,mixed> $field Field.
	 */
	private function render_boolean(array $field, string $name, string $description_id, string $row_uuid = ''): void {
		$uuid         = (string) $field['uuid'];
		$row_suffix   = '' !== $row_uuid ? '-' . $row_uuid : '';
		$id           = 'wof-' . $uuid . $row_suffix;
		$is_checkbox  = 'checkbox' === ((string) ($field['type'] ?? ''));
		$wrapper_cls  = 'wof-boolean' . ($is_checkbox ? ' wof-boolean--checkbox' : ' wof-boolean--toggle');
		echo '<label class="' . esc_attr($wrapper_cls) . '" for="' . esc_attr($id) . '">';
		echo '<input id="' . esc_attr($id) . '" type="checkbox" name="' . esc_attr($name) . '" value="1"';
		echo checked(! empty($field['default']), true, false) . $this->input_attributes($field, $description_id) . '>';
		echo '<span class="wof-boolean__control" aria-hidden="true">';
		if ($is_checkbox) {
			echo '<svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
		}
		echo '</span>';
		$help_text  = trim((string) ($field['help'] ?? ''));
		$help_pos   = (string) ($field['helpTextPosition'] ?? 'below_title');
		$price_text = $this->choice_price_text($field, false);
		echo '<span><span class="wof-boolean__label-row"><strong>' . esc_html((string) $field['label']) . '</strong>';
		if ('' !== $help_text && 'tooltip' === $help_pos) {
			echo $this->render_tooltip_icon($help_text);
		}
		if ('' !== $price_text) {
			echo ' <span class="wof-boolean__price">' . esc_html($price_text) . '</span>';
		}
		echo '</span>';
		if ('' !== $help_text && 'below_title' === $help_pos) {
			echo '<small class="wof-field__help wof-field__help--below-title">' . esc_html($help_text) . '</small>';
		}
		echo '</span></label>';
	}

	/**
	 * @param array<string,mixed> $field Field.
	 */
	private function render_color_picker(array $field, string $name, string $description_id, string $row_uuid = ''): void {
		$uuid       = (string) $field['uuid'];
		$row_suffix = '' !== $row_uuid ? '-' . $row_uuid : '';
		$id         = 'wof-' . $uuid . $row_suffix;
		$value      = strtoupper((string) ($field['default'] ?? '#5B4FF5'));
		if (1 !== preg_match('/\A#[0-9A-F]{6}\z/', $value)) {
			$value = '#5B4FF5';
		}
		$price_text = $this->choice_price_text($field, false);
		echo '<div class="wof-color-picker" data-wof-color-picker>';
		echo '<input id="' . esc_attr($id) . '" type="hidden" name="' . esc_attr($name) . '" value="' . esc_attr($value) . '" data-wof-color-input';
		echo $this->input_attributes($field, $description_id) . '>';
		echo '<div class="wof-color-picker__trigger" data-wof-color-trigger tabindex="0" role="button" aria-haspopup="dialog" aria-expanded="false">';
		echo '<span class="wof-color-picker__swatch" style="background-color:' . esc_attr($value) . '" data-wof-color-swatch aria-hidden="true"></span>';
		echo '<span class="wof-color-picker__value"><strong data-wof-color-value>' . esc_html($value) . '</strong><small>' . esc_html__('Click to choose a color', 'wooptions-pro') . '</small></span>';
		if ('' !== $price_text) {
			echo '<span class="wof-color-picker__price">' . esc_html($price_text) . '</span>';
		}
		echo '<svg class="wof-color-picker__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2.1-.82 2.1-1.72 0-.55-.28-1.02-.28-1.52 0-.82.67-1.49 1.49-1.49h1.22A3.97 3.97 0 0 0 20.5 11.8 8.3 8.3 0 0 0 12 3.5Zm-4.1 9.05a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm1.7-4.1a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm4.3-.7a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm3.1 3.25a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Z" fill="currentColor"/></svg>';
		echo '</div>';
		echo '<div class="wof-color-picker__dropdown" data-wof-color-dropdown role="dialog" aria-modal="false" tabindex="-1"></div>';
		echo '</div>';
	}

	/**
	 * @param array<string,mixed> $field Field.
	 */
	private function render_scalar(array $field, string $name, string $description_id, string $row_uuid = ''): void {
		$type_map = [
			'textarea' => 'textarea', 'tel' => 'tel', 'email' => 'email',
			'url' => 'url', 'number' => 'number', 'range' => 'range',
			'date' => 'date', 'time' => 'time', 'datetime' => 'datetime-local',
			'customer_defined_price' => 'number', 'color_picker' => 'color', 'text' => 'text',
		];
		$uuid = (string) ($field['uuid'] ?? '');
		$type = (string) ($field['type'] ?? 'text');
		$row_suffix = '' !== $row_uuid ? '-' . $row_uuid : '';
		$id         = 'wof-' . $uuid . $row_suffix;
		$transform_style = '';
		$text_transform  = (string) ($field['textTransform'] ?? 'none');
		if (in_array($text_transform, ['uppercase', 'lowercase', 'capitalize'], true)) {
			$transform_style = ' style="text-transform: ' . esc_attr($text_transform) . ';"';
		}

		if ('textarea' === $type) {
			$rows = max(1, (int) ($field['rows'] ?? 4));
			echo '<textarea id="' . esc_attr($id) . '" name="' . esc_attr($name) . '" rows="' . esc_attr((string) $rows) . '"' . $transform_style . ' placeholder="' . esc_attr((string) ($field['placeholder'] ?? '')) . '"';
			echo $this->input_attributes($field, $description_id) . '>' . esc_textarea((string) ($field['default'] ?? '')) . '</textarea>';
			return;
		}
		if ('date_range' === $type) {
			$this->render_custom_date_range($field, $name, $description_id, $row_uuid);
			return;
		}
		if (in_array($type, ['datetime', 'date', 'time'], true)) {
			$this->render_custom_datetime($field, $name, $description_id, $row_uuid);
			return;
		}
		if ('tel' === $type) {
			$flag_style      = (string) ($field['flagStyle'] ?? 'number_only');
			$default_country = strtoupper((string) ($field['defaultCountry'] ?? 'US'));
			if ('number_only' !== $flag_style) {
				$countries    = $this->country_definitions();
				$curr_country = $countries[$default_country] ?? $countries['US'];
				$dial_code    = $curr_country['dial'];
				$flag_svg     = $this->country_flag_svg($default_country);

				echo '<div class="wof-phone-field-wrap" data-wof-phone-wrap>';
				echo '<div class="wof-phone-picker" data-wof-phone-picker>';
				echo '<button type="button" class="wof-phone-picker__trigger" data-wof-phone-trigger aria-haspopup="listbox" aria-expanded="false" aria-label="' . esc_attr__('Select country', 'wooptions-pro') . '">';
				echo '<span class="wof-phone-picker__flag" data-wof-flag-slot>' . $flag_svg . '</span>';
				echo '<span class="wof-phone-picker__code" data-wof-country-slot>' . esc_html($default_country) . '</span>';
				if ('number_flag_dialcode' === $flag_style) {
					echo '<span class="wof-phone-picker__dial" data-wof-dial-slot>' . esc_html($dial_code) . '</span>';
				}
				echo '<svg class="wof-phone-picker__chevron" viewBox="0 0 20 20" width="12" height="12" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>';
				echo '</button>';

				echo '<select class="wof-phone-country-select" name="' . esc_attr($name . '[country]') . '" aria-label="' . esc_attr__('Select country', 'wooptions-pro') . '" data-wof-phone-select tabindex="-1" style="display:none;" aria-hidden="true">';
				foreach ($countries as $code => $info) {
					echo '<option value="' . esc_attr($code) . '" data-dial="' . esc_attr($info['dial']) . '"' . selected($code, $default_country, false) . '>';
					echo esc_html($info['name'] . ' (' . $info['dial'] . ')');
					echo '</option>';
				}
				echo '</select>';

				echo '<div class="wof-phone-picker__dropdown" data-wof-phone-dropdown role="listbox" tabindex="-1">';
				echo '<div class="wof-phone-picker__search-wrap">';
				echo '<svg class="wof-phone-picker__search-icon" viewBox="0 0 20 20" width="13" height="13" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>';
				echo '<input type="text" class="wof-phone-picker__search" placeholder="' . esc_attr__('Search country…', 'wooptions-pro') . '" data-wof-phone-search autocomplete="off" spellcheck="false">';
				echo '</div>';
				echo '<div class="wof-phone-picker__list" data-wof-phone-list>';
				foreach ($countries as $code => $info) {
					$opt_flag_svg = $this->country_flag_svg($code);
					$is_curr      = ($code === $default_country);
					$opt_cls      = 'wof-phone-picker__option' . ($is_curr ? ' is-selected' : '');
					echo '<div class="' . esc_attr($opt_cls) . '" data-wof-phone-option data-code="' . esc_attr($code) . '" data-dial="' . esc_attr($info['dial']) . '" data-name="' . esc_attr($info['name']) . '" role="option" aria-selected="' . ($is_curr ? 'true' : 'false') . '">';
					echo '<span class="wof-phone-picker__option-flag">' . $opt_flag_svg . '</span>';
					echo '<span class="wof-phone-picker__option-name">' . esc_html($info['name']) . '</span>';
					echo '<span class="wof-phone-picker__option-dial">' . esc_html($info['dial']) . '</span>';
					echo '</div>';
				}
				echo '</div>';
				echo '</div>';
				echo '</div>';
				echo '<input id="' . esc_attr($id) . '" type="tel" name="' . esc_attr($name . '[number]') . '" value="' . esc_attr((string) ($field['default'] ?? '')) . '" class="wof-phone-number-input"';
				echo ' placeholder="' . esc_attr((string) ($field['placeholder'] ?? __('Enter phone number…', 'wooptions-pro'))) . '"';
				echo $this->input_attributes($field, $description_id) . '>';
				echo '</div>';
				return;
			}
		}
		if ('range' === $type) {
			if (! isset($field['min']) || '' === (string) $field['min']) {
				$field['min'] = '1';
			}
			if (! isset($field['max']) || '' === (string) $field['max']) {
				$field['max'] = '100';
			}
			if (! isset($field['step']) || '' === (string) $field['step']) {
				$field['step'] = '1';
			}
			if (! isset($field['default']) || '' === (string) $field['default']) {
				$field['default'] = '10';
			}
			$default_val    = (string) $field['default'];
			$enable_postfix = ! empty($field['enablePostfix']);
			$postfix        = $enable_postfix ? (string) ($field['postfix'] ?? 'PostFix') : '';
			$box_class      = ($enable_postfix && '' !== $postfix) ? 'wof-range-box' : 'wof-range-box wof-range-box--no-postfix';

			echo '<div class="wof-range-wrap" data-wof-range-wrap>';
			echo '<input id="' . esc_attr($id) . '" type="range" class="wof-range-slider" name="' . esc_attr($name) . '" value="' . esc_attr($default_val) . '"';
			echo $this->input_attributes($field, $description_id) . ' data-wof-range-slider>';
			echo '<div class="' . esc_attr($box_class) . '">';
			echo '<span class="wof-range-output" data-wof-range-output>' . esc_html($default_val) . '</span>';
			if ($enable_postfix && '' !== $postfix) {
				echo '<span class="wof-range-postfix">' . esc_html($postfix) . '</span>';
			}
			echo '</div>';
			echo '</div>';
			return;
		}
		$html_type  = $type_map[$type] ?? 'text';
		$style_attr = ('text' === $type) ? $transform_style : '';
		echo '<input id="' . esc_attr($id) . '" type="' . esc_attr($html_type) . '" name="' . esc_attr($name) . '" value="' . esc_attr((string) ($field['default'] ?? '')) . '"' . $style_attr;
		echo ' placeholder="' . esc_attr((string) ($field['placeholder'] ?? '')) . '"';
		echo $this->input_attributes($field, $description_id) . '>';
	}

	/**
	 * @param array<string,mixed> $field Field.
	 */
	private function render_custom_datetime(array $field, string $name, string $description_id, string $row_uuid = ''): void {
		$type            = (string) ($field['type'] ?? 'datetime');
		$date_time_type  = (string) ($field['dateTimeType'] ?? ('time' === $type ? 'time' : 'date'));
		$uuid            = (string) $field['uuid'];
		$row_suffix      = '' !== $row_uuid ? '-' . $row_uuid : '';
		$id              = 'wof-' . $uuid . $row_suffix;
		$default_val     = (string) ($field['default'] ?? '');
		$placeholder     = (string) ($field['placeholder'] ?? '');
		$date_format     = (string) ($field['dateFormat'] ?? 'DD/MM/YYYY');
		$time_format     = (string) ($field['timeFormat'] ?? '12');

		$config = [
			'type'                => $date_time_type,
			'dateFormat'          => $date_format,
			'wpDateFormat'        => get_option('date_format', 'F j, Y'),
			'minDateType'         => (string) ($field['minDateType'] ?? 'none'),
			'minDateCustom'       => (string) ($field['minDateCustom'] ?? ''),
			'maxDateType'         => (string) ($field['maxDateType'] ?? 'none'),
			'maxDateCustom'       => (string) ($field['maxDateCustom'] ?? ''),
			'disableToday'        => ! empty($field['disableToday']),
			'disableNextNDays'    => (int) ($field['disableNextNDays'] ?? 0),
			'disabledDates'       => is_array($field['disabledDates'] ?? null) ? array_values($field['disabledDates']) : [],
			'disabledWeekdays'    => is_array($field['disabledWeekdays'] ?? null) ? array_values(array_map('intval', $field['disabledWeekdays'])) : [],
			'disabledMonthlyDays' => (string) ($field['disabledMonthlyDays'] ?? ''),
			'minTime'             => (string) ($field['minTime'] ?? ''),
			'maxTime'             => (string) ($field['maxTime'] ?? ''),
			'timeFormat'          => $time_format,
		];

		$cal_icon   = '<svg class="wof-custom-datetime__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';
		$clock_icon = '<svg class="wof-custom-datetime__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';

		$date_ph = '' !== $placeholder ? $placeholder : ('wp_default' === $date_format ? date_i18n(get_option('date_format', 'F j, Y')) : $date_format);
		$time_ph = '' !== $placeholder ? $placeholder : ('24' === $time_format ? '12:00' : '12:00 PM');
		$price_text = $this->choice_price_text($field, false);

		echo '<div class="wof-custom-datetime" data-wof-custom-datetime data-wof-datetime-config="' . esc_attr(wp_json_encode($config)) . '">';
		echo '<input type="hidden" id="' . esc_attr($id) . '" name="' . esc_attr($name) . '" value="' . esc_attr($default_val) . '" ' . $this->input_attributes($field, $description_id) . ' data-wof-datetime-value>';

		if ('date' === $date_time_type) {
			echo '<div class="wof-custom-datetime__trigger" data-wof-datetime-trigger="date" tabindex="0" role="button" aria-haspopup="dialog" aria-expanded="false">';
			echo $cal_icon;
			echo '<span class="wof-custom-datetime__display" data-wof-datetime-display="date" data-wof-placeholder="' . esc_attr($date_ph) . '">' . esc_html($default_val ?: $date_ph) . '</span>';
			if ('' !== $price_text) {
				echo '<span class="wof-custom-datetime__price">' . esc_html($price_text) . '</span>';
			}
			echo '</div>';
		} elseif ('time' === $date_time_type) {
			echo '<div class="wof-custom-datetime__trigger" data-wof-datetime-trigger="time" tabindex="0" role="button" aria-haspopup="dialog" aria-expanded="false">';
			echo $clock_icon;
			echo '<span class="wof-custom-datetime__display" data-wof-datetime-display="time" data-wof-placeholder="' . esc_attr($time_ph) . '">' . esc_html($default_val ?: $time_ph) . '</span>';
			if ('' !== $price_text) {
				echo '<span class="wof-custom-datetime__price">' . esc_html($price_text) . '</span>';
			}
			echo '</div>';
		} else {
			echo '<div class="wof-custom-datetime__dual">';
			echo '<div class="wof-custom-datetime__trigger" data-wof-datetime-trigger="date" tabindex="0" role="button" aria-haspopup="dialog" aria-expanded="false">';
			echo $cal_icon;
			echo '<span class="wof-custom-datetime__display" data-wof-datetime-display="date" data-wof-placeholder="' . esc_attr($date_ph) . '">' . esc_html($date_ph) . '</span>';
			echo '</div>';
			echo '<div class="wof-custom-datetime__trigger" data-wof-datetime-trigger="time" tabindex="0" role="button" aria-haspopup="dialog" aria-expanded="false">';
			echo $clock_icon;
			echo '<span class="wof-custom-datetime__display" data-wof-datetime-display="time" data-wof-placeholder="' . esc_attr($time_ph) . '">' . esc_html($time_ph) . '</span>';
			if ('' !== $price_text) {
				echo '<span class="wof-custom-datetime__price">' . esc_html($price_text) . '</span>';
			}
			echo '</div>';
			echo '</div>';
		}

		echo '<div class="wof-custom-datetime__dropdown" data-wof-datetime-dropdown role="dialog" aria-modal="false" tabindex="-1"></div>';
		echo '</div>';
	}

	/**
	 * @param array<string,mixed> $field Field.
	 */
	private function render_custom_date_range(array $field, string $name, string $description_id, string $row_uuid = ''): void {
		$uuid          = (string) $field['uuid'];
		$row_suffix    = '' !== $row_uuid ? '-' . $row_uuid : '';
		$placeholder   = (string) ($field['placeholder'] ?? '');
		$date_format   = (string) ($field['dateFormat'] ?? 'DD/MM/YYYY');
		$default       = $field['default'] ?? null;
		$default_start = is_array($default) ? (string) ($default['start'] ?? '') : '';
		$default_end   = is_array($default) ? (string) ($default['end'] ?? '') : '';

		$config = [
			'dateFormat'          => $date_format,
			'wpDateFormat'        => get_option('date_format', 'F j, Y'),
			'minDateType'         => (string) ($field['minDateType'] ?? 'none'),
			'minDateCustom'       => (string) ($field['minDateCustom'] ?? ''),
			'maxDateType'         => (string) ($field['maxDateType'] ?? 'none'),
			'maxDateCustom'       => (string) ($field['maxDateCustom'] ?? ''),
			'disableToday'        => ! empty($field['disableToday']),
			'disableNextNDays'    => (int) ($field['disableNextNDays'] ?? 0),
			'disabledDates'       => is_array($field['disabledDates'] ?? null) ? array_values($field['disabledDates']) : [],
			'disabledWeekdays'    => is_array($field['disabledWeekdays'] ?? null) ? array_values(array_map('intval', $field['disabledWeekdays'])) : [],
			'disabledMonthlyDays' => (string) ($field['disabledMonthlyDays'] ?? ''),
			'minDays'             => (int) ($field['minDays'] ?? 0),
			'maxDays'             => (int) ($field['maxDays'] ?? 0),
			'allowSameDay'        => ! isset($field['allowSameDay']) || ! empty($field['allowSameDay']),
		];

		$cal_icon = '<svg class="wof-custom-datetime__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';

		$date_ph = '' !== $placeholder ? $placeholder : ('wp_default' === $date_format ? date_i18n(get_option('date_format', 'F j, Y')) : $date_format);
		$price_text = $this->choice_price_text($field, false);

		echo '<div class="wof-custom-daterange" data-wof-custom-daterange data-wof-daterange-config="' . esc_attr(wp_json_encode($config)) . '">';
		echo '<input type="hidden" id="wof-' . esc_attr($uuid . $row_suffix) . '-start" name="' . esc_attr($name . '[start]') . '" value="' . esc_attr($default_start) . '" ' . $this->input_attributes($field, $description_id) . ' data-wof-daterange-start>';
		echo '<input type="hidden" id="wof-' . esc_attr($uuid . $row_suffix) . '-end" name="' . esc_attr($name . '[end]') . '" value="' . esc_attr($default_end) . '" data-wof-daterange-end>';

		echo '<div class="wof-custom-daterange__group">';
		echo '<div class="wof-custom-datetime__trigger wof-custom-daterange__trigger--start" data-wof-daterange-trigger="start" tabindex="0" role="button" aria-haspopup="dialog" aria-expanded="false" aria-label="' . esc_attr__('Start date', 'wooptions-pro') . '">';
		echo $cal_icon;
		echo '<span class="wof-custom-datetime__display" data-wof-daterange-display="start" data-wof-placeholder="' . esc_attr($date_ph) . '">' . esc_html($default_start ?: $date_ph) . '</span>';
		echo '</div>';

		echo '<span class="wof-custom-daterange__sep" aria-hidden="true">→</span>';

		echo '<div class="wof-custom-datetime__trigger wof-custom-daterange__trigger--end" data-wof-daterange-trigger="end" tabindex="0" role="button" aria-haspopup="dialog" aria-expanded="false" aria-label="' . esc_attr__('End date', 'wooptions-pro') . '">';
		echo $cal_icon;
		echo '<span class="wof-custom-datetime__display" data-wof-daterange-display="end" data-wof-placeholder="' . esc_attr($date_ph) . '">' . esc_html($default_end ?: $date_ph) . '</span>';
		if ('' !== $price_text) {
			echo '<span class="wof-custom-datetime__price">' . esc_html($price_text) . '</span>';
		}
		echo '</div>';
		echo '</div>';

		echo '<div class="wof-custom-datetime__dropdown" data-wof-daterange-dropdown role="dialog" aria-modal="false" tabindex="-1"></div>';
		echo '</div>';
	}

	public function country_definitions(): array {
		return ScalarFieldType::country_definitions();
	}

	public function country_flag_svg(string $country): string {
		$country = strtoupper(trim($country));
		return match ($country) {
			'BD' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" fill="#006A4E" rx="2"/><circle cx="9" cy="7" r="4.2" fill="#F42A41"/></svg>',
			'US' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" fill="#B22234" rx="2"/><rect y="2.1" width="20" height="2" fill="#FFFFFF"/><rect y="6.3" width="20" height="2" fill="#FFFFFF"/><rect y="10.5" width="20" height="2" fill="#FFFFFF"/><rect width="8" height="7.2" fill="#3C3B6E"/><circle cx="4" cy="3.6" r="1.5" fill="#FFFFFF"/></svg>',
			'GB' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" fill="#012169" rx="2"/><path d="M0 0L20 14M20 0L0 14" stroke="#FFFFFF" stroke-width="2.5"/><path d="M0 0L20 14M20 0L0 14" stroke="#C8102E" stroke-width="1.2"/><path d="M10 0v14M0 7h20" stroke="#FFFFFF" stroke-width="4"/><path d="M10 0v14M0 7h20" stroke="#C8102E" stroke-width="2.2"/></svg>',
			'CA' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" fill="#D80027" rx="2"/><rect x="5" width="10" height="14" fill="#FFFFFF"/><polygon points="10,2.5 11,5.5 13.5,5 12,7 13.5,8.5 11,8 10.5,11 9.5,11 9,8 6.5,8.5 8,7 6.5,5 9,5.5" fill="#D80027"/></svg>',
			'AU' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" fill="#00008B" rx="2"/><circle cx="14" cy="4" r="1" fill="#FFFFFF"/><circle cx="16" cy="7" r="1" fill="#FFFFFF"/><circle cx="13" cy="10" r="1" fill="#FFFFFF"/></svg>',
			'DE' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="4.66" fill="#000000" rx="2"/><rect y="4.66" width="20" height="4.66" fill="#DD0000"/><rect y="9.33" width="20" height="4.67" fill="#FFCE00"/></svg>',
			'FR' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="6.6" height="14" fill="#002654" rx="2"/><rect x="6.6" width="6.8" height="14" fill="#FFFFFF"/><rect x="13.4" width="6.6" height="14" fill="#CE1126"/></svg>',
			'IT' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="6.6" height="14" fill="#009246" rx="2"/><rect x="6.6" width="6.8" height="14" fill="#FFFFFF"/><rect x="13.4" width="6.6" height="14" fill="#CE2B37"/></svg>',
			'ES' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="3.5" fill="#AA151B" rx="2"/><rect y="3.5" width="20" height="7" fill="#F1BF00"/><rect y="10.5" width="20" height="3.5" fill="#AA151B"/></svg>',
			'NL' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="4.66" fill="#AE1C28" rx="2"/><rect y="4.66" width="20" height="4.66" fill="#FFFFFF"/><rect y="9.33" width="20" height="4.67" fill="#21468B"/></svg>',
			'BR' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" fill="#009C3B" rx="2"/><polygon points="10,2 18,7 10,12 2,7" fill="#FEDF00"/><circle cx="10" cy="7" r="2.5" fill="#002776"/></svg>',
			'IN' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="4.66" fill="#FF9933" rx="2"/><rect y="4.66" width="20" height="4.66" fill="#FFFFFF"/><rect y="9.33" width="20" height="4.67" fill="#138808"/><circle cx="10" cy="7" r="1.8" fill="#000080"/></svg>',
			'CN' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" fill="#DE2910" rx="2"/><polygon points="4,2.5 4.6,4.2 6.2,4.2 4.9,5.2 5.4,6.8 4,5.8 2.6,6.8 3.1,5.2 1.8,4.2 3.4,4.2" fill="#FFDE00"/></svg>',
			'JP' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" fill="#FFFFFF" rx="2"/><circle cx="10" cy="7" r="4" fill="#BC002D"/></svg>',
			'KR' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" fill="#FFFFFF" rx="2"/><circle cx="10" cy="7" r="3.5" fill="#CD2E3A"/><path d="M10 7a3.5 3.5 0 0 1 0 3.5 3.5 3.5 0 0 0 0-7z" fill="#0047A0"/></svg>',
			'MX' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="6.6" height="14" fill="#006847" rx="2"/><rect x="6.6" width="6.8" height="14" fill="#FFFFFF"/><rect x="13.4" width="6.6" height="14" fill="#CE1126"/><circle cx="10" cy="7" r="1.5" fill="#8B5A2B"/></svg>',
			'AE' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect y="0" width="20" height="4.66" fill="#00732F" rx="2"/><rect y="4.66" width="20" height="4.66" fill="#FFFFFF"/><rect y="9.33" width="20" height="4.67" fill="#000000"/><rect width="5" height="14" fill="#FF0000"/></svg>',
			'SA' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" fill="#006C35" rx="2"/><rect x="4" y="6.2" width="12" height="1.6" fill="#FFFFFF"/></svg>',
			'SG' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="7" fill="#ED2939" rx="2"/><rect y="7" width="20" height="7" fill="#FFFFFF"/><circle cx="4.5" cy="3.5" r="2.2" fill="#FFFFFF"/><circle cx="5.2" cy="3.5" r="1.8" fill="#ED2939"/></svg>',
			'PK' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="5" height="14" fill="#FFFFFF" rx="2"/><rect x="5" width="15" height="14" fill="#01411C"/><circle cx="12" cy="7" r="3.2" fill="#FFFFFF"/><circle cx="13" cy="6.4" r="2.7" fill="#01411C"/></svg>',
			'ZA' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="7" fill="#E03C31" rx="2"/><rect y="7" width="20" height="7" fill="#001489"/><polygon points="0,0 8,7 0,14" fill="#000000"/><path d="M0 0l8.5 7-8.5 7h3l7-5.5v-3l-7-5.5z" fill="#FFB81C"/><path d="M8 5.5h12v3h-12z" fill="#007749"/></svg>',
			'TR' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" fill="#E30A17" rx="2"/><circle cx="8" cy="7" r="3.5" fill="#FFFFFF"/><circle cx="9" cy="7" r="2.8" fill="#E30A17"/><polygon points="12.5,5.5 13.5,7 15,7 13.8,8 14.2,9.5 13,8.5 11.8,9.5 12.2,8 11,7 12.5,7" fill="#FFFFFF"/></svg>',
			'SE' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" fill="#005293" rx="2"/><rect x="6" width="3" height="14" fill="#FECB00"/><rect y="5.5" width="20" height="3" fill="#FECB00"/></svg>',
			'CH' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" fill="#D52B1E" rx="2"/><rect x="8.5" y="3" width="3" height="8" fill="#FFFFFF"/><rect x="6" y="5.5" width="8" height="3" fill="#FFFFFF"/></svg>',
			'PL' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="7" fill="#FFFFFF" rx="2"/><rect y="7" width="20" height="7" fill="#DC143C"/></svg>',
			'AR' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="4.66" fill="#74ACDF" rx="2"/><rect y="4.66" width="20" height="4.66" fill="#FFFFFF"/><rect y="9.33" width="20" height="4.67" fill="#74ACDF"/><circle cx="10" cy="7" r="1.6" fill="#F6B40E"/></svg>',
			'BE' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="6.6" height="14" fill="#000000" rx="2"/><rect x="6.6" width="6.8" height="14" fill="#FDDA24"/><rect x="13.4" width="6.6" height="14" fill="#EF3340"/></svg>',
			'AT' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="4.66" fill="#ED2939" rx="2"/><rect y="4.66" width="20" height="4.66" fill="#FFFFFF"/><rect y="9.33" width="20" height="4.67" fill="#ED2939"/></svg>',
			'NO' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" fill="#BA0C2F" rx="2"/><rect x="5.5" width="4" height="14" fill="#FFFFFF"/><rect y="5" width="20" height="4" fill="#FFFFFF"/><rect x="6.5" width="2" height="14" fill="#00205B"/><rect y="6" width="20" height="2" fill="#00205B"/></svg>',
			'DK' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" fill="#C60C30" rx="2"/><rect x="6" width="2.5" height="14" fill="#FFFFFF"/><rect y="5.7" width="20" height="2.5" fill="#FFFFFF"/></svg>',
			'FI' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" fill="#FFFFFF" rx="2"/><rect x="6" width="3" height="14" fill="#002F6C"/><rect y="5.5" width="20" height="3" fill="#002F6C"/></svg>',
			'IE' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="6.6" height="14" fill="#169B62" rx="2"/><rect x="6.6" width="6.8" height="14" fill="#FFFFFF"/><rect x="13.4" width="6.6" height="14" fill="#FF883E"/></svg>',
			'NZ' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" fill="#00247D" rx="2"/><circle cx="14" cy="4" r="1.1" fill="#CC142B"/><circle cx="16.5" cy="7" r="1.1" fill="#CC142B"/><circle cx="13" cy="10" r="1.1" fill="#CC142B"/></svg>',
			'PT' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="8" height="14" fill="#046A38" rx="2"/><rect x="8" width="12" height="14" fill="#DA291C"/><circle cx="8" cy="7" r="2.5" fill="#FFE900"/></svg>',
			'GR' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" fill="#0D5EAF" rx="2"/><rect y="1.5" width="20" height="1.5" fill="#FFFFFF"/><rect y="4.6" width="20" height="1.5" fill="#FFFFFF"/><rect y="7.7" width="20" height="1.5" fill="#FFFFFF"/><rect y="10.8" width="20" height="1.5" fill="#FFFFFF"/><rect width="7.5" height="7.7" fill="#0D5EAF"/><rect x="3" width="1.5" height="7.7" fill="#FFFFFF"/><rect y="3.1" width="7.5" height="1.5" fill="#FFFFFF"/></svg>',
			'IL' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" fill="#FFFFFF" rx="2"/><rect y="1.5" width="20" height="2" fill="#0038B8"/><rect y="10.5" width="20" height="2" fill="#0038B8"/><polygon points="10,4.5 12,8 8,8" stroke="#0038B8" stroke-width="0.7" fill="none"/><polygon points="10,9 12,5.5 8,5.5" stroke="#0038B8" stroke-width="0.7" fill="none"/></svg>',
			'HK' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" fill="#C8102E" rx="2"/><circle cx="10" cy="7" r="3" fill="#FFFFFF"/></svg>',
			'MY' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" fill="#CC0000" rx="2"/><rect y="2" width="20" height="2" fill="#FFFFFF"/><rect y="6" width="20" height="2" fill="#FFFFFF"/><rect y="10" width="20" height="2" fill="#FFFFFF"/><rect width="10" height="8" fill="#010066"/><circle cx="5" cy="4" r="2.5" fill="#FFCC00"/><circle cx="5.8" cy="4" r="2.1" fill="#010066"/></svg>',
			'PH' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="7" fill="#0038A8" rx="2"/><rect y="7" width="20" height="7" fill="#CE1126"/><polygon points="0,0 8,7 0,14" fill="#FFFFFF"/><circle cx="2.8" cy="7" r="1.3" fill="#FCD116"/></svg>',
			'ID' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="7" fill="#CE1126" rx="2"/><rect y="7" width="20" height="7" fill="#FFFFFF"/></svg>',
			'TH' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" fill="#A51931" rx="2"/><rect y="2.3" width="20" height="9.4" fill="#F4F5F8"/><rect y="4.6" width="20" height="4.8" fill="#2D2A4A"/></svg>',
			'VN' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" fill="#DA251D" rx="2"/><polygon points="10,3.5 11.2,7.2 14.8,7.2 11.9,9.4 13,13 10,10.8 7,13 8.1,9.4 5.2,7.2 8.8,7.2" fill="#FFFF00"/></svg>',
			'EG' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="4.66" fill="#CE1126" rx="2"/><rect y="4.66" width="20" height="4.66" fill="#FFFFFF"/><rect y="9.33" width="20" height="4.67" fill="#000000"/><circle cx="10" cy="7" r="1.3" fill="#C09A3E"/></svg>',
			'NG' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="6.6" height="14" fill="#008751" rx="2"/><rect x="6.6" width="6.8" height="14" fill="#FFFFFF"/><rect x="13.4" width="6.6" height="14" fill="#008751"/></svg>',
			'KE' => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="4" fill="#000000" rx="2"/><rect y="4" width="20" height="1" fill="#FFFFFF"/><rect y="5" width="20" height="4" fill="#922529"/><rect y="9" width="20" height="1" fill="#FFFFFF"/><rect y="10" width="20" height="4" fill="#006600"/><ellipse cx="10" cy="7" rx="2" ry="3.5" fill="#922529"/><ellipse cx="10" cy="7" rx="0.5" ry="3.5" fill="#FFFFFF"/></svg>',
			default => '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><rect width="20" height="14" rx="2" fill="#334155"/><text x="10" y="10" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="7" font-weight="700" fill="#FFFFFF" text-anchor="middle">' . esc_html(substr($country, 0, 2)) . '</text></svg>',
		};
	}

	/**
	 * @param array<string,mixed> $field Field.
	 */
	private function render_upload(array $field, string $name, string $description_id, string $row_uuid = ''): void {
		$maximum_files = max(1, min(10, (int) ($field['maxFiles'] ?? 1)));
		$maximum_mb    = max(1, min(50, (int) ($field['maxFileMb'] ?? 5)));
		$uuid          = (string) ($field['uuid'] ?? '');
		$row_suffix    = '' !== $row_uuid ? '-' . $row_uuid : '';
		$input_id      = 'wof-upload-' . $uuid . $row_suffix;

		echo '<div class="wof-upload" data-wof-upload data-max-files="' . esc_attr((string) $maximum_files) . '" data-max-file-mb="' . esc_attr((string) $maximum_mb) . '">';
		echo '<input type="hidden" name="' . esc_attr($name . '[]') . '" value="" data-wof-upload-ref data-wof-upload-template>';
		echo '<div class="wof-upload__surface">';
		echo '<div class="wof-upload__picker">';
		echo '<input id="' . esc_attr($input_id) . '" class="wof-upload__input" type="file" data-wof-upload-input aria-describedby="' . esc_attr($description_id) . '" accept="' . esc_attr($this->accept_extensions((array) ($field['allowedExtensions'] ?? []))) . '"';
		echo $maximum_files > 1 ? ' multiple' : '';
		echo '>';
		echo '<span class="wof-upload__button" aria-hidden="true">';
		echo '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
		echo esc_html__('Upload', 'wooptions-pro') . '</span>';
		echo '<span class="wof-upload__hint">' . esc_html__('Click or drag and drop', 'wooptions-pro') . '</span>';
		echo '<small class="wof-upload__limit">' . sprintf(esc_html__('Up to %1$d file(s), %2$d MB each', 'wooptions-pro'), $maximum_files, $maximum_mb) . '</small>';
		echo '</div>';
		echo '<div class="wof-upload__list" data-wof-upload-list aria-live="polite"></div>';
		echo '</div>';
		echo '</div>';
	}

	/**
	 * @param array<string,mixed> $field Section / Repeater.
	 */
	private function render_repeater(array $field, string $name): void {
		$section_style = (string) ($field['sectionStyle'] ?? 'section');
		$is_accordion  = 'accordion' === $section_style;
		$initial_state = (string) ($field['initialState'] ?? 'open');
		$is_open       = 'close' !== $initial_state;
		$hide_title    = ! empty($field['hideSectionTitle']);
		$title         = (string) ($field['label'] ?? __('Section Container', 'wooptions-pro'));
		$help_text     = trim((string) ($field['help'] ?? ''));
		$help_pos      = (string) ($field['helpTextPosition'] ?? 'below_title');
		$repeatable    = ! isset($field['repeatable']) || ! empty($field['repeatable']);

		// Section Header
		if (! $hide_title && '' !== trim($title)) {
			if ($is_accordion) {
				echo '<div class="wof-section__header wof-accordion-trigger" data-wof-accordion-trigger role="button" tabindex="0" aria-expanded="' . ($is_open ? 'true' : 'false') . '">';
				echo '<div class="wof-section__heading">';
				echo '<h4 class="wof-section__title">' . esc_html($title) . '</h4>';
				if ('' !== $help_text && 'tooltip' === $help_pos) {
					echo $this->render_tooltip_icon($help_text);
				}
				echo '</div>';
				echo '<span class="wof-section__chevron" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>';
				echo '</div>';
			} else {
				echo '<div class="wof-section__header">';
				echo '<div class="wof-section__heading">';
				echo '<h4 class="wof-section__title">' . esc_html($title) . '</h4>';
				if ('' !== $help_text && 'tooltip' === $help_pos) {
					echo $this->render_tooltip_icon($help_text);
				}
				echo '</div>';
				echo '</div>';
			}
			if ('' !== $help_text && 'below_title' === $help_pos) {
				echo '<p class="wof-field__help wof-field__help--below-title">' . esc_html($help_text) . '</p>';
			}
		}

		echo '<div class="wof-section__body" data-wof-accordion-body' . ($is_accordion && ! $is_open ? ' hidden style="display:none;"' : '') . '>';

		if (! $repeatable) {
			// Static Section: render single set of child fields
			echo '<div class="wof-section__fields">';
			$prefix = $name . '[rows][static][values]';
			foreach ((array) ($field['children'] ?? []) as $child) {
				if (is_array($child)) {
					$this->render_field($child, $prefix, 'static');
				}
			}
			echo '</div>';
		} else {
			// Repeatable Section
			$price_badge = '';
			$price_type  = (string) ($field['repeatPriceType'] ?? 'none');
			if ('fixed' === $price_type) {
				$reg  = (string) ($field['repeatRegularPrice'] ?? '');
				$sale = (string) ($field['repeatSalePrice'] ?? '');
				if ('' !== $sale && '' !== $reg && function_exists('wc_price')) {
					$price_badge = wc_price((float) $sale);
				} elseif ('' !== $reg && function_exists('wc_price')) {
					$price_badge = wc_price((float) $reg);
				}
			} elseif ('percentage' === $price_type) {
				$reg = (string) ($field['repeatRegularPrice'] ?? '');
				if ('' !== $reg) {
					$price_badge = '+' . $reg . '%';
				}
			}

			$repeat_method = (string) ($field['repeatMethod'] ?? 'button');
			$min_repeats   = max(0, (int) ($field['minRepeats'] ?? $field['minRows'] ?? 0));
			$max_repeats   = max(0, (int) ($field['maxRepeats'] ?? $field['maxRows'] ?? 0));
			$initial_rows  = max(1, $min_repeats, (int) ($field['defaultRows'] ?? 1));
			$repeat_label  = (string) ($field['repeatLabel'] ?? ($field['rowTitle'] ?? 'Item {n}'));
			$button_label  = (string) ($field['buttonLabel'] ?? __('Add Another', 'wooptions-pro'));

			if ('quantity' === $repeat_method) {
				echo '<div class="wof-repeater__quantity-control" data-wof-repeater-quantity>';
				echo '<label class="wof-repeater__quantity-label">' . esc_html__('Quantity', 'wooptions-pro') . '</label>';
				echo '<div class="wof-qty-stepper">';
				echo '<button type="button" class="wof-qty-stepper__btn" data-wof-repeater-qty-dec aria-label="' . esc_attr__('Decrease quantity', 'wooptions-pro') . '">−</button>';
				echo '<input type="number" class="wof-qty-stepper__input" data-wof-repeater-qty-input value="' . esc_attr((string) $initial_rows) . '" min="' . esc_attr((string) max(1, $min_repeats)) . '"' . ($max_repeats > 0 ? ' max="' . esc_attr((string) $max_repeats) . '"' : '') . ' readonly />';
				echo '<button type="button" class="wof-qty-stepper__btn" data-wof-repeater-qty-inc aria-label="' . esc_attr__('Increase quantity', 'wooptions-pro') . '">+</button>';
				echo '</div>';
				echo '</div>';
			}

			echo '<div class="wof-repeater" data-wof-repeater data-min="' . esc_attr((string) $min_repeats) . '" data-max="' . esc_attr((string) ($max_repeats > 0 ? $max_repeats : 100)) . '" data-wof-repeat-label="' . esc_attr($repeat_label) . '" data-repeat-method="' . esc_attr($repeat_method) . '">';
			echo '<div data-wof-repeater-rows>';
			for ($index = 0; $index < $initial_rows; ++$index) {
				$this->render_repeater_row($field, $name, Uuid::v4(), $index + 1, $price_badge);
			}
			echo '</div>';

			if ('button' === $repeat_method) {
				echo '<div class="wof-repeater__footer">';
				echo '<button type="button" class="wof-button wof-repeater__add-btn" data-wof-add-row>' . esc_html($button_label) . '</button>';
				echo '</div>';
			}

			echo '<div class="screen-reader-text" aria-live="polite" data-wof-repeater-live></div>';
			echo '</div>';
		}

		echo '</div>'; // End .wof-section__body

		if ('' !== $help_text && 'below_field' === $help_pos) {
			echo '<p class="wof-field__help wof-field__help--below-field">' . esc_html($help_text) . '</p>';
		}
	}

	/**
	 * @param array<string,mixed> $field Repeater.
	 */
	private function render_repeater_row(array $field, string $name, string $row_uuid, int $number, string $price_badge = ''): void {
		$repeat_label  = (string) ($field['repeatLabel'] ?? ($field['rowTitle'] ?? 'Item {n}'));
		$title         = str_replace(['{n}', '{index}'], (string) $number, $repeat_label);
		$repeat_method = (string) ($field['repeatMethod'] ?? 'button');

		echo '<fieldset class="wof-repeater__row" data-wof-row="' . esc_attr($row_uuid) . '">';
		echo '<legend class="screen-reader-text">' . esc_html($title) . '</legend>';
		echo '<div class="wof-repeater__row-header">';
		echo '<div class="wof-repeater__row-heading">';
		echo '<span class="wof-repeater__row-title" data-wof-row-title>' . esc_html($title) . '</span>';
		if ('' !== $price_badge) {
			echo '<span class="wof-repeater__row-price">' . wp_kses_post($price_badge) . '</span>';
		}
		echo '</div>';
		if ('button' === $repeat_method) {
			echo '<div class="wof-repeater__actions">';
			echo '<button type="button" class="wof-icon-button" data-wof-move-row="up" aria-label="' . esc_attr__('Move up', 'wooptions-pro') . '" title="' . esc_attr__('Move up', 'wooptions-pro') . '"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg></button>';
			echo '<button type="button" class="wof-icon-button" data-wof-move-row="down" aria-label="' . esc_attr__('Move down', 'wooptions-pro') . '" title="' . esc_attr__('Move down', 'wooptions-pro') . '"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>';
			echo '<button type="button" class="wof-icon-button is-remove" data-wof-remove-row aria-label="' . esc_attr__('Remove row', 'wooptions-pro') . '" title="' . esc_attr__('Remove row', 'wooptions-pro') . '"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
			echo '</div>';
		}
		echo '</div>';

		$prefix = $name . '[rows][' . $row_uuid . '][values]';
		echo '<div class="wof-repeater__row-fields">';
		foreach ((array) ($field['children'] ?? []) as $child) {
			if (is_array($child)) {
				$this->render_field($child, $prefix, $row_uuid);
			}
		}
		echo '</div>';
		echo '</fieldset>';
	}

	/**
	 * @param array<string,mixed> $field Content field.
	 */
	private function render_content(array $field): void {
		$type        = (string) $field['type'];
		$uuid        = (string) ($field['uuid'] ?? '');
		$is_disabled = ! empty($field['disabled']);
		$hidden_attr = $is_disabled ? ' hidden style="display:none;"' : '';
		$dis_cls     = $is_disabled ? ' is-disabled' : '';

		$width = (string) ($field['width'] ?? '100%');
		if (! in_array($width, ['33%', '50%', '66%', '100%'], true)) {
			$width = '100%';
		}
		$width_cls = ' wof-field--width-' . str_replace('%', '', $width);

		if ('heading' === $type) {
			$content   = (string) ($field['label'] ?? '');
			if ('' === trim($content)) {
				$content = (string) ($field['content'] ?? ($field['description'] ?? ''));
			}
			$help_text = trim((string) ($field['help'] ?? ''));
			$help_pos  = (string) ($field['helpTextPosition'] ?? 'below_title');
			$classes   = 'wof-field wof-field--heading wof-content-heading' . $width_cls . $dis_cls;

			echo '<div class="' . esc_attr($classes) . '" data-wof-field="' . esc_attr($uuid) . '"' . $hidden_attr . '>';
			echo '<h3 class="wof-content-heading__title">';
			echo esc_html($content);
			if ('' !== $help_text && 'tooltip' === $help_pos) {
				echo ' ' . $this->render_tooltip_icon($help_text);
			}
			echo '</h3>';
			if ('' !== $help_text && ('below_title' === $help_pos || 'below_field' === $help_pos)) {
				echo '<p class="wof-field__help wof-field__help--' . esc_attr($help_pos) . '">' . esc_html($help_text) . '</p>';
			}
			echo '</div>';
			return;
		}

		if ('paragraph' === $type) {
			$content = '';
			if (isset($field['description']) && '' !== trim((string) $field['description'])) {
				$content = (string) $field['description'];
			} elseif (isset($field['content']) && '' !== trim((string) $field['content'])) {
				$content = (string) $field['content'];
			} elseif (isset($field['help']) && '' !== trim((string) $field['help'])) {
				$content = (string) $field['help'];
			} elseif (isset($field['label']) && '' !== trim((string) $field['label'])) {
				$content = (string) $field['label'];
			}
			$classes = 'wof-field wof-field--paragraph wof-content wof-content--paragraph' . $width_cls . $dis_cls;
			echo '<div class="' . esc_attr($classes) . '" data-wof-field="' . esc_attr($uuid) . '"' . $hidden_attr . '>';
			echo '<div class="wof-paragraph-box">';
			echo '<p class="wof-paragraph-text">' . wp_kses_post($content) . '</p>';
			echo '</div>';
			echo '</div>';
			return;
		}

		if ('help' === $type) {
			$content = '';
			if (isset($field['help']) && '' !== trim((string) $field['help'])) {
				$content = (string) $field['help'];
			} elseif (isset($field['description']) && '' !== trim((string) $field['description'])) {
				$content = (string) $field['description'];
			} elseif (isset($field['content']) && '' !== trim((string) $field['content'])) {
				$content = (string) $field['content'];
			} elseif (isset($field['label']) && '' !== trim((string) $field['label'])) {
				$content = (string) $field['label'];
			}
			$classes = 'wof-field wof-field--help wof-content wof-content--help' . $width_cls . $dis_cls;
			echo '<div class="' . esc_attr($classes) . '" data-wof-field="' . esc_attr($uuid) . '"' . $hidden_attr . '>';
			echo '<div class="wof-help-box">';
			echo '<div class="wof-help-icon" aria-hidden="true">';
			echo '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
			echo '</div>';
			echo '<div class="wof-help-content">' . wp_kses_post($content) . '</div>';
			echo '</div>';
			echo '</div>';
			return;
		}

		if ('content' === $type) {
			$content = (string) ($field['content'] ?? ($field['description'] ?? ($field['label'] ?? '')));
			$classes = 'wof-field wof-field--content wof-content wof-content--rich' . $width_cls . $dis_cls;
			echo '<div class="' . esc_attr($classes) . '" data-wof-field="' . esc_attr($uuid) . '"' . $hidden_attr . '>';
			echo wp_kses_post($content);
			echo '</div>';
			return;
		}

		if ('modal' === $type) {
			$width  = (string) ($field['width'] ?? '100%');
			if (! in_array($width, ['33%', '50%', '66%', '100%'], true)) {
				$width = '100%';
			}
			$btn_text    = (string) ($field['buttonText'] ?? $field['label'] ?? __('View details', 'wooptions-pro'));
			if ('' === trim($btn_text)) {
				$btn_text = __('View details', 'wooptions-pro');
			}
			$btn_style   = (string) ($field['buttonStyle'] ?? 'outline');
			if (! in_array($btn_style, ['outline', 'primary', 'secondary', 'link'], true)) {
				$btn_style = 'outline';
			}
			$modal_title = (string) ($field['modalTitle'] ?? $field['label'] ?? __('Information', 'wooptions-pro'));
			if ('' === trim($modal_title)) {
				$modal_title = __('Information', 'wooptions-pro');
			}
			$content     = (string) ($field['content'] ?? ($field['description'] ?? ''));
			$classes     = 'wof-field wof-field--modal wof-field--width-' . str_replace('%', '', $width) . $dis_cls;
			$modal_id    = 'wof-modal-' . sanitize_html_class($uuid);

			echo '<div class="' . esc_attr($classes) . '" data-wof-field="' . esc_attr($uuid) . '"' . $hidden_attr . '>';
			echo '<button type="button" class="wof-modal-trigger wof-modal-btn wof-modal-btn--' . esc_attr($btn_style) . '" data-wof-modal-target="' . esc_attr($modal_id) . '" aria-haspopup="dialog" aria-expanded="false">';
			echo '<span class="wof-modal-btn__text">' . esc_html($btn_text) . '</span>';
			echo '</button>';

			echo '<div id="' . esc_attr($modal_id) . '" class="wof-modal-backdrop" aria-hidden="true" style="display:none;">';
			echo '<div class="wof-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="' . esc_attr($modal_id) . '-title">';
			echo '<div class="wof-modal-header">';
			echo '<h3 id="' . esc_attr($modal_id) . '-title" class="wof-modal-title">' . esc_html($modal_title) . '</h3>';
			echo '<button type="button" class="wof-modal-close" aria-label="' . esc_attr__('Close', 'wooptions-pro') . '">&times;</button>';
			echo '</div>';
			echo '<div class="wof-modal-body wof-modal-content">';
			echo wp_kses_post($content);
			echo '</div>';
			echo '</div>';
			echo '</div>';
			echo '</div>';
			return;
		}

		if ('separator' === $type) {
			$width  = (string) ($field['width'] ?? '100%');
			if (! in_array($width, ['33%', '50%', '66%', '100%'], true)) {
				$width = '100%';
			}
			$height = isset($field['height']) ? (int) $field['height'] : (isset($field['style']['height']) ? (int) $field['style']['height'] : 1);
			if ($height < 1) {
				$height = 1;
			}
			$color = sanitize_hex_color((string) ($field['color'] ?? ($field['style']['color'] ?? '')));
			$style = 'border:none;height:' . $height . 'px;';
			if (! empty($color)) {
				$style .= 'background-color:' . $color . ';';
			}
			if ($is_disabled) {
				$style .= 'display:none;';
			}
			$classes = 'wof-separator wof-field--width-' . str_replace('%', '', $width) . $dis_cls;
			echo '<hr class="' . esc_attr($classes) . '" style="' . esc_attr($style) . '" data-wof-field="' . esc_attr($uuid) . '"' . ($is_disabled ? ' hidden' : '') . ' aria-hidden="true">';
			return;
		}

		$style = $is_disabled ? ' style="display:none;"' : '';
		echo '<div class="wof-spacer' . esc_attr($dis_cls) . '" data-wof-field="' . esc_attr($uuid) . '"' . $style . ($is_disabled ? ' hidden' : '') . ' aria-hidden="true"></div>';
	}

	/**
	 * @param array<string,mixed> $field Field.
	 */
	private function input_attributes(array $field, string $description_id): string {
		$attributes = '';
		if (! empty($field['required'])) {
			$attributes .= ' aria-required="true"';
		}
		if (! empty($field['disabled'])) {
			$attributes .= ' disabled';
		}
		if ('' !== (string) ($field['description'] ?? '')) {
			$attributes .= ' aria-describedby="' . esc_attr($description_id) . '"';
		}
		$type          = (string) ($field['type'] ?? '');
		$allow_min_max = 'number' !== $type || ! isset($field['enableMinMax']) || ! empty($field['enableMinMax']);
		if ($allow_min_max && null !== ($field['min'] ?? null) && '' !== (string) $field['min']) {
			$attributes .= ' min="' . esc_attr((string) $field['min']) . '"';
		}
		if ($allow_min_max && null !== ($field['max'] ?? null) && '' !== (string) $field['max']) {
			$attributes .= ' max="' . esc_attr((string) $field['max']) . '"';
		}
		if (null !== ($field['step'] ?? null) && '' !== (string) $field['step']) {
			$attributes .= ' step="' . esc_attr((string) $field['step']) . '"';
		}
		if ((int) ($field['minLength'] ?? 0) > 0) {
			$attributes .= ' minlength="' . esc_attr((string) $field['minLength']) . '"';
		}
		if ((int) ($field['maxLength'] ?? 0) > 0) {
			$attributes .= ' maxlength="' . esc_attr((string) $field['maxLength']) . '"';
		}
		return $attributes;
	}

	/**
	 * Render a tooltip icon with accessible popup text.
	 */
	private function render_tooltip_icon(string $help_text): string {
		$icon_svg = '<svg class="wof-field__tooltip-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
		return '<span class="wof-field__tooltip" data-wof-tooltip tabindex="0" role="button" aria-label="' . esc_attr($help_text) . '">'
			. $icon_svg
			. '<span class="wof-field__tooltip-bubble" role="tooltip"><span class="wof-field__tooltip-content">' . esc_html($help_text) . '</span><span class="wof-field__tooltip-arrow" aria-hidden="true"></span></span>'
			. '</span>';
	}

	/**
	 * @param array<string,mixed> $choice Choice.
	 */
	private function choice_price_text(array $choice, bool $parentheses = true): string {
		$pricing  = (array) ($choice['pricing'] ?? []);
		$strategy = (string) ($pricing['strategy'] ?? 'none');
		$currency = function_exists('get_woocommerce_currency_symbol')
			? html_entity_decode((string) get_woocommerce_currency_symbol(), ENT_QUOTES, 'UTF-8')
			: '';
		if ('' === $currency && function_exists('get_woocommerce_currency')) {
			$currency = (string) get_woocommerce_currency();
		}
		if ('' === $currency) {
			$currency = '$';
		}
		if (('fixed' === $strategy || 'setup' === $strategy) && '0' !== (string) ($pricing['amount'] ?? '0')) {
			$raw = trim((string) ($pricing['amount'] ?? '0'));
			$is_negative = str_starts_with($raw, '-');
			$clean = $is_negative ? substr($raw, 1) : (str_starts_with($raw, '+') ? substr($raw, 1) : $raw);
			$prefix = $is_negative ? '-' : '+';
			$suffix = 'setup' === $strategy ? ' ' . __('setup', 'wooptions-pro') : '';
			$text = $prefix . $currency . $clean . $suffix;
			return $parentheses ? ' (' . $text . ')' : $text;
		}
		if ('percentage' === $strategy && '0' !== (string) ($pricing['percent'] ?? '0')) {
			$raw = trim((string) ($pricing['percent'] ?? '0'));
			$is_negative = str_starts_with($raw, '-');
			$clean = $is_negative ? substr($raw, 1) : (str_starts_with($raw, '+') ? substr($raw, 1) : $raw);
			$prefix = $is_negative ? '-' : '+';
			$text = $prefix . $clean . '%';
			return $parentheses ? ' (' . $text . ')' : $text;
		}
		if ('per_character' === $strategy && '0' !== (string) ($pricing['amount'] ?? '0')) {
			$raw = trim((string) ($pricing['amount'] ?? '0'));
			$is_negative = str_starts_with($raw, '-');
			$clean = $is_negative ? substr($raw, 1) : (str_starts_with($raw, '+') ? substr($raw, 1) : $raw);
			$prefix = $is_negative ? '-' : '+';
			$text = $prefix . $currency . $clean . '/char';
			return $parentheses ? ' (' . $text . ')' : $text;
		}
		if ('per_unit' === $strategy && '0' !== (string) ($pricing['amount'] ?? '0')) {
			$raw = trim((string) ($pricing['amount'] ?? '0'));
			$is_negative = str_starts_with($raw, '-');
			$clean = $is_negative ? substr($raw, 1) : (str_starts_with($raw, '+') ? substr($raw, 1) : $raw);
			$prefix = $is_negative ? '-' : '+';
			$text = $prefix . $currency . $clean . '/unit';
			return $parentheses ? ' (' . $text . ')' : $text;
		}
		return '';
	}

	/**
	 * @param list<string> $extensions Extensions.
	 */
	private function accept_extensions(array $extensions): string {
		return implode(',', array_map(static fn (string $extension): string => '.' . sanitize_key($extension), $extensions));
	}

	/**
	 * @param array<string,mixed> $tokens Tokens.
	 * @param array<string,mixed> $typography Typography.
	 */
	private function css_variables(array $tokens, array $typography): string {
		$css = [];
		foreach ($tokens as $key => $value) {
			if (is_string($value) && 1 === preg_match('/\A(?:#[0-9A-Fa-f]{6}|currentColor|Canvas|transparent)\z/', $value)) {
				$css[] = '--wof-' . strtolower((string) preg_replace('/([a-z])([A-Z])/', '$1-$2', $key)) . ':' . $value;
			}
		}

		$family = (string) ($typography['family'] ?? 'inherit');
		$css[] = '--wof-font:' . $this->font_stack($family);
		$css[] = '--wof-label-weight:' . max(400, min(800, (int) ($typography['labelWeight'] ?? 650)));
		$css[] = '--wof-body-weight:' . max(300, min(700, (int) ($typography['bodyWeight'] ?? 450)));
		$css[] = '--wof-font-size:' . max(16, min(24, (int) ($typography['desktopSize'] ?? 16))) . 'px';
		$css[] = '--wof-line-height:' . max(1.2, min(2.0, (float) ($typography['lineHeight'] ?? 1.5)));
		return implode(';', $css);
	}

	private function font_stack(string $family): string {
		return match ($family) {
			'Inter'             => '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
			'Manrope'           => '"Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
			'Poppins'           => '"Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
			'Outfit'            => '"Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
			'Plus Jakarta Sans' => '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
			'Roboto'            => '"Roboto", Arial, sans-serif',
			'system-ui'         => 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
			default             => 'inherit',
		};
	}

	private function enqueue_typography_font(array $typography): void {
		$family = (string) ($typography['family'] ?? 'inherit');
		$queries = [
			'Inter'             => 'Inter:wght@300;400;500;600;700;800',
			'Manrope'           => 'Manrope:wght@300;400;500;600;700;800',
			'Poppins'           => 'Poppins:wght@300;400;500;600;700;800',
			'Outfit'            => 'Outfit:wght@300;400;500;600;700;800',
			'Plus Jakarta Sans' => 'Plus+Jakarta+Sans:wght@300;400;500;600;700;800',
			'Roboto'            => 'Roboto:wght@300;400;500;600;700;800',
		];
		if (! isset($queries[$family])) {
			return;
		}
		$handle = 'wooptions-pro-font-' . sanitize_key($family);
		$url = 'https://fonts.googleapis.com/css2?family=' . $queries[$family] . '&display=swap';
		wp_enqueue_style($handle, $url, [], null);
	}

	/**
	 * Enqueue Google Fonts for specific fonts configured in font fields.
	 *
	 * Only the specific fonts chosen by the admin will be requested.
	 *
	 * @param array<int,mixed> $fields Field definitions.
	 */
	private function enqueue_font_field_fonts(array $fields): void {
		$catalog_file = WOOPTIONS_PRO_PATH . 'config/fonts.php';
		$catalog      = file_exists($catalog_file) ? require $catalog_file : [];
		$catalog_map  = [];
		if (is_array($catalog)) {
			foreach ($catalog as $item) {
				if (is_array($item) && ! empty($item['name'])) {
					$catalog_map[strtolower(trim((string) $item['name']))] = $item;
					if (! empty($item['id'])) {
						$catalog_map[strtolower(trim((string) $item['id']))] = $item;
					}
				}
			}
		}

		$google_params    = [];
		$has_custom_fonts = false;

		$collect = function (array $list) use (&$collect, &$google_params, &$has_custom_fonts, $catalog_map): void {
			foreach ($list as $f) {
				if (! is_array($f)) {
					continue;
				}
				if ('font' === ($f['type'] ?? '')) {
					foreach ((array) ($f['choices'] ?? []) as $c) {
						if (! is_array($c)) {
							continue;
						}
						$source = (string) ($c['fontSource'] ?? 'google');
						if ('system' === $source) {
							continue;
						}
						if ('custom' === $source) {
							$has_custom_fonts = true;
							continue;
						}
						$name           = trim((string) ($c['label'] ?? ''));
						$family         = trim((string) ($c['fontFamily'] ?? ''));
						$primary_family = '';
						if ('' !== $family) {
							$parts = explode(',', $family);
							$primary_family = trim(trim($parts[0]), " \t\n\r\0\x0B'\"");
						}

						$matched_cat = null;
						if ('' !== $primary_family && isset($catalog_map[strtolower($primary_family)])) {
							$matched_cat = $catalog_map[strtolower($primary_family)];
						} elseif ('' !== $name && isset($catalog_map[strtolower($name)])) {
							$matched_cat = $catalog_map[strtolower($name)];
						}

						if (is_array($matched_cat)) {
							if ('system' === ($matched_cat['source'] ?? '')) {
								continue;
							}
							if ('custom' === ($matched_cat['source'] ?? '')) {
								$has_custom_fonts = true;
								continue;
							}
							if (! empty($matched_cat['googleParam'])) {
								$google_params[$matched_cat['googleParam']] = true;
								continue;
							}
						}

						$font_candidate = '' !== $primary_family ? $primary_family : $name;
						if ('' !== $font_candidate) {
							$clean_name = str_replace(' ', '+', preg_replace('/[^a-zA-Z0-9 ]/', '', $font_candidate));
							if ('' !== $clean_name) {
								$google_params[$clean_name . ':wght@400;700'] = true;
							}
						}
					}
				}
				if (! empty($f['children']) && is_array($f['children'])) {
					$collect($f['children']);
				}
			}
		};

		$collect($fields);

		$custom_css = CustomFontService::generate_font_face_css();
		if ('' !== $custom_css) {
			wp_add_inline_style('wooptions-pro-storefront', $custom_css);
			if (did_action('wp_head')) {
				echo '<style id="wooptions-pro-custom-fonts-inline">' . $custom_css . '</style>';
			}
		}

		if (empty($google_params)) {
			return;
		}

		$query_parts = [];
		foreach (array_keys($google_params) as $param) {
			$query_parts[] = 'family=' . $param;
		}
		$url    = 'https://fonts.googleapis.com/css2?' . implode('&', $query_parts) . '&display=swap';
		$handle = 'wooptions-pro-font-picker-' . substr(md5($url), 0, 10);
		wp_enqueue_style($handle, $url, [], null);
		if (did_action('wp_head')) {
			echo '<link rel="stylesheet" id="' . esc_attr($handle) . '-inline" href="' . esc_url($url) . '" media="all">';
		}
	}
}
