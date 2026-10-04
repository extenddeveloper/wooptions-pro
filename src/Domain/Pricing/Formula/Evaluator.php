<?php
/**
 * Formula AST evaluator with operation/depth limits.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Domain\Pricing\Formula;

use RuntimeException;
use WooptionsFic\Domain\Pricing\Decimal;

final class Evaluator {
	private int $operations = 0;

	public function __construct(
		private readonly Parser $parser = new Parser(),
		private readonly int $operation_limit = 500
	) {
	}

	/**
	 * Pre-processes an expression replacing [Label], [uuid], {Label}, {uuid},
	 * and FIELD("Label") with FIELD("uuid").
	 *
	 * @param string $expression Formula expression.
	 * @param list<array<string, mixed>> $fields List of field definitions.
	 * @return string Normalized expression with FIELD("uuid").
	 */
	public static function resolve_tokens(string $expression, array $fields = []): string {
		if ('' === trim($expression)) {
			return '0';
		}

		$uuid_map = [];
		$to_slug  = static fn (string $s): string => (string) preg_replace('/\s+/', '_', trim($s));

		foreach ($fields as $f) {
			if (! is_array($f)) {
				continue;
			}
			$u = (string) ($f['uuid'] ?? '');
			$l = trim((string) ($f['label'] ?? ''));
			$n = trim((string) ($f['name'] ?? ''));
			$t = trim((string) ($f['type'] ?? ''));
			if ('' !== $u) {
				$uuid_map[strtolower($u)] = $u;
				if ('' !== $l) {
					$uuid_map[strtolower($l)] = $u;
					$uuid_map[strtolower($to_slug($l))] = $u;
					$uuid_map[strtolower((string) preg_replace('/[^a-z0-9]/', '', $l))] = $u;
				}
				if ('' !== $n) {
					$uuid_map[strtolower($n)] = $u;
					$uuid_map[strtolower($to_slug($n))] = $u;
				}
				if ('' !== $t) {
					$uuid_map[strtolower($t)] = $u;
					$uuid_map[strtolower($to_slug($t))] = $u;
				}
			}
		}

		$resolve_single_token = static function (string $raw) use ($uuid_map): string {
			$raw = trim($raw);
			$key = strtolower($raw);

			// Special tokens
			if (in_array($key, ['product_price', 'base_price', 'productprice', 'baseprice'], true)) {
				return 'FIELD("product_price")';
			}
			if (in_array($key, ['quantity', 'cart_quantity', 'cartquantity'], true)) {
				return 'FIELD("quantity")';
			}
			if (in_array($key, ['weight', 'width', 'height', 'length'], true)) {
				return 'FIELD("' . $key . '")';
			}

			// Direct match in uuid_map (plain label, name, or uuid)
			if (isset($uuid_map[$key])) {
				return 'FIELD("' . addslashes($uuid_map[$key]) . '")';
			}

			// Property or choice tokens e.g. [Field_Slug.prop] or [Field_Slug.options.Choice_Slug.prop]
			return 'FIELD("' . addslashes($raw) . '")';
		};

		// Replace [Tag]
		$expression = (string) preg_replace_callback('/\[([^\]]+)\]/', static function (array $m) use ($resolve_single_token): string {
			return $resolve_single_token($m[1]);
		}, $expression);

		// Replace {Tag}
		$expression = (string) preg_replace_callback('/\{([^\}]+)\}/', static function (array $m) use ($resolve_single_token): string {
			return $resolve_single_token($m[1]);
		}, $expression);

		// Also handle FIELD("Label") if user typed a label inside FIELD(...)
		$expression = (string) preg_replace_callback('/FIELD\s*\(\s*(["\'])(.*?)\1\s*\)/i', static function (array $m) use ($uuid_map): string {
			$raw = trim($m[2]);
			$key = strtolower($raw);
			$uuid = $uuid_map[$key] ?? $raw;
			return 'FIELD("' . addslashes($uuid) . '")';
		}, $expression);

		return $expression;
	}

	/**
	 * @param array<string, mixed> $variables Variables and `fields` map.
	 * @param list<array<string, mixed>> $rows Repeater rows.
	 */
	public function evaluate(string $expression, array $variables = [], array $rows = []): Decimal {
		$this->operations       = 0;
		$variables['rows']      = $rows;
		$variables['TRUE']      = true;
		$variables['FALSE']     = false;
		if (isset($variables['all_fields']) && is_array($variables['all_fields'])) {
			$expression = self::resolve_tokens($expression, $variables['all_fields']);
		}
		$value                  = $this->evaluate_node($this->parser->parse($expression), $variables, 0);
		return $this->as_decimal($value);
	}

	/**
	 * @param array<string, mixed> $node AST node.
	 * @param array<string, mixed> $variables Variables.
	 */
	private function evaluate_node(array $node, array $variables, int $depth): mixed {
		$this->tick($depth);

		return match ($node['type'] ?? '') {
			'number'   => Decimal::from_string((string) $node['value']),
			'string'   => (string) $node['value'],
			'variable' => $this->variable((string) $node['name'], $variables),
			'unary'    => $this->unary((string) $node['operator'], (array) $node['operand'], $variables, $depth),
			'binary'   => $this->binary($node, $variables, $depth),
			'call'     => $this->call($node, $variables, $depth),
			default    => throw new RuntimeException('wooptionsfic_formula_invalid_ast'),
		};
	}

	/**
	 * @param array<string, mixed> $variables Variables.
	 */
	private function variable(string $name, array $variables): mixed {
		if (array_key_exists($name, $variables)) {
			return $this->normalize_value($variables[$name]);
		}
		$upper = strtoupper($name);
		if (array_key_exists($upper, $variables)) {
			return $this->normalize_value($variables[$upper]);
		}
		$lower = strtolower($name);
		if (in_array($lower, ['product_price', 'base_price', 'productprice', 'baseprice'], true)) {
			if (isset($variables['base_price'])) {
				return $this->normalize_value($variables['base_price']);
			}
			if (isset($variables['product_price'])) {
				return $this->normalize_value($variables['product_price']);
			}
		}
		if (in_array($lower, ['quantity', 'cart_quantity', 'cartquantity'], true)) {
			if (isset($variables['quantity'])) {
				return $this->normalize_value($variables['quantity']);
			}
		}
		if (in_array($lower, ['weight', 'width', 'height', 'length'], true)) {
			if (isset($variables[$lower])) {
				return $this->normalize_value($variables[$lower]);
			}
		}
		// Also check fields map
		$fields = is_array($variables['fields'] ?? null) ? $variables['fields'] : [];
		if (isset($fields[$name])) {
			return $this->normalize_value($fields[$name]);
		}
		foreach ($fields as $key => $val) {
			if (0 === strcasecmp((string) $key, $name)) {
				return $this->normalize_value($val);
			}
		}
		throw new RuntimeException('wooptionsfic_formula_unknown_variable_' . $name);
	}

	/**
	 * @param array<string, mixed> $operand Operand.
	 * @param array<string, mixed> $variables Variables.
	 */
	private function unary(string $operator, array $operand, array $variables, int $depth): mixed {
		$value = $this->evaluate_node($operand, $variables, $depth + 1);
		return match ($operator) {
			'!' , 'NOT' => ! $this->as_boolean($value),
			'-'         => $this->as_decimal($value)->negate(),
			'+'         => $this->as_decimal($value),
			default     => throw new RuntimeException('wooptionsfic_formula_unknown_unary'),
		};
	}

	/**
	 * @param array<string, mixed> $node Binary AST.
	 * @param array<string, mixed> $variables Variables.
	 */
	private function binary(array $node, array $variables, int $depth): mixed {
		$operator = (string) $node['operator'];

		if (in_array($operator, ['&&', 'AND'], true)) {
			$left = $this->evaluate_node((array) $node['left'], $variables, $depth + 1);
			return $this->as_boolean($left)
				&& $this->as_boolean($this->evaluate_node((array) $node['right'], $variables, $depth + 1));
		}
		if (in_array($operator, ['||', 'OR'], true)) {
			$left = $this->evaluate_node((array) $node['left'], $variables, $depth + 1);
			return $this->as_boolean($left)
				|| $this->as_boolean($this->evaluate_node((array) $node['right'], $variables, $depth + 1));
		}

		$left  = $this->evaluate_node((array) $node['left'], $variables, $depth + 1);
		$right = $this->evaluate_node((array) $node['right'], $variables, $depth + 1);

		if (in_array($operator, ['==', '!=', '>', '>=', '<', '<='], true)) {
			$comparison = $this->compare($left, $right);
			return match ($operator) {
				'=='    => 0 === $comparison,
				'!='    => 0 !== $comparison,
				'>'     => $comparison > 0,
				'>='    => $comparison >= 0,
				'<'     => $comparison < 0,
				'<='    => $comparison <= 0,
				default => false,
			};
		}

		$a = $this->as_decimal($left);
		$b = $this->as_decimal($right);
		return match ($operator) {
			'+'     => $a->add($b),
			'-'     => $a->subtract($b),
			'*'     => $a->multiply($b),
			'/'     => $a->divide($b),
			'%'     => $a->modulo($b),
			'^'     => $a->power($b->to_int()),
			default => throw new RuntimeException('wooptionsfic_formula_unknown_operator'),
		};
	}

	/**
	 * @param array<string, mixed> $node Call AST.
	 * @param array<string, mixed> $variables Variables.
	 */
	private function call(array $node, array $variables, int $depth): mixed {
		$name      = strtoupper((string) $node['name']);
		$arguments = (array) ($node['arguments'] ?? []);

		if ('IF' === $name) {
			$this->assert_argument_count($name, $arguments, 3, 3);
			$condition = $this->evaluate_node((array) $arguments[0], $variables, $depth + 1);
			return $this->evaluate_node(
				(array) ($this->as_boolean($condition) ? $arguments[1] : $arguments[2]),
				$variables,
				$depth + 1
			);
		}

		if (in_array($name, ['AND', 'OR'], true)) {
			$this->assert_argument_count($name, $arguments, 1, 50);
			foreach ($arguments as $argument) {
				$truth = $this->as_boolean($this->evaluate_node((array) $argument, $variables, $depth + 1));
				if ('AND' === $name && ! $truth) {
					return false;
				}
				if ('OR' === $name && $truth) {
					return true;
				}
			}
			return 'AND' === $name;
		}

		if ('NOT' === $name) {
			$this->assert_argument_count($name, $arguments, 1, 1);
			return ! $this->as_boolean($this->evaluate_node((array) $arguments[0], $variables, $depth + 1));
		}

		if ('FIELD' === $name) {
			$this->assert_argument_count($name, $arguments, 1, 1);
			$field_id = $this->evaluate_node((array) $arguments[0], $variables, $depth + 1);
			if (! is_string($field_id)) {
				throw new RuntimeException('wooptionsfic_formula_field_id_required');
			}
			$fields = is_array($variables['fields'] ?? null) ? $variables['fields'] : [];

			// 1. Exact match
			if (isset($fields[$field_id])) {
				return $this->normalize_value($fields[$field_id]);
			}

			// 2. Case-insensitive exact match
			foreach ($fields as $key => $val) {
				if (0 === strcasecmp((string) $key, $field_id)) {
					return $this->normalize_value($val);
				}
			}

			// 3. Dot-normalized match (spaces / hyphens / underscores normalized)
			$clean_id = preg_replace('/[^a-z0-9.]/', '', strtolower($field_id));
			if ('' !== $clean_id) {
				foreach ($fields as $key => $val) {
					$clean_key = preg_replace('/[^a-z0-9.]/', '', strtolower((string) $key));
					if ($clean_key === $clean_id) {
						return $this->normalize_value($val);
					}
				}
			}

			// 4. Fully alphanumeric match
			$alphanumeric_id = preg_replace('/[^a-z0-9]/', '', strtolower($field_id));
			if ('' !== $alphanumeric_id) {
				foreach ($fields as $key => $val) {
					$alphanumeric_key = preg_replace('/[^a-z0-9]/', '', strtolower((string) $key));
					if ($alphanumeric_key === $alphanumeric_id) {
						return $this->normalize_value($val);
					}
				}
			}

			// 5. Special fallback for product_price / base_price
			if (in_array(strtolower($field_id), ['product_price', 'base_price', 'productprice', 'baseprice'], true)) {
				if (isset($variables['base_price'])) {
					return $this->normalize_value($variables['base_price']);
				}
				if (isset($variables['product_price'])) {
					return $this->normalize_value($variables['product_price']);
				}
			}

			// 6. Special fallback for quantity
			if (in_array(strtolower($field_id), ['quantity', 'cart_quantity', 'cartquantity'], true)) {
				if (isset($variables['quantity'])) {
					return $this->normalize_value($variables['quantity']);
				}
			}

			return $this->normalize_value('0');
		}

		if (in_array($name, ['SUM', 'AVG', 'COUNT'], true)) {
			return $this->aggregate($name, $arguments, $variables, $depth);
		}

		$values = array_map(
			fn (array $argument): mixed => $this->evaluate_node($argument, $variables, $depth + 1),
			$arguments
		);

		return match ($name) {
			'MIN'   => $this->minimum($values),
			'MAX'   => $this->maximum($values),
			'ROUND' => $this->round_call($values),
			'ABS'   => $this->single_decimal($name, $values)->absolute(),
			'CEIL'  => $this->single_decimal($name, $values)->ceil(),
			'FLOOR' => $this->single_decimal($name, $values)->floor(),
			'POW'   => $this->power_call($values),
			default => throw new RuntimeException('wooptionsfic_formula_unknown_function_' . $name),
		};
	}

	/**
	 * @param list<array<string, mixed>> $arguments AST arguments.
	 * @param array<string, mixed> $variables Variables.
	 */
	private function aggregate(string $name, array $arguments, array $variables, int $depth): Decimal {
		$this->assert_argument_count($name, $arguments, 'COUNT' === $name ? 1 : 2, 2);
		$rows = $this->evaluate_node((array) $arguments[0], $variables, $depth + 1);
		if (! is_array($rows)) {
			throw new RuntimeException('wooptionsfic_formula_rows_required');
		}

		if ('COUNT' === $name && 1 === count($arguments)) {
			return Decimal::from_int(count($rows));
		}

		$field = $this->evaluate_node((array) $arguments[1], $variables, $depth + 1);
		if (! is_string($field)) {
			throw new RuntimeException('wooptionsfic_formula_field_id_required');
		}

		$total = Decimal::zero();
		$count = 0;
		foreach ($rows as $row) {
			if (! is_array($row) || ! array_key_exists($field, $row)) {
				continue;
			}
			$total = $total->add($this->as_decimal($this->normalize_value($row[$field])));
			++$count;
		}

		if ('COUNT' === $name) {
			return Decimal::from_int($count);
		}
		if ('AVG' === $name) {
			return 0 === $count ? Decimal::zero() : $total->divide(Decimal::from_int($count));
		}
		return $total;
	}

	/**
	 * @param list<mixed> $values Values.
	 */
	private function minimum(array $values): Decimal {
		if ([] === $values) {
			throw new RuntimeException('wooptionsfic_formula_min_requires_values');
		}
		$minimum = $this->as_decimal(array_shift($values));
		foreach ($values as $value) {
			$decimal = $this->as_decimal($value);
			if ($decimal->compare($minimum) < 0) {
				$minimum = $decimal;
			}
		}
		return $minimum;
	}

	/**
	 * @param list<mixed> $values Values.
	 */
	private function maximum(array $values): Decimal {
		if ([] === $values) {
			throw new RuntimeException('wooptionsfic_formula_max_requires_values');
		}
		$maximum = $this->as_decimal(array_shift($values));
		foreach ($values as $value) {
			$decimal = $this->as_decimal($value);
			if ($decimal->compare($maximum) > 0) {
				$maximum = $decimal;
			}
		}
		return $maximum;
	}

	/**
	 * @param list<mixed> $values Values.
	 */
	private function round_call(array $values): Decimal {
		if (count($values) < 1 || count($values) > 2) {
			throw new RuntimeException('wooptionsfic_formula_round_arguments');
		}
		$places = isset($values[1]) ? $this->as_decimal($values[1])->to_int() : 0;
		return $this->as_decimal($values[0])->round($places);
	}

	/**
	 * @param list<mixed> $values Values.
	 */
	private function power_call(array $values): Decimal {
		if (2 !== count($values)) {
			throw new RuntimeException('wooptionsfic_formula_pow_arguments');
		}
		return $this->as_decimal($values[0])->power($this->as_decimal($values[1])->to_int());
	}

	/**
	 * @param list<mixed> $values Values.
	 */
	private function single_decimal(string $name, array $values): Decimal {
		if (1 !== count($values)) {
			throw new RuntimeException('wooptionsfic_formula_' . strtolower($name) . '_arguments');
		}
		return $this->as_decimal($values[0]);
	}

	private function normalize_value(mixed $value): mixed {
		if ($value instanceof Decimal || is_bool($value) || is_array($value)) {
			return $value;
		}
		if (is_int($value)) {
			return Decimal::from_int($value);
		}
		if (is_float($value)) {
			$str = rtrim(rtrim(sprintf('%.6F', $value), '0'), '.');
			return Decimal::from_string('' === $str ? '0' : $str);
		}
		if (is_string($value)) {
			$trimmed = trim($value);
			if (1 === preg_match('/\A[+-]?\d+(?:\.\d+)?\z/', $trimmed)) {
				return Decimal::from_string($trimmed);
			}
			if (preg_match('/\A\s*([+-]?\d+(?:\.\d+)?)/', $trimmed, $m)) {
				return Decimal::from_string($m[1]);
			}
		}
		return is_scalar($value) ? (string) $value : $value;
	}

	private function as_decimal(mixed $value): Decimal {
		$value = $this->normalize_value($value);
		if ($value instanceof Decimal) {
			return $value;
		}
		if (is_bool($value)) {
			return Decimal::from_int($value ? 1 : 0);
		}
		if (is_numeric($value)) {
			return Decimal::from_string((string) $value);
		}
		return Decimal::zero();
	}

	private function as_boolean(mixed $value): bool {
		if (is_bool($value)) {
			return $value;
		}
		if ($value instanceof Decimal) {
			return ! $value->is_zero();
		}
		if (is_string($value)) {
			return '' !== $value && '0' !== $value;
		}
		if (is_array($value)) {
			return [] !== $value;
		}
		return (bool) $value;
	}

	private function compare(mixed $left, mixed $right): int {
		try {
			return $this->as_decimal($left)->compare($this->as_decimal($right));
		} catch (RuntimeException) {
			return strcmp((string) $left, (string) $right);
		}
	}

	private function tick(int $depth): void {
		++$this->operations;
		if ($this->operations > $this->operation_limit) {
			throw new RuntimeException('wooptionsfic_formula_operation_limit');
		}
		if ($depth > 40) {
			throw new RuntimeException('wooptionsfic_formula_evaluation_depth');
		}
	}

	/**
	 * @param list<mixed> $arguments Arguments.
	 */
	private function assert_argument_count(string $name, array $arguments, int $minimum, int $maximum): void {
		$count = count($arguments);
		if ($count < $minimum || $count > $maximum) {
			throw new RuntimeException('wooptionsfic_formula_' . strtolower($name) . '_arguments');
		}
	}
}
