<?php
/**
 * Structured application validation failure.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Application;

use RuntimeException;

final class ValidationException extends RuntimeException {
	/**
	 * @param list<array<string,mixed>> $errors Errors.
	 */
	public function __construct(string $message, private readonly array $errors) {
		parent::__construct($message);
	}

	/**
	 * @return list<array<string,mixed>>
	 */
	public function errors(): array {
		return $this->errors;
	}
}
