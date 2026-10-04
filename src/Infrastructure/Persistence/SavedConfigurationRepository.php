<?php
/**
 * Saved configuration persistence.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Infrastructure\Persistence;

use RuntimeException;
use WooptionsFic\Domain\Support\CanonicalJson;

final class SavedConfigurationRepository {
	/**
	 * @param array<string,mixed> $data Configuration data.
	 */
	public function insert(array $data): void {
		global $wpdb;
		$now = current_time('mysql', true);
		$ok  = $wpdb->insert(
			Schema::table('saved_configs'),
			[
				'uuid'                  => (string) $data['uuid'],
				'owner_user_id'         => $data['ownerUserId'] ?: null,
				'session_hash'          => (string) $data['sessionHash'],
				'product_id'            => (int) $data['productId'],
				'variation_id'          => (int) ($data['variationId'] ?? 0),
				'revision_uuid'         => (string) $data['revisionUuid'],
				'revision_hash'         => (string) $data['revisionHash'],
				'name'                  => (string) $data['name'],
				'selection_json'        => CanonicalJson::encode($data['selection']),
				'preview_json'          => CanonicalJson::encode($data['preview'] ?? []),
				'share_token_hash'      => null,
				'share_expires_at_gmt'  => null,
				'share_revoked'         => 0,
				'created_at_gmt'        => $now,
				'updated_at_gmt'        => $now,
				'last_used_at_gmt'      => null,
			],
			['%s', '%d', '%s', '%d', '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%s', '%s', '%s']
		);
		if (false === $ok) {
			throw new RuntimeException('wooptionsfic_saved_config_insert_failed');
		}
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public function find(string $uuid): ?array {
		global $wpdb;
		$table = Schema::table('saved_configs');
		$row   = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE uuid = %s LIMIT 1", $uuid), ARRAY_A);
		return is_array($row) ? $this->map($row) : null;
	}

	/**
	 * @return list<array<string,mixed>>
	 */
	public function list_for_owner(int $owner_user_id, string $session_hash, int $limit = 50): array {
		global $wpdb;
		$table = Schema::table('saved_configs');
		if ($owner_user_id > 0) {
			$sql = $wpdb->prepare(
				"SELECT * FROM {$table} WHERE owner_user_id = %d ORDER BY updated_at_gmt DESC LIMIT %d",
				$owner_user_id,
				max(1, min(100, $limit))
			);
		} else {
			$sql = $wpdb->prepare(
				"SELECT * FROM {$table} WHERE owner_user_id IS NULL AND session_hash = %s ORDER BY updated_at_gmt DESC LIMIT %d",
				$session_hash,
				max(1, min(20, $limit))
			);
		}
		$rows = $wpdb->get_results($sql, ARRAY_A);
		return array_map([$this, 'map'], is_array($rows) ? $rows : []);
	}

	/**
	 * @param array<string,mixed> $changes Changes.
	 */
	public function update(string $uuid, array $changes): void {
		global $wpdb;
		$allowed = [
			'name'                 => '%s',
			'selection_json'       => '%s',
			'preview_json'         => '%s',
			'revision_uuid'        => '%s',
			'revision_hash'        => '%s',
			'share_token_hash'     => '%s',
			'share_expires_at_gmt' => '%s',
			'share_revoked'        => '%d',
			'last_used_at_gmt'     => '%s',
		];
		$data   = [];
		$formats= [];
		foreach ($changes as $key => $value) {
			if (! isset($allowed[$key])) {
				continue;
			}
			if (in_array($key, ['selection_json', 'preview_json'], true) && is_array($value)) {
				$value = CanonicalJson::encode($value);
			}
			$data[$key] = $value;
			$formats[]  = $allowed[$key];
		}
		$data['updated_at_gmt'] = current_time('mysql', true);
		$formats[]              = '%s';
		if (false === $wpdb->update(Schema::table('saved_configs'), $data, ['uuid' => $uuid], $formats, ['%s'])) {
			throw new RuntimeException('wooptionsfic_saved_config_update_failed');
		}
	}

	public function delete(string $uuid): void {
		global $wpdb;
		if (false === $wpdb->delete(Schema::table('saved_configs'), ['uuid' => $uuid], ['%s'])) {
			throw new RuntimeException('wooptionsfic_saved_config_delete_failed');
		}
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public function find_by_share_hash(string $hash): ?array {
		global $wpdb;
		$table = Schema::table('saved_configs');
		$row   = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$table}
				 WHERE share_token_hash = %s AND share_revoked = 0
				 AND share_expires_at_gmt >= %s LIMIT 1",
				$hash,
				current_time('mysql', true)
			),
			ARRAY_A
		);
		return is_array($row) ? $this->map($row) : null;
	}

	/**
	 * @param array<string,mixed> $row Row.
	 * @return array<string,mixed>
	 */
	private function map(array $row): array {
		$selection = json_decode((string) $row['selection_json'], true);
		$preview   = json_decode((string) ($row['preview_json'] ?? '{}'), true);
		return [
			'id'                => (int) $row['id'],
			'uuid'              => (string) $row['uuid'],
			'ownerUserId'       => null === $row['owner_user_id'] ? 0 : (int) $row['owner_user_id'],
			'sessionHash'       => (string) $row['session_hash'],
			'productId'         => (int) $row['product_id'],
			'variationId'       => (int) $row['variation_id'],
			'revisionUuid'      => (string) $row['revision_uuid'],
			'revisionHash'      => (string) $row['revision_hash'],
			'name'              => (string) $row['name'],
			'selection'         => is_array($selection) ? $selection : [],
			'preview'           => is_array($preview) ? $preview : [],
			'shareTokenHash'    => (string) ($row['share_token_hash'] ?? ''),
			'shareExpiresAtGmt' => null === $row['share_expires_at_gmt'] ? null : (string) $row['share_expires_at_gmt'],
			'shareRevoked'      => (bool) $row['share_revoked'],
			'createdAtGmt'      => (string) $row['created_at_gmt'],
			'updatedAtGmt'      => (string) $row['updated_at_gmt'],
			'lastUsedAtGmt'     => null === $row['last_used_at_gmt'] ? null : (string) $row['last_used_at_gmt'],
		];
	}
}
