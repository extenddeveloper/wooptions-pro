<?php
/**
 * Dynamic product-options block.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Presentation\Storefront;

final class BlockIntegration {
	public function __construct(private readonly Renderer $renderer) {
	}

	public function register(): void {
		$path = WOOPTIONSFIC_PATH . 'blocks/product-options';
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
