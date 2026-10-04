<?php
/**
 * Dynamic product-options block.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Presentation\Storefront;

final class BlockIntegration {
	public function __construct(private readonly Renderer $renderer) {
	}

	public function register(): void {
		$path = WOOPTIONS_PRO_PATH . 'blocks/product-options';
		if (function_exists('register_block_type') && is_readable($path . '/block.json')) {
			register_block_type(
				$path,
				[
					'render_callback' => [$this->renderer, 'render_block'],
				]
			);
		}
	}
}
