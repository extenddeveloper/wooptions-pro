<?php
/**
 * Linked-product commerce validation port.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Application;

interface LinkedProductValidator {
	/**
	 * @param array<string,mixed> $compiled Configuration.
	 * @param array<string,mixed> $values Selection.
	 * @param array<string,mixed> $context Customer and product context.
	 * @return array{valid:bool,errors:list<array<string,mixed>>,items:list<array<string,mixed>>}
	 */
	public function validate(array $compiled, array $values, int $parent_product_id, int $cart_quantity, array $context = []): array;
}
