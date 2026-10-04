<?php
/**
 * Option-set and revision persistence.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Infrastructure\Persistence;

use RuntimeException;
use WooOptionsPro\Domain\Support\CanonicalJson;

final class OptionSetRepository {
	/**
	 * @param array<string,mixed> $arguments Query arguments.
	 * @return array{items:list<array<string,mixed>>,total:int,page:int,perPage:int}
	 */
	public function list(array $arguments = []): array {
		global $wpdb;

		$page      = max(1, (int) ($arguments['page'] ?? 1));
		$per_page  = max(1, min(100, (int) ($arguments['perPage'] ?? 20)));
		$status    = (string) ($arguments['status'] ?? 'active');
		$search    = trim((string) ($arguments['search'] ?? ''));
		$order_by  = in_array(($arguments['orderBy'] ?? ''), ['title', 'updated_at_gmt', 'created_at_gmt', 'priority'], true)
			? (string) $arguments['orderBy']
			: 'updated_at_gmt';
		$order     = 'ASC' === strtoupper((string) ($arguments['order'] ?? 'DESC')) ? 'ASC' : 'DESC';
		$table     = Schema::table('option_sets');
		$where     = ['status = %s'];
		$parameters= [$status];

		if ('' !== $search) {
			$like       = '%' . $wpdb->esc_like($search) . '%';
			$where[]    = '(title LIKE %s OR uuid LIKE %s OR slug LIKE %s)';
			$parameters = array_merge($parameters, [$like, $like, $like]);
		}

		$where_sql  = implode(' AND ', $where);
		$count_sql  = $wpdb->prepare("SELECT COUNT(*) FROM {$table} WHERE {$where_sql}", $parameters);
		$total      = (int) $wpdb->get_var($count_sql);
		$offset     = ($page - 1) * $per_page;
		$query_args = array_merge($parameters, [$per_page, $offset]);
		$query      = $wpdb->prepare(
			"SELECT * FROM {$table} WHERE {$where_sql} ORDER BY {$order_by} {$order} LIMIT %d OFFSET %d",
			$query_args
		);
		$rows = $wpdb->get_results($query, ARRAY_A);

		return [
			'items'   => array_map([$this, 'map_set'], is_array($rows) ? $rows : []),
			'total'   => $total,
			'page'    => $page,
			'perPage' => $per_page,
		];
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public function find_set(string $uuid): ?array {
		global $wpdb;
		$table = Schema::table('option_sets');
		$row   = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE uuid = %s LIMIT 1", $uuid), ARRAY_A);
		return is_array($row) ? $this->map_set($row) : null;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public function find_set_by_id(int $id): ?array {
		global $wpdb;
		$table = Schema::table('option_sets');
		$row   = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d LIMIT 1", $id), ARRAY_A);
		return is_array($row) ? $this->map_set($row) : null;
	}

	/**
	 * @param array<string,mixed> $data Set values.
	 */
	public function insert_set(array $data): int {
		global $wpdb;
		$now = current_time('mysql', true);
		$ok  = $wpdb->insert(
			Schema::table('option_sets'),
			[
				'uuid'           => (string) $data['uuid'],
				'title'          => (string) $data['title'],
				'slug'           => (string) $data['slug'],
				'status'         => (string) ($data['status'] ?? 'active'),
				'priority'       => (int) ($data['priority'] ?? 10),
				'created_by'     => (int) ($data['userId'] ?? 0),
				'updated_by'     => (int) ($data['userId'] ?? 0),
				'created_at_gmt' => $now,
				'updated_at_gmt' => $now,
			],
			['%s', '%s', '%s', '%s', '%d', '%d', '%d', '%s', '%s']
		);
		if (false === $ok) {
			throw new RuntimeException('wooptions-pro_set_insert_failed');
		}
		return (int) $wpdb->insert_id;
	}

	/**
	 * @param array<string,mixed> $changes Bounded changes.
	 */
	public function update_set(int $id, array $changes): void {
		global $wpdb;
		$allowed = [
			'title'                         => '%s',
			'slug'                          => '%s',
			'status'                        => '%s',
			'priority'                      => '%d',
			'current_draft_revision_id'     => '%d',
			'current_published_revision_id' => '%d',
			'updated_by'                    => '%d',
		];
		$data   = [];
		$format = [];
		foreach ($changes as $key => $value) {
			if (isset($allowed[$key])) {
				$data[$key] = $value;
				$format[]   = $allowed[$key];
			}
		}
		$data['updated_at_gmt'] = current_time('mysql', true);
		$format[]               = '%s';
		if (false === $wpdb->update(Schema::table('option_sets'), $data, ['id' => $id], $format, ['%d'])) {
			throw new RuntimeException('wooptions-pro_set_update_failed');
		}
	}

	/**
	 * @param array<string,mixed> $data Revision data.
	 */
	public function insert_revision(array $data): int {
		global $wpdb;
		$ok = $wpdb->insert(
			Schema::table('revisions'),
			[
				'uuid'                    => (string) $data['uuid'],
				'option_set_id'           => (int) $data['optionSetId'],
				'revision_number'         => (int) $data['revisionNumber'],
				'parent_revision_id'      => $data['parentRevisionId'] ?? null,
				'state'                   => (string) $data['state'],
				'schema_version'          => (int) ($data['schemaVersion'] ?? 1),
				'compiler_version'        => (string) ($data['compilerVersion'] ?? '1'),
				'definition_json'         => CanonicalJson::encode($data['definition']),
				'compiled_json'           => isset($data['compiled']) ? CanonicalJson::encode($data['compiled']) : null,
				'content_hash'            => (string) $data['contentHash'],
				'validation_summary_json' => CanonicalJson::encode($data['validationSummary'] ?? []),
				'version_note'            => (string) ($data['versionNote'] ?? ''),
				'created_by'              => (int) ($data['userId'] ?? 0),
				'created_at_gmt'          => current_time('mysql', true),
				'published_at_gmt'        => 'published' === $data['state'] ? current_time('mysql', true) : null,
			],
			['%s', '%d', '%d', '%d', '%s', '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%s', '%s']
		);
		if (false === $ok) {
			throw new RuntimeException('wooptions-pro_revision_insert_failed');
		}
		return (int) $wpdb->insert_id;
	}

	public function next_revision_number(int $set_id): int {
		global $wpdb;
		$table = Schema::table('revisions');
		$max   = (int) $wpdb->get_var(
			$wpdb->prepare("SELECT MAX(revision_number) FROM {$table} WHERE option_set_id = %d", $set_id)
		);
		return $max + 1;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public function find_revision_by_id(int $id): ?array {
		global $wpdb;
		$table = Schema::table('revisions');
		$row   = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d LIMIT 1", $id), ARRAY_A);
		return is_array($row) ? $this->map_revision($row) : null;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public function find_revision(string $uuid): ?array {
		global $wpdb;
		$table = Schema::table('revisions');
		$row   = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE uuid = %s LIMIT 1", $uuid), ARRAY_A);
		return is_array($row) ? $this->map_revision($row) : null;
	}

	/**
	 * @return list<array<string,mixed>>
	 */
	public function revisions(int $set_id, int $limit = 100): array {
		global $wpdb;
		$table = Schema::table('revisions');
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE option_set_id = %d ORDER BY revision_number DESC LIMIT %d",
				$set_id,
				max(1, min(500, $limit))
			),
			ARRAY_A
		);
		return array_map([$this, 'map_revision'], is_array($rows) ? $rows : []);
	}

	/**
	 * @return list<array<string,mixed>>
	 */
	public function published_revisions_for_sets(array $set_ids): array {
		global $wpdb;
		$set_ids = array_values(array_unique(array_map('intval', $set_ids)));
		if ([] === $set_ids) {
			return [];
		}
		$placeholders = implode(',', array_fill(0, count($set_ids), '%d'));
		$sets_table   = Schema::table('option_sets');
		$revs_table   = Schema::table('revisions');
		$sql          = $wpdb->prepare(
			"SELECT r.*, s.priority AS set_priority, s.uuid AS set_uuid, s.title AS set_title
			 FROM {$sets_table} s
			 INNER JOIN {$revs_table} r ON r.id = s.current_published_revision_id
			 WHERE s.id IN ({$placeholders}) AND s.status = 'active'
			 ORDER BY s.priority ASC, s.uuid ASC",
			$set_ids
		);
		$rows = $wpdb->get_results($sql, ARRAY_A);
		return array_map([$this, 'map_revision'], is_array($rows) ? $rows : []);
	}

	public function delete_set(int $id, string $uuid): void {
		global $wpdb;

		$wpdb->delete(Schema::table('assignments'), ['option_set_id' => $id], ['%d']);
		$wpdb->delete(Schema::table('revisions'), ['option_set_id' => $id], ['%d']);
		$wpdb->delete(Schema::table('analytics_daily'), ['option_set_uuid' => $uuid], ['%s']);
		$deleted = $wpdb->delete(Schema::table('option_sets'), ['id' => $id], ['%d']);
		if (false === $deleted) {
			throw new RuntimeException('wooptions-pro_set_delete_failed');
		}
	}

	public function slug_exists(string $slug): bool {
		global $wpdb;
		$table = Schema::table('option_sets');
		return (bool) $wpdb->get_var($wpdb->prepare("SELECT 1 FROM {$table} WHERE slug = %s LIMIT 1", $slug));
	}

	/**
	 * @param array<string,mixed> $row Row.
	 * @return array<string,mixed>
	 */
	private function map_set(array $row): array {
		return [
			'id'                    => (int) $row['id'],
			'uuid'                  => (string) $row['uuid'],
			'title'                 => (string) $row['title'],
			'slug'                  => (string) $row['slug'],
			'status'                => (string) $row['status'],
			'draftRevisionId'       => null === $row['current_draft_revision_id'] ? null : (int) $row['current_draft_revision_id'],
			'publishedRevisionId'   => null === $row['current_published_revision_id'] ? null : (int) $row['current_published_revision_id'],
			'priority'              => (int) $row['priority'],
			'createdBy'             => (int) $row['created_by'],
			'updatedBy'             => (int) $row['updated_by'],
			'createdAtGmt'          => (string) $row['created_at_gmt'],
			'updatedAtGmt'          => (string) $row['updated_at_gmt'],
		];
	}

	/**
	 * @param array<string,mixed> $row Row.
	 * @return array<string,mixed>
	 */
	private function map_revision(array $row): array {
		$definition = CanonicalJson::decode_object((string) $row['definition_json']);
		$compiled   = null;
		if (! empty($row['compiled_json'])) {
			$compiled = CanonicalJson::decode_object((string) $row['compiled_json']);
		}
		return [
			'id'                => (int) $row['id'],
			'uuid'              => (string) $row['uuid'],
			'optionSetId'       => (int) $row['option_set_id'],
			'revisionNumber'    => (int) $row['revision_number'],
			'parentRevisionId'  => null === $row['parent_revision_id'] ? null : (int) $row['parent_revision_id'],
			'state'             => (string) $row['state'],
			'schemaVersion'     => (int) $row['schema_version'],
			'compilerVersion'   => (string) $row['compiler_version'],
			'definition'        => $definition,
			'compiled'          => $compiled,
			'contentHash'       => (string) $row['content_hash'],
			'validationSummary' => ! empty($row['validation_summary_json'])
				? CanonicalJson::decode_object((string) $row['validation_summary_json'])
				: [],
			'versionNote'       => (string) ($row['version_note'] ?? ''),
			'createdBy'         => (int) $row['created_by'],
			'createdAtGmt'      => (string) $row['created_at_gmt'],
			'publishedAtGmt'    => null === $row['published_at_gmt'] ? null : (string) $row['published_at_gmt'],
			'setPriority'       => isset($row['set_priority']) ? (int) $row['set_priority'] : null,
			'setUuid'           => isset($row['set_uuid']) ? (string) $row['set_uuid'] : null,
			'setTitle'          => isset($row['set_title']) ? (string) $row['set_title'] : null,
		];
	}
}
