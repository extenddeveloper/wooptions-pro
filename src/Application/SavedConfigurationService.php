<?php
/**
 * Saved and shareable configuration use cases.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Application;

use DateTimeImmutable;
use DateTimeZone;
use WooOptionsPro\Bootstrap\Settings;
use WooOptionsPro\Domain\Support\Uuid;
use WooOptionsPro\Infrastructure\Persistence\SavedConfigurationRepository;

final class SavedConfigurationService {
	public function __construct(private readonly SavedConfigurationRepository $repository) {
	}

	/**
	 * @param array<string,mixed> $selection Normalized selection.
	 * @param array<string,mixed> $preview Preview state.
	 * @return array<string,mixed>
	 */
	public function save(
		int $owner_user_id,
		string $session_hash,
		int $product_id,
		int $variation_id,
		string $revision_uuid,
		string $revision_hash,
		string $name,
		array $selection,
		array $preview = []
	): array {
		if ($owner_user_id <= 0 && '' === $session_hash) {
			throw new ValidationException('wooptions-pro_saved_config_session_required', [['code' => 'session_required']]);
		}
		$uuid = Uuid::v4();
		$this->repository->insert(
			[
				'uuid'         => $uuid,
				'ownerUserId'  => $owner_user_id,
				'sessionHash'  => $session_hash,
				'productId'    => $product_id,
				'variationId'  => $variation_id,
				'revisionUuid' => $revision_uuid,
				'revisionHash' => $revision_hash,
				'name'         => $this->name($name),
				'selection'    => $selection,
				'preview'      => $this->sanitize_preview($preview),
			]
		);
		return $this->public_record($this->owned($uuid, $owner_user_id, $session_hash), true);
	}

	/**
	 * @return list<array<string,mixed>>
	 */
	public function list(int $owner_user_id, string $session_hash): array {
		return array_map([$this, 'public_record'], $this->repository->list_for_owner($owner_user_id, $session_hash));
	}

	/**
	 * @return array<string,mixed>
	 */
	public function get(string $uuid, int $owner_user_id, string $session_hash): array {
		return $this->public_record($this->owned($uuid, $owner_user_id, $session_hash), true);
	}

	public function rename(string $uuid, string $name, int $owner_user_id, string $session_hash): array {
		$this->owned($uuid, $owner_user_id, $session_hash);
		$this->repository->update($uuid, ['name' => $this->name($name)]);
		return $this->public_record($this->owned($uuid, $owner_user_id, $session_hash));
	}

	public function delete(string $uuid, int $owner_user_id, string $session_hash): void {
		$this->owned($uuid, $owner_user_id, $session_hash);
		$this->repository->delete($uuid);
	}

	/**
	 * @return array{token:string,expiresAtGmt:string,configuration:array<string,mixed>}
	 */
	public function share(string $uuid, int $owner_user_id, string $session_hash): array {
		if ($owner_user_id <= 0 && '' === $session_hash) {
			throw new ValidationException('wooptions-pro_share_session_required', [['code' => 'session_required']]);
		}
		$record = $this->owned($uuid, $owner_user_id, $session_hash);
		$token  = $this->base64url(random_bytes(32));
		$days   = max(1, min(365, (int) Settings::get('share_link_expiry_days', 30)));
		$expiry = (new DateTimeImmutable('+' . $days . ' days', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');
		$this->repository->update(
			$uuid,
			[
				'share_token_hash'     => hash('sha256', $token),
				'share_expires_at_gmt' => $expiry,
				'share_revoked'        => 0,
			]
		);
		return ['token' => $token, 'expiresAtGmt' => $expiry, 'configuration' => $this->public_record($record)];
	}

	public function revoke_share(string $uuid, int $owner_user_id, string $session_hash): void {
		$this->owned($uuid, $owner_user_id, $session_hash);
		$this->repository->update($uuid, ['share_revoked' => 1]);
	}

	/**
	 * @return array<string,mixed>
	 */
	public function load_shared(string $token): array {
		if (strlen($token) < 32 || strlen($token) > 128) {
			throw new NotFoundException('wooptions-pro_shared_config_not_found');
		}
		$record = $this->repository->find_by_share_hash(hash('sha256', $token));
		if (! $record || ! hash_equals((string) $record['shareTokenHash'], hash('sha256', $token))) {
			throw new NotFoundException('wooptions-pro_shared_config_not_found');
		}
		$this->repository->update((string) $record['uuid'], ['last_used_at_gmt' => current_time('mysql', true)]);
		return $this->public_record($record, true);
	}

	/**
	 * @return array<string,mixed>
	 */
	public function owned(string $uuid, int $owner_user_id, string $session_hash): array {
		$record = $this->repository->find($uuid);
		if (! $record) {
			throw new NotFoundException('wooptions-pro_saved_config_not_found');
		}
		$owned = ($owner_user_id > 0 && $record['ownerUserId'] === $owner_user_id)
			|| ($owner_user_id <= 0 && '' !== $session_hash && hash_equals((string) $record['sessionHash'], $session_hash));
		if (! $owned) {
			throw new NotFoundException('wooptions-pro_saved_config_not_found');
		}
		return $record;
	}

	/**
	 * @param array<string,mixed> $record Record.
	 * @return array<string,mixed>
	 */
	private function public_record(array $record, bool $include_selection = false): array {
		$output = [
			'uuid'          => $record['uuid'],
			'name'          => $record['name'],
			'productId'     => $record['productId'],
			'variationId'   => $record['variationId'],
			'revisionUuid'  => $record['revisionUuid'],
			'revisionHash'  => $record['revisionHash'],
			'createdAtGmt'  => $record['createdAtGmt'],
			'updatedAtGmt'  => $record['updatedAtGmt'],
			'shareExpiresAtGmt' => $record['shareExpiresAtGmt'],
		];
		if ($include_selection) {
			$output['selection'] = $record['selection'];
			$output['preview']   = $record['preview'];
		}
		return $output;
	}

	private function name(string $name): string {
		$name = trim(wp_strip_all_tags($name));
		$name = function_exists('mb_substr') ? (string) mb_substr($name, 0, 191) : substr($name, 0, 191);
		return '' !== $name ? $name : __('My configuration', 'wooptions-pro');
	}

	/**
	 * @param array<string,mixed> $preview Preview.
	 * @return array<string,mixed>
	 */
	private function sanitize_preview(array $preview): array {
		$allowed = [];
		foreach (['device', 'zoom', 'activeLayer'] as $key) {
			if (isset($preview[$key]) && is_scalar($preview[$key])) {
				$allowed[$key] = is_string($preview[$key])
					? sanitize_text_field((string) $preview[$key])
					: $preview[$key];
			}
		}
		return $allowed;
	}

	private function base64url(string $bytes): string {
		return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
	}
}
