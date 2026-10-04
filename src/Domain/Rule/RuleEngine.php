<?php
/**
 * Typed nested condition engine and trace.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Domain\Rule;

use DateTimeImmutable;
use RuntimeException;
use WooptionsFic\Domain\Pricing\Decimal;

final class RuleEngine {
	private int $nodes = 0;

	public function __construct(private readonly int $node_limit = 500) {
	}

	/**
	 * @param array<string, mixed> $condition Condition AST.
	 * @param array<string, mixed> $values Normalized values.
	 * @param array<string, mixed> $context Product/customer context.
	 */
	public function evaluate(array $condition, array $values, array $context = [], ?array $row = null): bool {
		$this->nodes = 0;
		return $this->evaluate_node($condition, $values, $context, $row);
	}

	/**
	 * @param array<string, mixed> $condition Condition AST.
	 * @param array<string, mixed> $values Values.
	 * @param array<string, mixed> $context Context.
	 * @return array{result:bool,nodes:list<array<string,mixed>>}
	 */
	public function trace(array $condition, array $values, array $context = [], ?array $row = null): array {
		$this->nodes = 0;
		$trace       = [];
		$result      = $this->evaluate_node($condition, $values, $context, $row, $trace);
		return ['result' => $result, 'nodes' => $trace];
	}

	/**
	 * @param array<string, mixed> $compiled Compiled configuration.
	 * @param array<string, mixed> $values Values.
	 * @param array<string, mixed> $context Context.
	 * @return array<string, array{visible:bool,enabled:bool,required:bool,help:?string}>
	 */
	public function resolve_field_states(array $compiled, array $values, array $context = []): array {
		$states          = [];
		$disabled_fields = [];
		foreach ((array) ($compiled['fields'] ?? []) as $field) {
			$uuid = (string) ($field['uuid'] ?? '');
			if ('' === $uuid) {
				continue;
			}
			$is_disabled = ! empty($field['disabled']);
			if ($is_disabled) {
				$disabled_fields[$uuid] = true;
				$states[$uuid]          = [
					'visible'  => false,
					'enabled'  => false,
					'required' => false,
					'help'     => null,
				];
				continue;
			}

			$states[$uuid] = [
				'visible'  => true,
				'enabled'  => true,
				'required' => ! empty($field['required']),
				'help'     => null,
			];

			$conditions = is_array($field['conditions'] ?? null) ? $field['conditions'] : [];
			foreach (['visible', 'enabled', 'required'] as $state_key) {
				if (isset($conditions[$state_key]) && is_array($conditions[$state_key])) {
					$states[$uuid][$state_key] = $this->evaluate($conditions[$state_key], $values, $context);
				}
			}
		}

		foreach ((array) ($compiled['rules'] ?? []) as $rule) {
			if (! is_array($rule) || ! is_array($rule['condition'] ?? null)) {
				continue;
			}
			if (! $this->evaluate($rule['condition'], $values, $context)) {
				continue;
			}
			foreach ((array) ($rule['actions'] ?? []) as $action) {
				$target = (string) ($action['target'] ?? '');
				$type   = (string) ($action['type'] ?? '');
				if (! isset($states[$target]) || ! empty($disabled_fields[$target])) {
					continue;
				}
				switch ($type) {
					case 'show':
						$states[$target]['visible'] = true;
						break;
					case 'hide':
						$states[$target]['visible'] = false;
						break;
					case 'enable':
						$states[$target]['enabled'] = true;
						break;
					case 'disable':
						$states[$target]['enabled'] = false;
						break;
					case 'require':
						$states[$target]['required'] = true;
						break;
					case 'optional':
						$states[$target]['required'] = false;
						break;
					case 'help':
						$states[$target]['help'] = (string) ($action['value'] ?? '');
						break;
				}
			}
		}

		return $states;
	}

	/**
	 * @param array<string, mixed> $node Node.
	 * @param array<string, mixed> $values Values.
	 * @param array<string, mixed> $context Context.
	 * @param list<array<string,mixed>>|null $trace Trace sink.
	 */
	private function evaluate_node(array $node, array $values, array $context, ?array $row, ?array &$trace = null): bool {
		++$this->nodes;
		if ($this->nodes > $this->node_limit) {
			throw new RuntimeException('wooptionsfic_rule_node_limit');
		}

		$logic = strtolower((string) ($node['logic'] ?? ''));
		if (in_array($logic, ['and', 'or'], true)) {
			$children = (array) ($node['conditions'] ?? []);
			$result   = 'and' === $logic;
			foreach ($children as $child) {
				if (! is_array($child)) {
					continue;
				}
				$child_result = $this->evaluate_node($child, $values, $context, $row, $trace);
				if ('and' === $logic && ! $child_result) {
					$result = false;
					break;
				}
				if ('or' === $logic && $child_result) {
					$result = true;
					break;
				}
				$result = $child_result;
			}
			$trace[] = ['kind' => 'group', 'logic' => $logic, 'result' => $result];
			return $result;
		}

		if ('not' === $logic || isset($node['not'])) {
			$child  = is_array($node['not'] ?? null) ? $node['not'] : (array) ($node['condition'] ?? []);
			$result = ! $this->evaluate_node($child, $values, $context, $row, $trace);
			$trace[] = ['kind' => 'group', 'logic' => 'not', 'result' => $result];
			return $result;
		}

		$left     = $this->resolve_operand($node['left'] ?? ['field' => $node['field'] ?? ''], $values, $context, $row);
		$right    = $this->resolve_operand($node['right'] ?? ['literal' => $node['value'] ?? null], $values, $context, $row);
		$operator = strtolower((string) ($node['operator'] ?? 'equals'));
		$result   = $this->compare($left, $operator, $right, $context);
		$trace[]  = [
			'kind'     => 'comparison',
			'field'    => (string) ($node['field'] ?? ($node['left']['field'] ?? '')),
			'operator' => $operator,
			'left'     => $this->trace_value($left),
			'right'    => $this->trace_value($right),
			'result'   => $result,
		];
		return $result;
	}

	/**
	 * @param mixed $operand Operand.
	 * @param array<string, mixed> $values Values.
	 * @param array<string, mixed> $context Context.
	 */
	private function resolve_operand(mixed $operand, array $values, array $context, ?array $row): mixed {
		if (! is_array($operand)) {
			return $operand;
		}
		if (array_key_exists('literal', $operand)) {
			return $operand['literal'];
		}
		if (isset($operand['field'])) {
			$field = (string) $operand['field'];
			return $values[$field] ?? null;
		}
		if (isset($operand['rowField'])) {
			$field = (string) $operand['rowField'];
			return $row[$field] ?? null;
		}
		if (isset($operand['context'])) {
			return $context[(string) $operand['context']] ?? null;
		}
		if (isset($operand['aggregate']) && is_array($operand['aggregate'])) {
			return $this->aggregate($operand['aggregate'], $values);
		}
		return null;
	}

	/**
	 * @param array<string, mixed> $definition Aggregate definition.
	 * @param array<string, mixed> $values Values.
	 */
	private function aggregate(array $definition, array $values): mixed {
		$repeater = (string) ($definition['repeater'] ?? '');
		$field    = (string) ($definition['field'] ?? '');
		$function = strtolower((string) ($definition['function'] ?? 'count'));
		$rows     = is_array($values[$repeater] ?? null) ? $values[$repeater] : [];
		$items    = [];
		foreach ($rows as $row) {
			$row_values = is_array($row['values'] ?? null) ? $row['values'] : [];
			if (array_key_exists($field, $row_values)) {
				$items[] = $row_values[$field];
			}
		}
		if ('count' === $function) {
			return count($items);
		}
		if (in_array($function, ['sum', 'min', 'max'], true)) {
			$decimals = [];
			foreach ($items as $item) {
				if (is_scalar($item) && 1 === preg_match('/\A-?\d+(?:\.\d+)?\z/', (string) $item)) {
					$decimals[] = Decimal::from_string((string) $item);
				}
			}
			if ([] === $decimals) {
				return '0';
			}
			$result = array_shift($decimals);
			foreach ($decimals as $decimal) {
				if ('sum' === $function) {
					$result = $result->add($decimal);
				} elseif ('min' === $function && $decimal->compare($result) < 0) {
					$result = $decimal;
				} elseif ('max' === $function && $decimal->compare($result) > 0) {
					$result = $decimal;
				}
			}
			return $result->to_string();
		}
		return null;
	}

	/**
	 * @param array<string, mixed> $context Context.
	 */
	private function compare(mixed $left, string $operator, mixed $right, array $context): bool {
		return match ($operator) {
			'equals', '='               => $this->equal($left, $right),
			'not_equals', '!='          => ! $this->equal($left, $right),
			'contains'                  => $this->contains($left, $right),
			'not_contains'              => ! $this->contains($left, $right),
			'in'                        => in_array($left, (array) $right, true),
			'not_in'                    => ! in_array($left, (array) $right, true),
			'selected'                  => $this->contains($left, $right),
			'not_selected'              => ! $this->contains($left, $right),
			'greater_than', '>'         => $this->order($left, $right) > 0,
			'greater_or_equal', '>='    => $this->order($left, $right) >= 0,
			'less_than', '<'            => $this->order($left, $right) < 0,
			'less_or_equal', '<='       => $this->order($left, $right) <= 0,
			'empty'                     => $this->empty($left),
			'not_empty'                 => ! $this->empty($left),
			'starts_with'               => str_starts_with((string) $left, (string) $right),
			'ends_with'                 => str_ends_with((string) $left, (string) $right),
			'before'                    => $this->date_compare($left, $right) < 0,
			'after'                     => $this->date_compare($left, $right) > 0,
			'between'                   => $this->between($left, $right),
			'regex'                     => $this->safe_regex($left, $right, ! empty($context['allowRegex'])),
			default                     => false,
		};
	}

	private function equal(mixed $left, mixed $right): bool {
		if (is_array($left) || is_array($right)) {
			return $left === $right;
		}
		return (string) $left === (string) $right;
	}

	private function contains(mixed $left, mixed $right): bool {
		if (is_array($left)) {
			return in_array($right, $left, true);
		}
		return str_contains((string) $left, (string) $right);
	}

	private function order(mixed $left, mixed $right): int {
		if (is_scalar($left) && is_scalar($right)
			&& 1 === preg_match('/\A-?\d+(?:\.\d+)?\z/', (string) $left)
			&& 1 === preg_match('/\A-?\d+(?:\.\d+)?\z/', (string) $right)
		) {
			return Decimal::from_string((string) $left)->compare(Decimal::from_string((string) $right));
		}
		return strcmp((string) $left, (string) $right);
	}

	private function empty(mixed $value): bool {
		if (is_array($value)) {
			if (isset($value['start']) || isset($value['end'])) {
				return '' === trim((string) ($value['start'] ?? '')) && '' === trim((string) ($value['end'] ?? ''));
			}
			return [] === $value;
		}
		return null === $value || '' === $value || false === $value;
	}

	private function date_compare(mixed $left, mixed $right): int {
		try {
			return (new DateTimeImmutable((string) $left))->getTimestamp()
				<=> (new DateTimeImmutable((string) $right))->getTimestamp();
		} catch (\Exception) {
			return 0;
		}
	}

	private function between(mixed $left, mixed $right): bool {
		$range = (array) $right;
		return isset($range[0], $range[1])
			&& $this->order($left, $range[0]) >= 0
			&& $this->order($left, $range[1]) <= 0;
	}

	private function safe_regex(mixed $left, mixed $right, bool $allowed): bool {
		$pattern = (string) $right;
		if (! $allowed || strlen($pattern) > 200) {
			return false;
		}
		set_error_handler(static fn (): bool => true);
		try {
			return 1 === preg_match($pattern, self::substring((string) $left, 0, 2000));
		} finally {
			restore_error_handler();
		}
	}

	private static function substring(string $value, int $start, int $length): string {
		return function_exists('mb_substr') ? (string) mb_substr($value, $start, $length) : substr($value, $start, $length);
	}

	private function trace_value(mixed $value): mixed {
		if (is_string($value) && strlen($value) > 100) {
			return self::substring($value, 0, 100) . '…';
		}
		return $value;
	}
}
