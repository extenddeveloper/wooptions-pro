<?php
/**
 * Optimistic-concurrency conflict.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Application;

use RuntimeException;

final class ConflictException extends RuntimeException {
	/**
	 * @param array<string,mixed> $metadata Conflict details.
	 */
	public function __construct(string $message, private readonly array $metadata = []) {
		parent::__construct($message);
	}

	/**
	 * @return array<string,mixed>
	 */
	public function metadata(): array {
		return $this->metadata;
	}
}
