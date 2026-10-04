<?php
/**
 * Field type contract.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Domain\Definition;

interface FieldType {
	public function key(): string;

	/**
	 * @param array<string, mixed> $definition Authored field.
	 * @return array<string, mixed>
	 */
	public function normalize_definition(array $definition): array;

	public function normalize_value(mixed $value, array $definition): mixed;

	/**
	 * @param array<string, mixed> $definition Compiled field.
	 * @return list<array{code:string,params:array<string,mixed>}>
	 */
	public function validate(mixed $value, array $definition): array;

	public function format_value(mixed $value, array $definition): string;

	public function accepts_customer_value(): bool;
}
