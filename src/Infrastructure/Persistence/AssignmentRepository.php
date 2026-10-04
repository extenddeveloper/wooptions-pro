<?php
/**
 * Assignment persistence and candidate query.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Infrastructure\Persistence;

use RuntimeException;
use WooOptionsPro\Domain\Support\CanonicalJson;
use WooOptionsPro\Domain\Support\Uuid;

final class AssignmentRepository {
	/**
	 * @return list<array<string,mixed>>
	 */
	public function for_set(int $set_id): array {
		global $wpdb;
		$table = Schema::table('assignments');
		$rows  = $wpdb->get_results(
			$wpdb->prepare("SELECT * FROM {$table} WHERE option_set_id = %d ORDER BY priority ASC, uuid ASC", $set_id),
			ARRAY_A
		);
		return array_map([$this, 'map'], is_array($rows) ? $rows : []);
	}

	/**
	 * @param list<array<string,mixed>> $assignments Assignments.
	 */
	public function replace_for_set(int $set_id, array $assignments): void {
		global $wpdb;
		$table = Schema::table('assignments');
		if (false === $wpdb->delete($table, ['option_set_id' => $set_id], ['%d'])) {
			throw new RuntimeException('wooptions-pro_assignments_delete_failed');
		}

		$now = current_time('mysql', true);
		foreach ($assignments as $assignment) {
			$uuid = (string) ($assignment['uuid'] ?? '');
			if (! Uuid::is_valid($uuid)) {
				$uuid = Uuid::v4();
			}
			$ok = $wpdb->insert(
				$table,
				[
					'uuid'            => strtolower($uuid),
					'option_set_id'   => $set_id,
					'target_type'     => (string) $assignment['targetType'],
					'target_id'       => $assignment['targetId'] ?? null,
					'include_exclude' => (string) ($assignment['mode'] ?? 'include'),
					'priority'        => (int) ($assignment['priority'] ?? 10),
					'context_json'    => CanonicalJson::encode($assignment['context'] ?? []),
					'created_at_gmt'  => $now,
					'updated_at_gmt'  => $now,
				],
				['%s', '%d', '%s', '%d', '%s', '%d', '%s', '%s', '%s']
			);
			if (false === $ok) {
				throw new RuntimeException('wooptions-pro_assignment_insert_failed');
			}
		}
		$this->bump_generation();
	}

	/**
	 * @param array<string,mixed> $context Resolution context.
	 * @return list<array<string,mixed>>
	 */
	public function candidates(array $context): array {
		global $wpdb;

		$table      = Schema::table('assignments');
		$sets       = Schema::table('option_sets');
		$clauses    = ['a.target_type = %s'];
		$parameters = ['global'];

		$scalar_targets = [
			'product'     => (int) ($context['productId'] ?? 0),
			'variation'   => (int) ($context['variationId'] ?? 0),
			'product_type'=> (string) ($context['productType'] ?? ''),
		];
		foreach ($scalar_targets as $type => $target) {
			if ('' === (string) $target || 0 === $target) {
				continue;
			}
			if ('product_type' === $type) {
				// Product types are represented by their stable term-like hash ID.
				$target = self::string_target_id((string) $target);
			}
			$clauses[]    = '(a.target_type = %s AND a.target_id = %d)';
			$parameters[] = $type;
			$parameters[] = $target;
		}

		foreach (['category' => 'categoryIds', 'tag' => 'tagIds'] as $type => $context_key) {
			$ids = array_values(array_unique(array_filter(array_map('intval', (array) ($context[$context_key] ?? [])))));
			if ([] === $ids) {
				continue;
			}
			$placeholders = implode(',', array_fill(0, count($ids), '%d'));
			$clauses[]    = "(a.target_type = %s AND a.target_id IN ({$placeholders}))";
			$parameters[] = $type;
			$parameters   = array_merge($parameters, $ids);
		}

		$where = implode(' OR ', $clauses);
		$sql   = $wpdb->prepare(
			"SELECT a.*, s.uuid AS set_uuid, s.priority AS set_priority
			 FROM {$table} a
			 INNER JOIN {$sets} s ON s.id = a.option_set_id
			 WHERE s.status = 'active' AND ({$where})
			 ORDER BY s.priority ASC, s.uuid ASC, a.priority ASC, a.uuid ASC",
			$parameters
		);
		$rows = $wpdb->get_results($sql, ARRAY_A);
		return array_map([$this, 'map'], is_array($rows) ? $rows : []);
	}

	public function generation(): int {
		return (int) get_option('wooptions-pro_assignment_generation', 1);
	}

	public function bump_generation(): void {
		update_option('wooptions-pro_assignment_generation', $this->generation() + 1, false);
	}

	public static function string_target_id(string $value): int {
		$unsigned = (int) sprintf('%u', crc32($value));
		return max(1, $unsigned);
	}

	/**
	 * @param array<string,mixed> $row Row.
	 * @return array<string,mixed>
	 */
	private function map(array $row): array {
		$context = [];
		if (! empty($row['context_json'])) {
			$decoded = json_decode((string) $row['context_json'], true);
			$context = is_array($decoded) ? $decoded : [];
		}
		return [
			'id'          => (int) $row['id'],
			'uuid'        => (string) $row['uuid'],
			'optionSetId' => (int) $row['option_set_id'],
			'targetType'  => (string) $row['target_type'],
			'targetId'    => null === $row['target_id'] ? null : (int) $row['target_id'],
			'mode'        => (string) $row['include_exclude'],
			'priority'    => (int) $row['priority'],
			'context'     => $context,
			'setUuid'     => isset($row['set_uuid']) ? (string) $row['set_uuid'] : null,
			'setPriority' => isset($row['set_priority']) ? (int) $row['set_priority'] : null,
		];
	}
}
