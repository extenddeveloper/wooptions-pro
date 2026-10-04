<?php
/**
 * Safe recursive-descent formula parser.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Domain\Pricing\Formula;

use RuntimeException;

final class Parser {
	/** @var list<array{type:string,value:string,position:int}> */
	private array $tokens = [];
	private int $index = 0;
	private int $depth = 0;

	public function __construct(private readonly Tokenizer $tokenizer = new Tokenizer()) {
	}

	/**
	 * @return array<string, mixed>
	 */
	public function parse(string $source): array {
		$this->tokens = $this->tokenizer->tokenize($source);
		$this->index  = 0;
		$this->depth  = 0;
		$node         = $this->parse_or();
		$this->expect('eof');
		return $node;
	}

	/**
	 * @return array<string, mixed>
	 */
	private function parse_or(): array {
		$node = $this->parse_and();
		while ($this->matches_operator(['||', 'OR'])) {
			$operator = strtoupper($this->previous()['value']);
			$node     = ['type' => 'binary', 'operator' => $operator, 'left' => $node, 'right' => $this->parse_and()];
		}
		return $node;
	}

	/**
	 * @return array<string, mixed>
	 */
	private function parse_and(): array {
		$node = $this->parse_comparison();
		while ($this->matches_operator(['&&', 'AND'])) {
			$operator = strtoupper($this->previous()['value']);
			$node     = ['type' => 'binary', 'operator' => $operator, 'left' => $node, 'right' => $this->parse_comparison()];
		}
		return $node;
	}

	/**
	 * @return array<string, mixed>
	 */
	private function parse_comparison(): array {
		$node = $this->parse_addition();
		while ($this->matches_operator(['==', '!=', '>', '>=', '<', '<='])) {
			$node = [
				'type'     => 'binary',
				'operator' => $this->previous()['value'],
				'left'     => $node,
				'right'    => $this->parse_addition(),
			];
		}
		return $node;
	}

	/**
	 * @return array<string, mixed>
	 */
	private function parse_addition(): array {
		$node = $this->parse_multiplication();
		while ($this->matches_operator(['+', '-'])) {
			$node = [
				'type'     => 'binary',
				'operator' => $this->previous()['value'],
				'left'     => $node,
				'right'    => $this->parse_multiplication(),
			];
		}
		return $node;
	}

	/**
	 * @return array<string, mixed>
	 */
	private function parse_multiplication(): array {
		$node = $this->parse_power();
		while ($this->matches_operator(['*', '/', '%'])) {
			$node = [
				'type'     => 'binary',
				'operator' => $this->previous()['value'],
				'left'     => $node,
				'right'    => $this->parse_power(),
			];
		}
		return $node;
	}

	/**
	 * @return array<string, mixed>
	 */
	private function parse_power(): array {
		$node = $this->parse_unary();
		if ($this->matches_operator(['^'])) {
			$node = [
				'type'     => 'binary',
				'operator' => '^',
				'left'     => $node,
				'right'    => $this->parse_power(),
			];
		}
		return $node;
	}

	/**
	 * @return array<string, mixed>
	 */
	private function parse_unary(): array {
		if ($this->matches_operator(['!', 'NOT', '+', '-'])) {
			return [
				'type'     => 'unary',
				'operator' => strtoupper($this->previous()['value']),
				'operand'  => $this->parse_unary(),
			];
		}
		return $this->parse_primary();
	}

	/**
	 * @return array<string, mixed>
	 */
	private function parse_primary(): array {
		$this->enter();
		try {
			$token = $this->current();

			if ('number' === $token['type']) {
				++$this->index;
				return ['type' => 'number', 'value' => $token['value']];
			}

			if ('string' === $token['type']) {
				++$this->index;
				return ['type' => 'string', 'value' => $token['value']];
			}

			if ('identifier' === $token['type']) {
				++$this->index;
				$name = $token['value'];
				if ($this->matches('punctuation', '(')) {
					$arguments = [];
					if (! $this->check('punctuation', ')')) {
						do {
							$arguments[] = $this->parse_or();
						} while ($this->matches('punctuation', ','));
					}
					$this->expect('punctuation', ')');
					return ['type' => 'call', 'name' => strtoupper($name), 'arguments' => $arguments];
				}
				return ['type' => 'variable', 'name' => $name];
			}

			if ($this->matches('punctuation', '(')) {
				$node = $this->parse_or();
				$this->expect('punctuation', ')');
				return $node;
			}

			throw new RuntimeException('wooptions-pro_formula_expected_expression_at_' . $token['position']);
		} finally {
			--$this->depth;
		}
	}

	private function enter(): void {
		++$this->depth;
		if ($this->depth > 32) {
			throw new RuntimeException('wooptions-pro_formula_too_deep');
		}
	}

	/**
	 * @param list<string> $operators Operators.
	 */
	private function matches_operator(array $operators): bool {
		$token = $this->current();
		$value = strtoupper($token['value']);
		if (('operator' === $token['type'] || 'identifier' === $token['type']) && in_array($value, $operators, true)) {
			++$this->index;
			return true;
		}
		return false;
	}

	private function matches(string $type, ?string $value = null): bool {
		if (! $this->check($type, $value)) {
			return false;
		}
		++$this->index;
		return true;
	}

	private function check(string $type, ?string $value = null): bool {
		$token = $this->current();
		return $token['type'] === $type && (null === $value || $token['value'] === $value);
	}

	private function expect(string $type, ?string $value = null): void {
		if (! $this->matches($type, $value)) {
			$token = $this->current();
			throw new RuntimeException('wooptions-pro_formula_unexpected_token_at_' . $token['position']);
		}
	}

	/**
	 * @return array{type:string,value:string,position:int}
	 */
	private function current(): array {
		return $this->tokens[$this->index];
	}

	/**
	 * @return array{type:string,value:string,position:int}
	 */
	private function previous(): array {
		return $this->tokens[$this->index - 1];
	}
}
