<?php
/**
 * Private upload intents, completion, ownership, and cleanup.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Application;

use DateTimeImmutable;
use DateTimeZone;
use RuntimeException;
use WooOptionsPro\Bootstrap\Settings;
use WooOptionsPro\Domain\Support\Uuid;
use WooOptionsPro\Domain\Upload\UploadScanner;
use WooOptionsPro\Infrastructure\Persistence\UploadRepository;
use WooOptionsPro\Infrastructure\Storage\LocalPrivateStorage;

final class UploadService {
	private const MIME_BY_EXTENSION = [
		'jpg'  => ['image/jpeg'],
		'jpeg' => ['image/jpeg'],
		'png'  => ['image/png'],
		'webp' => ['image/webp'],
		'gif'  => ['image/gif'],
		'pdf'  => ['application/pdf'],
		'txt'  => ['text/plain'],
		'csv'  => ['text/plain', 'text/csv', 'application/csv'],
	];

	public function __construct(
		private readonly UploadRepository $repository,
		private readonly LocalPrivateStorage $storage,
		private readonly UploadScanner $scanner
	) {
	}

	/**
	 * @param array<string,mixed> $field Compiled file field.
	 * @return array<string,mixed>
	 */
	public function create_intent(
		int $product_id,
		int $variation_id,
		array $field,
		string $revision_uuid,
		int $owner_user_id,
		string $session_hash,
		string $row_uuid = ''
	): array {
		if ('file' !== ($field['type'] ?? '') || ! Uuid::is_valid((string) ($field['uuid'] ?? ''))) {
			throw new ValidationException('wooptions-pro_invalid_upload_field', [['code' => 'invalid_upload_field']]);
		}
		if ('' === $session_hash) {
			throw new ValidationException('wooptions-pro_upload_session_required', [['code' => 'session_required']]);
		}

		$uuid       = Uuid::v4();
		$expires_at = (new DateTimeImmutable('+15 minutes', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');
		$extensions = array_values(
			array_intersect(
				(array) Settings::get('upload_allowed_extensions', []),
				(array) (($field['allowedExtensions'] ?? []) ?: Settings::get('upload_allowed_extensions', []))
			)
		);
		if ([] === $extensions) {
			$extensions = (array) Settings::get('upload_allowed_extensions', ['jpg', 'png', 'pdf']);
		}
		$maximum_mb = min(
			(int) Settings::get('upload_max_file_mb', 5),
			max(1, (int) ($field['maxFileMb'] ?? Settings::get('upload_max_file_mb', 5)))
		);

		$this->repository->insert(
			[
				'uuid'          => $uuid,
				'ownerUserId'   => $owner_user_id,
				'sessionHash'   => $session_hash,
				'productId'     => $product_id,
				'variationId'   => max(0, $variation_id),
				'fieldUuid'     => (string) $field['uuid'],
				'rowUuid'       => Uuid::is_valid($row_uuid) ? $row_uuid : '',
				'revisionUuid'  => $revision_uuid,
				'expiresAtGmt'  => $expires_at,
			]
		);

		return [
			'opaqueId'          => $uuid,
			'expiresAtGmt'      => $expires_at,
			'allowedExtensions' => $extensions,
			'maximumBytes'      => $maximum_mb * 1024 * 1024,
		];
	}

	/**
	 * @param array<string,mixed> $file A normalized $_FILES item.
	 * @return array<string,mixed>
	 */
	public function complete(
		string $uuid,
		array $file,
		int $owner_user_id,
		string $session_hash,
		array $policy
	): array {
		$record = $this->owned_record($uuid, $owner_user_id, $session_hash);
		if ('intent' !== $record['state']) {
			throw new ConflictException('wooptions-pro_upload_not_pending', ['state' => $record['state']]);
		}
		if (strtotime((string) $record['expiresAtGmt'] . ' UTC') < time()) {
			$this->repository->update($uuid, ['state' => 'expired']);
			throw new ValidationException('wooptions-pro_upload_intent_expired', [['code' => 'upload_intent_expired']]);
		}

		$error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
		if (UPLOAD_ERR_OK !== $error || empty($file['tmp_name']) || empty($file['name'])) {
			throw new ValidationException('wooptions-pro_upload_transport_error', [['code' => 'upload_error', 'value' => $error]]);
		}

		$size      = (int) ($file['size'] ?? 0);
		$maximum   = min(
			(int) Settings::get('upload_max_file_mb', 5),
			max(1, (int) ($policy['maxFileMb'] ?? Settings::get('upload_max_file_mb', 5)))
		) * 1024 * 1024;
		$filename  = sanitize_file_name((string) $file['name']);
		$extension = strtolower((string) pathinfo($filename, PATHINFO_EXTENSION));
		$allowed   = array_values(
			array_intersect(
				(array) Settings::get('upload_allowed_extensions', []),
				(array) (($policy['allowedExtensions'] ?? []) ?: Settings::get('upload_allowed_extensions', []))
			)
		);

		if ($size < 1 || $size > $maximum) {
			throw new ValidationException('wooptions-pro_upload_size', [['code' => 'upload_size', 'maximumBytes' => $maximum]]);
		}
		if (! isset(self::MIME_BY_EXTENSION[$extension]) || ! in_array($extension, $allowed, true)) {
			throw new ValidationException('wooptions-pro_upload_extension', [['code' => 'upload_extension', 'extension' => $extension]]);
		}

		$finfo = new \finfo(FILEINFO_MIME_TYPE);
		$mime  = (string) $finfo->file((string) $file['tmp_name']);
		if (! in_array($mime, self::MIME_BY_EXTENSION[$extension], true)) {
			throw new ValidationException('wooptions-pro_upload_mime', [['code' => 'upload_mime', 'mime' => $mime]]);
		}

		if (str_starts_with($mime, 'image/')) {
			$dimensions = @getimagesize((string) $file['tmp_name']);
			if (false === $dimensions
				|| $dimensions[0] > 12000
				|| $dimensions[1] > 12000
				|| ($dimensions[0] * $dimensions[1]) > 40_000_000
			) {
				throw new ValidationException('wooptions-pro_upload_dimensions', [['code' => 'upload_dimensions']]);
			}
		}

		$this->repository->update($uuid, ['state' => 'quarantine']);
		$scan = $this->scanner->scan((string) $file['tmp_name'], $mime, $extension);
		$scan = apply_filters('wooptions-pro_upload_scan_result', $scan, $file['tmp_name'], $mime, $extension, $record);
		if (! is_array($scan) || empty($scan['accepted'])) {
			$this->repository->update($uuid, ['state' => 'rejected', 'scanner_result' => (string) ($scan['code'] ?? 'scanner_rejected')]);
			throw new ValidationException('wooptions-pro_upload_rejected', [['code' => 'upload_rejected']]);
		}

		$storage_key = bin2hex(random_bytes(32));
		$file_hash   = hash_file('sha256', (string) $file['tmp_name']);
		if (false === $file_hash) {
			throw new RuntimeException('wooptions-pro_upload_hash_failed');
		}
		$this->storage->move_uploaded_file((string) $file['tmp_name'], $storage_key);
		$this->repository->update(
			$uuid,
			[
				'original_filename' => $filename,
				'storage_key'       => $storage_key,
				'detected_mime'     => $mime,
				'extension'         => $extension,
				'byte_size'         => $size,
				'file_hash'         => $file_hash,
				'state'             => 'ready',
				'scanner_result'    => (string) ($scan['code'] ?? 'accepted'),
			]
		);
		$ready = $this->repository->find($uuid);
		return [
			'opaqueId' => $uuid,
			'name'     => $filename,
			'mime'     => $mime,
			'bytes'    => $size,
			'state'    => 'ready',
			'rowUuid'  => $ready['rowUuid'] ?? '',
		];
	}

	public function validate_reference(
		string $uuid,
		int $product_id,
		int $variation_id,
		string $field_uuid,
		string $revision_uuid,
		int $owner_user_id,
		string $session_hash,
		string $row_uuid = ''
	): array {
		$record = $this->owned_record($uuid, $owner_user_id, $session_hash);
		if (! in_array($record['state'], ['ready', 'attached'], true)
			|| $record['productId'] !== $product_id
			|| $record['variationId'] !== $variation_id
			|| $record['fieldUuid'] !== $field_uuid
			|| $record['revisionUuid'] !== $revision_uuid
			|| (string) $record['rowUuid'] !== $row_uuid
		) {
			throw new ValidationException('wooptions-pro_upload_reference_invalid', [['code' => 'upload_reference_invalid', 'fieldUuid' => $field_uuid]]);
		}
		return $record;
	}

	/**
	 * @param list<string> $references References.
	 */
	public function attach_to_cart(array $references, string $cart_key): void {
		foreach ($references as $reference) {
			$this->repository->update($reference, ['state' => 'attached', 'cart_key' => $cart_key]);
		}
	}

	/**
	 * @param list<string> $references References.
	 */
	public function attach_to_order(array $references, int $order_id): void {
		$retention_days = max(1, (int) Settings::get('saved_config_expiry_days', 90));
		$expires        = (new DateTimeImmutable('+' . $retention_days . ' days', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');
		foreach ($references as $reference) {
			$this->repository->update($reference, ['state' => 'attached', 'order_id' => $order_id, 'expires_at_gmt' => $expires]);
		}
	}

	public function cleanup(int $limit = 100): int {
		$count = 0;
		foreach ($this->repository->expired($limit) as $record) {
			if ('' !== $record['storageKey']) {
				$this->storage->delete((string) $record['storageKey']);
			}
			$this->repository->update((string) $record['uuid'], ['state' => 'deleted']);
			++$count;
		}

		$unplaced_days = (int) Settings::get('cleanup_unplaced_upload_days', 0);
		if ($unplaced_days > 0) {
			$cutoff = (new DateTimeImmutable("-{$unplaced_days} days", new DateTimeZone('UTC')))->format('Y-m-d H:i:s');
			foreach ($this->repository->unplaced_older_than($cutoff, $limit) as $record) {
				if ('' !== $record['storageKey']) {
					$this->storage->delete((string) $record['storageKey']);
				}
				$this->repository->update((string) $record['uuid'], ['state' => 'deleted']);
				++$count;
			}
		}

		$placed_days = (int) Settings::get('cleanup_placed_upload_days', 0);
		if ($placed_days > 0) {
			$cutoff = (new DateTimeImmutable("-{$placed_days} days", new DateTimeZone('UTC')))->format('Y-m-d H:i:s');
			foreach ($this->repository->placed_older_than($cutoff, $limit) as $record) {
				if ('' !== $record['storageKey']) {
					$this->storage->delete((string) $record['storageKey']);
				}
				$this->repository->update((string) $record['uuid'], ['state' => 'deleted']);
				++$count;
			}
		}

		$completed_days = (int) Settings::get('cleanup_completed_upload_days', 0);
		if ($completed_days > 0) {
			$cutoff = (new DateTimeImmutable("-{$completed_days} days", new DateTimeZone('UTC')))->format('Y-m-d H:i:s');
			foreach ($this->repository->completed_orders_older_than($cutoff, $limit) as $record) {
				if ('' !== $record['storageKey']) {
					$this->storage->delete((string) $record['storageKey']);
				}
				$this->repository->update((string) $record['uuid'], ['state' => 'deleted']);
				++$count;
			}
		}

		return $count;
	}

	public function record_for_download(string $uuid, int $user_id, string $session_hash): array {
		$record = $this->repository->find($uuid);
		if (! $record || 'deleted' === $record['state']) {
			throw new NotFoundException('wooptions-pro_upload_not_found');
		}
		$administrator = current_user_can('manage_wooptions-pro_uploads');
		$owner         = ($user_id > 0 && $record['ownerUserId'] === $user_id)
			|| ('' !== $session_hash && hash_equals((string) $record['sessionHash'], $session_hash));
		if (! $administrator && ! $owner) {
			throw new NotFoundException('wooptions-pro_upload_not_found');
		}
		return $record;
	}

	/**
	 * Returns only the persisted intent metadata after enforcing ownership.
	 *
	 * @return array<string,mixed>
	 */
	public function intent_record(string $uuid, int $owner_user_id, string $session_hash): array {
		return $this->owned_record($uuid, $owner_user_id, $session_hash);
	}

	private function owned_record(string $uuid, int $owner_user_id, string $session_hash): array {
		$record = $this->repository->find($uuid);
		if (! $record) {
			throw new NotFoundException('wooptions-pro_upload_not_found');
		}
		$owned = ($owner_user_id > 0 && $record['ownerUserId'] === $owner_user_id)
			|| ('' !== $session_hash && hash_equals((string) $record['sessionHash'], $session_hash));
		if (! $owned) {
			throw new NotFoundException('wooptions-pro_upload_not_found');
		}
		return $record;
	}
}
