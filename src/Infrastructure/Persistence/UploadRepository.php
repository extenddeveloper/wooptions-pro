<?php
/**
 * Upload intent/reference persistence.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Infrastructure\Persistence;

use RuntimeException;

final class UploadRepository {
	/**
	 * @param array<string,mixed> $data Intent data.
	 */
	public function insert(array $data): void {
		global $wpdb;
		$now = current_time('mysql', true);
		$ok  = $wpdb->insert(
			Schema::table('uploads'),
			[
				'uuid'              => (string) $data['uuid'],
				'owner_user_id'     => $data['ownerUserId'] ?: null,
				'session_hash'      => (string) $data['sessionHash'],
				'product_id'        => (int) $data['productId'],
				'variation_id'      => (int) ($data['variationId'] ?? 0),
				'field_uuid'        => (string) $data['fieldUuid'],
				'row_uuid'          => $data['rowUuid'] ?: null,
				'revision_uuid'     => (string) $data['revisionUuid'],
				'state'             => 'intent',
				'expires_at_gmt'    => (string) $data['expiresAtGmt'],
				'created_at_gmt'    => $now,
				'updated_at_gmt'    => $now,
			],
			['%s', '%d', '%s', '%d', '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s']
		);
		if (false === $ok) {
			throw new RuntimeException('wooptionsfic_upload_intent_insert_failed');
		}
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public function find(string $uuid): ?array {
		global $wpdb;
		$table = Schema::table('uploads');
		$row   = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE uuid = %s LIMIT 1", $uuid), ARRAY_A);
		return is_array($row) ? $this->map($row) : null;
	}

	/**
	 * @param array<string,mixed> $changes Changes.
	 */
	public function update(string $uuid, array $changes): void {
		global $wpdb;
		$allowed = [
			'original_filename' => '%s',
			'storage_key'       => '%s',
			'detected_mime'     => '%s',
			'extension'         => '%s',
			'byte_size'         => '%d',
			'file_hash'         => '%s',
			'state'             => '%s',
			'scanner_result'    => '%s',
			'cart_key'          => '%s',
			'order_id'          => '%d',
			'expires_at_gmt'    => '%s',
		];
		$data   = [];
		$formats= [];
		foreach ($changes as $key => $value) {
			if (isset($allowed[$key])) {
				$data[$key] = $value;
				$formats[]  = $allowed[$key];
			}
		}
		$data['updated_at_gmt'] = current_time('mysql', true);
		$formats[]              = '%s';
		if (false === $wpdb->update(Schema::table('uploads'), $data, ['uuid' => $uuid], $formats, ['%s'])) {
			throw new RuntimeException('wooptionsfic_upload_update_failed');
		}
	}

	/**
	 * @return list<array<string,mixed>>
	 */
	public function expired(int $limit = 100): array {
		global $wpdb;
		$table = Schema::table('uploads');
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table}
				 WHERE state IN ('intent','quarantine','ready','rejected','expired')
				 AND expires_at_gmt < %s
				 ORDER BY expires_at_gmt ASC LIMIT %d",
				current_time('mysql', true),
				max(1, min(500, $limit))
			),
			ARRAY_A
		);
		return array_map([$this, 'map'], is_array($rows) ? $rows : []);
	}

	/**
	 * @return list<array<string,mixed>>
	 */
	public function unplaced_older_than(string $cutoff_gmt, int $limit = 100): array {
		global $wpdb;
		$table = Schema::table('uploads');
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table}
				 WHERE (order_id IS NULL OR order_id = 0)
				   AND state IN ('intent', 'quarantine', 'ready', 'attached', 'rejected', 'expired')
				   AND created_at_gmt < %s
				 ORDER BY created_at_gmt ASC LIMIT %d",
				$cutoff_gmt,
				max(1, min(500, $limit))
			),
			ARRAY_A
		);
		return array_map([$this, 'map'], is_array($rows) ? $rows : []);
	}

	/**
	 * @return list<array<string,mixed>>
	 */
	public function placed_older_than(string $cutoff_gmt, int $limit = 100): array {
		global $wpdb;
		$table = Schema::table('uploads');
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table}
				 WHERE order_id > 0
				   AND state IN ('ready', 'attached')
				   AND created_at_gmt < %s
				 ORDER BY created_at_gmt ASC LIMIT %d",
				$cutoff_gmt,
				max(1, min(500, $limit))
			),
			ARRAY_A
		);
		return array_map([$this, 'map'], is_array($rows) ? $rows : []);
	}

	/**
	 * @return list<array<string,mixed>>
	 */
	public function completed_orders_older_than(string $cutoff_gmt, int $limit = 100): array {
		global $wpdb;
		$table = Schema::table('uploads');
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table}
				 WHERE order_id > 0
				   AND state IN ('ready', 'attached')
				   AND created_at_gmt < %s
				 ORDER BY created_at_gmt ASC LIMIT %d",
				$cutoff_gmt,
				max(1, min(500, $limit * 2))
			),
			ARRAY_A
		);
		$completed = [];
		foreach ((is_array($rows) ? $rows : []) as $row) {
			$order = function_exists('wc_get_order') ? wc_get_order((int) $row['order_id']) : null;
			if ($order && 'completed' === $order->get_status()) {
				$completed[] = $this->map($row);
				if (count($completed) >= $limit) {
					break;
				}
			}
		}
		return $completed;
	}

	/**
	 * @param array<string,mixed> $row Row.
	 * @return array<string,mixed>
	 */
	private function map(array $row): array {
		return [
			'id'               => (int) $row['id'],
			'uuid'             => (string) $row['uuid'],
			'ownerUserId'      => null === $row['owner_user_id'] ? 0 : (int) $row['owner_user_id'],
			'sessionHash'      => (string) $row['session_hash'],
			'productId'        => (int) $row['product_id'],
			'variationId'      => (int) ($row['variation_id'] ?? 0),
			'fieldUuid'        => (string) $row['field_uuid'],
			'rowUuid'          => null === $row['row_uuid'] ? '' : (string) $row['row_uuid'],
			'revisionUuid'     => (string) $row['revision_uuid'],
			'originalFilename' => (string) ($row['original_filename'] ?? ''),
			'storageKey'       => (string) ($row['storage_key'] ?? ''),
			'detectedMime'     => (string) ($row['detected_mime'] ?? ''),
			'extension'        => (string) ($row['extension'] ?? ''),
			'byteSize'         => (int) $row['byte_size'],
			'fileHash'         => (string) ($row['file_hash'] ?? ''),
			'state'            => (string) $row['state'],
			'scannerResult'    => (string) ($row['scanner_result'] ?? ''),
			'cartKey'          => (string) ($row['cart_key'] ?? ''),
			'orderId'          => null === $row['order_id'] ? 0 : (int) $row['order_id'],
			'expiresAtGmt'     => (string) $row['expires_at_gmt'],
			'createdAtGmt'     => (string) $row['created_at_gmt'],
			'updatedAtGmt'     => (string) $row['updated_at_gmt'],
		];
	}
}
