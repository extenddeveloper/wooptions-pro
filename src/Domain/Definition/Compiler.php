<?php
/**
 * Authored-definition validator and compiler.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Domain\Definition;

use RuntimeException;
use WooOptionsPro\Domain\Pricing\Formula\Parser;
use WooOptionsPro\Domain\Style\PaletteRegistry;
use WooOptionsPro\Domain\Support\CanonicalJson;
use WooOptionsPro\Domain\Support\Uuid;

final class Compiler {
	public const SCHEMA_VERSION   = 1;
	public const COMPILER_VERSION = '1.0.0';

	public function __construct(
		private readonly FieldTypeRegistry $fields,
		private readonly Parser $formula_parser,
		private readonly PaletteRegistry $palettes,
		private readonly int $maximum_fields = 200,
		private readonly int $maximum_choices = 1000
	) {
	}

	/**
	 * @return array<string, mixed>
	 */
	public function empty_definition(string $title, ?string $set_uuid = null): array {
		return [
			'schemaVersion' => self::SCHEMA_VERSION,
			'setUuid'       => $set_uuid && Uuid::is_valid($set_uuid) ? strtolower($set_uuid) : Uuid::v4(),
			'revisionUuid'  => Uuid::v4(),
			'title'         => trim(strip_tags($title)),
			'layout'        => ['type' => 'stack', 'settings' => []],
			'fields'        => [],
			'rules'         => [],
			'pricing'       => [],
			'preview'       => ['assets' => [], 'layers' => [], 'bindings' => []],
			'style'         => ['palette' => 'iris-studio', 'overrides' => [], 'typography' => ['family' => 'inherit', 'labelWeight' => 600, 'bodyWeight' => 400]],
			'settings'      => ['showPriceBreakdown' => true, 'saveEnabled' => true, 'shareEnabled' => true],
		];
	}

	/**
	 * @param array<string, mixed> $definition Authored definition.
	 * @return array{
	 *   valid:bool,
	 *   definition:array<string,mixed>,
	 *   compiled:array<string,mixed>,
	 *   errors:list<array<string,mixed>>,
	 *   warnings:list<array<string,mixed>>,
	 *   contentHash:string
	 * }
	 */
	public function compile(array $definition): array {
		$errors   = [];
		$warnings = [];
		$set_uuid = (string) ($definition['setUuid'] ?? '');
		$rev_uuid = (string) ($definition['revisionUuid'] ?? '');

		if (! Uuid::is_valid($set_uuid)) {
			$errors[] = ['code' => 'invalid_set_uuid', 'path' => 'setUuid'];
			$set_uuid = Uuid::v4();
		}
		if (! Uuid::is_valid($rev_uuid)) {
			$rev_uuid = Uuid::v4();
		}

		$layout_type = (string) (($definition['layout']['type'] ?? 'stack'));
		if (! in_array($layout_type, ['stack', 'inline', 'grid', 'accordion', 'tabs', 'wizard'], true)) {
			$errors[]   = ['code' => 'invalid_layout', 'path' => 'layout.type'];
			$layout_type= 'stack';
		}

		$normalized_fields = [];
		$seen_ids          = [];
		$source_fields     = (array) ($definition['fields'] ?? []);

		if (count($source_fields) > $this->maximum_fields) {
			$errors[] = ['code' => 'field_limit', 'maximum' => $this->maximum_fields];
			$source_fields = array_slice($source_fields, 0, $this->maximum_fields);
		}

		foreach ($source_fields as $index => $field) {
			if (! is_array($field)) {
				$errors[] = ['code' => 'invalid_field', 'path' => 'fields.' . $index];
				continue;
			}
			$type = $this->fields->get((string) ($field['type'] ?? ''));
			if (! $type) {
				$errors[] = ['code' => 'unknown_field_type', 'path' => 'fields.' . $index, 'type' => $field['type'] ?? ''];
				continue;
			}
			$normalized = $type->normalize_definition($field);
			$this->collect_field_ids($normalized, $seen_ids, $errors, 'fields.' . $index);
			$normalized_fields[] = $normalized;
		}

		$catalog_counts = $this->catalog_counts($normalized_fields);
		if ($catalog_counts['fields'] > $this->maximum_fields) {
			$errors[] = ['code' => 'field_limit', 'maximum' => $this->maximum_fields, 'actual' => $catalog_counts['fields']];
		}
		if ($catalog_counts['choices'] > $this->maximum_choices) {
			$errors[] = ['code' => 'choice_limit', 'maximum' => $this->maximum_choices, 'actual' => $catalog_counts['choices']];
		}

		$normalized_rules = $this->normalize_rules((array) ($definition['rules'] ?? []), $seen_ids, $errors, $warnings);
		$style            = $this->palettes->resolve((array) ($definition['style'] ?? []));
		$errors           = array_merge($errors, $style['errors']);
		$warnings         = array_merge($warnings, $style['warnings']);

		$normalized = [
			'schemaVersion' => self::SCHEMA_VERSION,
			'setUuid'       => strtolower($set_uuid),
			'revisionUuid'  => strtolower($rev_uuid),
			'title'         => $this->plain_text((string) ($definition['title'] ?? 'Untitled option set'), 255),
			'layout'        => [
				'type'     => $layout_type,
				'settings' => is_array($definition['layout']['settings'] ?? null) ? $definition['layout']['settings'] : [],
			],
			'fields'        => $normalized_fields,
			'rules'         => $normalized_rules,
			'pricing'       => is_array($definition['pricing'] ?? null) ? $definition['pricing'] : [],
			'preview'       => $this->normalize_preview((array) ($definition['preview'] ?? []), $seen_ids, $warnings),
			'style'         => [
				'palette'    => $style['palette'],
				'overrides'  => is_array($definition['style']['overrides'] ?? null) ? $definition['style']['overrides'] : (is_array($definition['style']['tokens'] ?? null) ? $definition['style']['tokens'] : []),
				'typography' => $style['typography'],
			],
			'settings'      => $this->normalize_settings((array) ($definition['settings'] ?? [])),
		];

		$dependencies = $this->dependency_graph($normalized_fields, $errors);
		$this->detect_cycles($dependencies, $errors);

		$hashable = $normalized;
		unset($hashable['revisionUuid']);
		$content_hash = CanonicalJson::hash($hashable);

		$compiled = [
			'schemaVersion'   => self::SCHEMA_VERSION,
			'compilerVersion' => self::COMPILER_VERSION,
			'setUuid'         => $normalized['setUuid'],
			'revisionUuid'    => $normalized['revisionUuid'],
			'contentHash'     => $content_hash,
			'title'           => $normalized['title'],
			'layout'          => $normalized['layout'],
			'fields'          => $normalized['fields'],
			'rules'           => $normalized['rules'],
			'preview'         => $normalized['preview'],
			'style'           => [
				'palette'    => $style['palette'],
				'tokens'     => $style['tokens'],
				'typography' => $style['typography'],
			],
			'settings'        => $normalized['settings'],
			'dependencies'    => $dependencies,
		];

		return [
			'valid'       => [] === $errors,
			'definition'  => $normalized,
			'compiled'    => $compiled,
			'errors'      => $errors,
			'warnings'    => $warnings,
			'contentHash' => $content_hash,
		];
	}

	/**
	 * @param array<string, mixed> $field Field.
	 * @param array<string, bool> $seen Seen UUIDs.
	 * @param list<array<string,mixed>> $errors Errors.
	 */
	private function collect_field_ids(array $field, array &$seen, array &$errors, string $path): void {
		$uuid = (string) ($field['uuid'] ?? '');
		if (! Uuid::is_valid($uuid)) {
			$errors[] = ['code' => 'invalid_field_uuid', 'path' => $path . '.uuid'];
			return;
		}
		if (isset($seen[$uuid])) {
			$errors[] = ['code' => 'duplicate_uuid', 'path' => $path . '.uuid', 'uuid' => $uuid];
		}
		$seen[$uuid] = true;

		foreach ((array) ($field['choices'] ?? []) as $choice_index => $choice) {
			$choice_uuid = (string) ($choice['uuid'] ?? '');
			if (! Uuid::is_valid($choice_uuid) || isset($seen[$choice_uuid])) {
				$errors[] = ['code' => 'invalid_or_duplicate_choice_uuid', 'path' => $path . '.choices.' . $choice_index];
			}
			$seen[$choice_uuid] = true;
		}
		foreach ((array) ($field['children'] ?? []) as $child_index => $child) {
			if (is_array($child)) {
				$this->collect_field_ids($child, $seen, $errors, $path . '.children.' . $child_index);
			}
		}
	}

	/**
	 * @param list<mixed> $rules Rules.
	 * @param array<string,bool> $known_ids IDs.
	 * @param list<array<string,mixed>> $errors Errors.
	 * @param list<array<string,mixed>> $warnings Warnings.
	 * @return list<array<string,mixed>>
	 */
	private function normalize_rules(array $rules, array $known_ids, array &$errors, array &$warnings): array {
		$normalized = [];
		$seen       = [];
		foreach (array_slice($rules, 0, 200) as $index => $rule) {
			if (! is_array($rule) || ! is_array($rule['condition'] ?? null)) {
				$errors[] = ['code' => 'invalid_rule', 'path' => 'rules.' . $index];
				continue;
			}
			$uuid = (string) ($rule['uuid'] ?? '');
			if (! Uuid::is_valid($uuid)) {
				$uuid = Uuid::v4();
			}
			if (isset($seen[$uuid])) {
				$errors[] = ['code' => 'duplicate_rule_uuid', 'path' => 'rules.' . $index];
				continue;
			}
			$seen[$uuid] = true;

			$references = $this->condition_references($rule['condition']);
			foreach ($references as $reference) {
				if (! isset($known_ids[$reference])) {
					$errors[] = ['code' => 'rule_unknown_reference', 'ruleUuid' => $uuid, 'reference' => $reference];
				}
			}

			$actions = [];
			foreach ((array) ($rule['actions'] ?? []) as $action) {
				if (! is_array($action)) {
					continue;
				}
				$type   = (string) ($action['type'] ?? '');
				$target = (string) ($action['target'] ?? '');
				if (! in_array($type, ['show', 'hide', 'enable', 'disable', 'require', 'optional', 'help'], true)) {
					$warnings[] = ['code' => 'rule_unknown_action', 'ruleUuid' => $uuid, 'action' => $type];
					continue;
				}
				if (! isset($known_ids[$target])) {
					$errors[] = ['code' => 'rule_unknown_target', 'ruleUuid' => $uuid, 'target' => $target];
					continue;
				}
				$actions[] = ['type' => $type, 'target' => $target, 'value' => $this->plain_text((string) ($action['value'] ?? ''), 1000)];
			}
			$normalized[] = [
				'uuid'      => strtolower($uuid),
				'name'      => $this->plain_text((string) ($rule['name'] ?? 'Rule'), 200),
				'condition' => $rule['condition'],
				'actions'   => $actions,
			];
		}
		return $normalized;
	}

	/**
	 * @param array<string,mixed> $preview Preview.
	 * @param array<string,bool> $known_ids IDs.
	 * @param list<array<string,mixed>> $warnings Warnings.
	 * @return array<string,mixed>
	 */
	private function normalize_preview(array $preview, array $known_ids, array &$warnings): array {
		$bindings = [];
		foreach (array_slice((array) ($preview['bindings'] ?? []), 0, 200) as $binding) {
			if (! is_array($binding)) {
				continue;
			}
			$field_uuid = (string) ($binding['fieldUuid'] ?? '');
			if (! isset($known_ids[$field_uuid])) {
				$warnings[] = ['code' => 'preview_unknown_field', 'fieldUuid' => $field_uuid];
				continue;
			}
			$bindings[] = [
				'uuid'      => Uuid::is_valid((string) ($binding['uuid'] ?? '')) ? strtolower((string) $binding['uuid']) : Uuid::v4(),
				'fieldUuid' => $field_uuid,
				'target'    => in_array(($binding['target'] ?? ''), ['text', 'color', 'image', 'visibility'], true) ? $binding['target'] : 'text',
				'layerUuid' => Uuid::is_valid((string) ($binding['layerUuid'] ?? '')) ? strtolower((string) $binding['layerUuid']) : '',
			];
		}
		return [
			'baseImageId' => max(0, (int) ($preview['baseImageId'] ?? 0)),
			'layers'      => array_values(array_filter((array) ($preview['layers'] ?? []), 'is_array')),
			'bindings'    => $bindings,
		];
	}

	/**
	 * @param array<string,mixed> $settings Settings.
	 * @return array<string,bool>
	 */
	private function normalize_settings(array $settings): array {
		return [
			'showPriceBreakdown' => ! isset($settings['showPriceBreakdown']) || ! empty($settings['showPriceBreakdown']),
			'saveEnabled'        => ! isset($settings['saveEnabled']) || ! empty($settings['saveEnabled']),
			'shareEnabled'       => ! isset($settings['shareEnabled']) || ! empty($settings['shareEnabled']),
			'stickySummary'      => ! isset($settings['stickySummary']) || ! empty($settings['stickySummary']),
		];
	}

	/**
	 * @param list<array<string,mixed>> $fields Fields.
	 * @param list<array<string,mixed>> $errors Errors.
	 * @return array<string,list<string>>
	 */
	private function dependency_graph(array $fields, array &$errors): array {
		$graph = [];
		$walk  = function (array $field) use (&$walk, &$graph, &$errors): void {
			$uuid       = (string) ($field['uuid'] ?? '');
			$references = [];
			$pricing    = is_array($field['pricing'] ?? null) ? $field['pricing'] : [];
			if ('formula' === ($pricing['strategy'] ?? '')) {
				$expression = (string) ($pricing['expression'] ?? '');
				try {
					$this->formula_parser->parse($expression);
				} catch (RuntimeException $exception) {
					$errors[] = ['code' => 'formula_syntax', 'fieldUuid' => $uuid, 'detail' => $exception->getMessage()];
				}
				if (preg_match_all('/FIELD\s*\(\s*["\']([0-9a-f-]{36})["\']\s*\)/i', $expression, $matches)) {
					$references = array_merge($references, $matches[1]);
				}
			}
			foreach ((array) ($field['conditions'] ?? []) as $condition) {
				if (is_array($condition)) {
					$references = array_merge($references, $this->condition_references($condition));
				}
			}
			$graph[$uuid] = array_values(array_unique(array_filter($references, static fn (string $id): bool => $id !== $uuid)));
			foreach ((array) ($field['children'] ?? []) as $child) {
				if (is_array($child)) {
					$walk($child);
				}
			}
		};
		foreach ($fields as $field) {
			$walk($field);
		}
		$known = array_fill_keys(array_keys($graph), true);
		foreach ($graph as $field_uuid => $references) {
			foreach ($references as $reference) {
				if (! isset($known[$reference])) {
					$errors[] = [
						'code'      => 'field_unknown_reference',
						'fieldUuid' => $field_uuid,
						'reference' => $reference,
					];
				}
			}
		}
		return $graph;
	}

	/**
	 * @param list<array<string,mixed>> $fields Fields.
	 * @return array{fields:int,choices:int}
	 */
	private function catalog_counts(array $fields): array {
		$field_count  = 0;
		$choice_count = 0;
		$walk = function (array $items) use (&$walk, &$field_count, &$choice_count): void {
			foreach ($items as $field) {
				if (! is_array($field)) {
					continue;
				}
				++$field_count;
				$choice_count += count((array) ($field['choices'] ?? []));
				$walk((array) ($field['children'] ?? []));
			}
		};
		$walk($fields);
		return ['fields' => $field_count, 'choices' => $choice_count];
	}

	/**
	 * @param array<string,list<string>> $graph Graph.
	 * @param list<array<string,mixed>> $errors Errors.
	 */
	private function detect_cycles(array $graph, array &$errors): void {
		$state = [];
		$stack = [];
		$visit = function (string $node) use (&$visit, &$state, &$stack, $graph, &$errors): void {
			if (1 === ($state[$node] ?? 0)) {
				$position = array_search($node, $stack, true);
				$cycle    = false === $position ? [$node] : array_slice($stack, $position);
				$cycle[]  = $node;
				$errors[] = ['code' => 'dependency_cycle', 'cycle' => $cycle];
				return;
			}
			if (2 === ($state[$node] ?? 0)) {
				return;
			}
			$state[$node] = 1;
			$stack[]      = $node;
			foreach ($graph[$node] ?? [] as $dependency) {
				if (isset($graph[$dependency])) {
					$visit($dependency);
				}
			}
			array_pop($stack);
			$state[$node] = 2;
		};
		foreach (array_keys($graph) as $node) {
			$visit($node);
		}
	}

	/**
	 * @param array<string,mixed> $condition Condition.
	 * @return list<string>
	 */
	private function condition_references(array $condition): array {
		$references = [];
		$walk       = function (mixed $node) use (&$walk, &$references): void {
			if (! is_array($node)) {
				return;
			}
			if (isset($node['field']) && is_string($node['field'])) {
				$references[] = $node['field'];
			}
			if (isset($node['rowField']) && is_string($node['rowField'])) {
				$references[] = $node['rowField'];
			}
			foreach ($node as $value) {
				if (is_array($value)) {
					$walk($value);
				}
			}
		};
		$walk($condition);
		return array_values(array_unique($references));
	}

	private function plain_text(string $value, int $maximum): string {
		$value = trim(strip_tags($value));
		return function_exists('mb_substr') ? (string) mb_substr($value, 0, $maximum) : substr($value, 0, $maximum);
	}
}
