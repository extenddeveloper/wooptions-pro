<?php
/**
 * Immutable option-set application service.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Application;

use WooOptionsPro\Domain\Definition\Compiler;
use WooOptionsPro\Domain\Support\Uuid;
use WooOptionsPro\Infrastructure\Persistence\OptionSetRepository;
use WooOptionsPro\Infrastructure\Persistence\Transaction;

final class OptionSetService {
	public function __construct(
		private readonly OptionSetRepository $repository,
		private readonly Compiler $compiler,
		private readonly Transaction $transaction
	) {
	}

	/**
	 * @param array<string,mixed> $arguments Query arguments.
	 * @return array{items:list<array<string,mixed>>,total:int,page:int,perPage:int}
	 */
	public function list(array $arguments = []): array {
		$result = $this->repository->list($arguments);
		$result['items'] = array_map(function (array $set): array {
			$revision_id = $set['draftRevisionId'] ?? $set['publishedRevisionId'] ?? null;
			$revision = $revision_id ? $this->repository->find_revision_by_id((int) $revision_id) : null;
			$set['fieldCount'] = $revision ? count((array) ($revision['definition']['fields'] ?? [])) : 0;
			return $set;
		}, (array) ($result['items'] ?? []));
		return $result;
	}

	/**
	 * @return array<string,mixed>
	 */
	public function create(string $title, int $user_id): array {
		$title   = $this->title($title);
		$set_uuid= Uuid::v4();
		$slug    = $this->unique_slug($title, $set_uuid);

		return $this->transaction->run(function () use ($title, $user_id, $set_uuid, $slug): array {
			$set_id     = $this->repository->insert_set(
				['uuid' => $set_uuid, 'title' => $title, 'slug' => $slug, 'userId' => $user_id]
			);
			$definition = $this->compiler->empty_definition($title, $set_uuid);
			$compiled   = $this->compiler->compile($definition);
			$revision_id= $this->repository->insert_revision(
				[
					'uuid'              => $compiled['definition']['revisionUuid'],
					'optionSetId'       => $set_id,
					'revisionNumber'    => 1,
					'parentRevisionId'  => null,
					'state'             => 'draft',
					'schemaVersion'     => Compiler::SCHEMA_VERSION,
					'compilerVersion'   => Compiler::COMPILER_VERSION,
					'definition'        => $compiled['definition'],
					'compiled'          => $compiled['valid'] ? $compiled['compiled'] : null,
					'contentHash'       => $compiled['contentHash'],
					'validationSummary' => ['valid' => $compiled['valid'], 'errors' => $compiled['errors'], 'warnings' => $compiled['warnings']],
					'versionNote'       => 'Initial draft',
					'userId'            => $user_id,
				]
			);
			$this->repository->update_set(
				$set_id,
				['current_draft_revision_id' => $revision_id, 'updated_by' => $user_id]
			);
			return $this->get($set_uuid);
		});
	}

	/**
	 * @return array<string,mixed>
	 */
	public function get(string $uuid): array {
		$set = $this->repository->find_set($uuid);
		if (! $set) {
			throw new NotFoundException('wooptions-pro_set_not_found');
		}
		$current_id = $set['draftRevisionId'] ?? $set['publishedRevisionId'];
		$revision   = $current_id ? $this->repository->find_revision_by_id((int) $current_id) : null;
		$published  = $set['publishedRevisionId'] ? $this->repository->find_revision_by_id((int) $set['publishedRevisionId']) : null;
		$set['currentRevision']   = $revision;
		$set['publishedRevision'] = $published;
		return $set;
	}

	/**
	 * @param array<string,mixed> $definition Definition.
	 * @return array<string,mixed>
	 */
	public function save_draft(
		string $uuid,
		array $definition,
		string $expected_hash,
		string $version_note,
		int $user_id
	): array {
		$set = $this->repository->find_set($uuid);
		if (! $set) {
			throw new NotFoundException('wooptions-pro_set_not_found');
		}

		$parent_id = $set['draftRevisionId'] ?? $set['publishedRevisionId'];
		$parent    = $parent_id ? $this->repository->find_revision_by_id((int) $parent_id) : null;
		if ('' !== $expected_hash && $parent && $parent['contentHash'] !== $expected_hash) {
			throw new ConflictException(
				'wooptions-pro_revision_conflict',
				[
					'currentHash'         => $parent['contentHash'],
					'currentRevisionUuid' => $parent['uuid'],
					'updatedAtGmt'        => $set['updatedAtGmt'],
				]
			);
		}

		$definition['setUuid']      = $uuid;
		$definition['revisionUuid'] = Uuid::v4();
		$definition['title']        = $this->title((string) ($definition['title'] ?? $set['title']));
		$result                     = $this->compiler->compile($definition);

		return $this->transaction->run(function () use ($set, $parent_id, $result, $version_note, $user_id): array {
			$revision_id = $this->repository->insert_revision(
				[
					'uuid'              => $result['definition']['revisionUuid'],
					'optionSetId'       => $set['id'],
					'revisionNumber'    => $this->repository->next_revision_number((int) $set['id']),
					'parentRevisionId'  => $parent_id,
					'state'             => 'draft',
					'schemaVersion'     => Compiler::SCHEMA_VERSION,
					'compilerVersion'   => Compiler::COMPILER_VERSION,
					'definition'        => $result['definition'],
					'compiled'          => $result['valid'] ? $result['compiled'] : null,
					'contentHash'       => $result['contentHash'],
					'validationSummary' => ['valid' => $result['valid'], 'errors' => $result['errors'], 'warnings' => $result['warnings']],
					'versionNote'       => $this->note($version_note),
					'userId'            => $user_id,
				]
			);
			$this->repository->update_set(
				(int) $set['id'],
				[
					'title'                     => $result['definition']['title'],
					'current_draft_revision_id' => $revision_id,
					'updated_by'                => $user_id,
				]
			);
			return $this->get((string) $set['uuid']);
		});
	}

	/**
	 * @return array<string,mixed>
	 */
	public function publish(string $uuid, string $expected_hash, string $version_note, int $user_id): array {
		$set = $this->get($uuid);
		$draft = $set['currentRevision'];
		if (! is_array($draft)) {
			throw new ValidationException('wooptions-pro_no_draft_to_publish', [['code' => 'no_draft']]);
		}
		if ('' !== $expected_hash && $draft['contentHash'] !== $expected_hash) {
			throw new ConflictException('wooptions-pro_revision_conflict', ['currentHash' => $draft['contentHash']]);
		}

		$definition                 = $draft['definition'];
		$definition['revisionUuid'] = Uuid::v4();
		$result                     = $this->compiler->compile($definition);
		if (! $result['valid']) {
			throw new ValidationException('wooptions-pro_publish_preflight_failed', $result['errors']);
		}

		return $this->transaction->run(function () use ($set, $draft, $result, $version_note, $user_id): array {
			$published_id = $this->repository->insert_revision(
				[
					'uuid'              => $result['definition']['revisionUuid'],
					'optionSetId'       => $set['id'],
					'revisionNumber'    => $this->repository->next_revision_number((int) $set['id']),
					'parentRevisionId'  => $draft['id'],
					'state'             => 'published',
					'schemaVersion'     => Compiler::SCHEMA_VERSION,
					'compilerVersion'   => Compiler::COMPILER_VERSION,
					'definition'        => $result['definition'],
					'compiled'          => $result['compiled'],
					'contentHash'       => $result['contentHash'],
					'validationSummary' => ['valid' => true, 'errors' => [], 'warnings' => $result['warnings']],
					'versionNote'       => $this->note($version_note ?: 'Published'),
					'userId'            => $user_id,
				]
			);
			$this->repository->update_set(
				(int) $set['id'],
				[
					'current_published_revision_id' => $published_id,
					'current_draft_revision_id'     => null,
					'updated_by'                    => $user_id,
				]
			);
			update_option(
				'wooptions-pro_revision_generation',
				(int) get_option('wooptions-pro_revision_generation', 1) + 1,
				false
			);
			return $this->get((string) $set['uuid']);
		});
	}

	/**
	 * @return array<string,mixed>
	 */
	public function rollback(string $set_uuid, string $revision_uuid, int $user_id): array {
		$set      = $this->repository->find_set($set_uuid);
		$revision = $this->repository->find_revision($revision_uuid);
		if (! $set || ! $revision || (int) $revision['optionSetId'] !== (int) $set['id']) {
			throw new NotFoundException('wooptions-pro_revision_not_found');
		}

		$definition                 = $revision['definition'];
		$definition['revisionUuid'] = Uuid::v4();
		$result                     = $this->compiler->compile($definition);

		return $this->transaction->run(function () use ($set, $revision, $result, $user_id): array {
			$id = $this->repository->insert_revision(
				[
					'uuid'              => $result['definition']['revisionUuid'],
					'optionSetId'       => $set['id'],
					'revisionNumber'    => $this->repository->next_revision_number((int) $set['id']),
					'parentRevisionId'  => $revision['id'],
					'state'             => 'draft',
					'schemaVersion'     => Compiler::SCHEMA_VERSION,
					'compilerVersion'   => Compiler::COMPILER_VERSION,
					'definition'        => $result['definition'],
					'compiled'          => $result['valid'] ? $result['compiled'] : null,
					'contentHash'       => $result['contentHash'],
					'validationSummary' => ['valid' => $result['valid'], 'errors' => $result['errors'], 'warnings' => $result['warnings']],
					'versionNote'       => 'Rollback copy of revision ' . $revision['revisionNumber'],
					'userId'            => $user_id,
				]
			);
			$this->repository->update_set((int) $set['id'], ['current_draft_revision_id' => $id, 'updated_by' => $user_id]);
			return $this->get((string) $set['uuid']);
		});
	}

	/**
	 * @return array<string,mixed>
	 */
	public function duplicate(string $uuid, int $user_id): array {
		$source     = $this->get($uuid);
		$revision   = $source['currentRevision'];
		$copy       = $this->create($source['title'] . ' — Copy', $user_id);
		$definition = $this->remap_definition((array) $revision['definition'], (string) $copy['uuid']);
		return $this->save_draft(
			(string) $copy['uuid'],
			$definition,
			(string) $copy['currentRevision']['contentHash'],
			'Duplicated from ' . $source['uuid'],
			$user_id
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	public function import(array $definition, string $title, int $user_id): array {
		$set        = $this->create($title ?: (string) ($definition['title'] ?? 'Imported option set'), $user_id);
		$definition = $this->remap_definition($definition, (string) $set['uuid']);
		return $this->save_draft(
			(string) $set['uuid'],
			$definition,
			(string) $set['currentRevision']['contentHash'],
			'Imported definition',
			$user_id
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	public function export(string $uuid): array {
		$set = $this->get($uuid);
		return [
			'exportSchemaVersion' => 1,
			'pluginVersion'       => WOOPTIONS_PRO_VERSION,
			'exportedAtGmt'       => gmdate('Y-m-d\TH:i:s\Z'),
			'optionSet'           => [
				'title'      => $set['title'],
				'definition' => $set['currentRevision']['definition'],
			],
		];
	}

	/**
	 * @return list<array<string,mixed>>
	 */
	public function revisions(string $uuid): array {
		$set = $this->repository->find_set($uuid);
		if (! $set) {
			throw new NotFoundException('wooptions-pro_set_not_found');
		}
		return $this->repository->revisions((int) $set['id']);
	}

	/**
	 * @return array<string,mixed>
	 */
	public function revision(string $set_uuid, string $revision_uuid): array {
		$set      = $this->repository->find_set($set_uuid);
		$revision = $this->repository->find_revision($revision_uuid);
		if (! $set || ! $revision || (int) $revision['optionSetId'] !== (int) $set['id']) {
			throw new NotFoundException('wooptions-pro_revision_not_found');
		}
		return $revision;
	}

	/**
	 * @return array<string,mixed>
	 */
	public function archive(string $uuid, int $user_id): array {
		return $this->set_status($uuid, 'archived', $user_id);
	}

	public function restore(string $uuid, int $user_id): array {
		return $this->set_status($uuid, 'active', $user_id);
	}

	public function deactivate(string $uuid, int $user_id): array {
		return $this->set_status($uuid, 'inactive', $user_id);
	}

	public function activate(string $uuid, int $user_id): array {
		return $this->set_status($uuid, 'active', $user_id);
	}

	public function delete_permanently(string $uuid): array {
		$set = $this->repository->find_set($uuid);
		if (! $set) {
			throw new NotFoundException('wooptions-pro_set_not_found');
		}
		$this->transaction->run(function () use ($set): void {
			$this->repository->delete_set((int) $set['id'], (string) $set['uuid']);
		});
		update_option(
			'wooptions-pro_revision_generation',
			(int) get_option('wooptions-pro_revision_generation', 1) + 1,
			false
		);
		return ['deleted' => true, 'uuid' => $uuid];
	}

	private function set_status(string $uuid, string $status, int $user_id): array {
		$set = $this->repository->find_set($uuid);
		if (! $set) {
			throw new NotFoundException('wooptions-pro_set_not_found');
		}
		if (! in_array($status, ['active', 'inactive', 'archived'], true)) {
			throw new ValidationException('wooptions-pro_set_status_invalid', [['code' => 'status_invalid']]);
		}
		$this->repository->update_set((int) $set['id'], ['status' => $status, 'updated_by' => $user_id]);
		update_option(
			'wooptions-pro_revision_generation',
			(int) get_option('wooptions-pro_revision_generation', 1) + 1,
			false
		);
		return $this->get($uuid);
	}

	/**
	 * @return list<array{path:string,before:mixed,after:mixed}>
	 */
	public function diff(string $set_uuid, string $from_uuid, string $to_uuid): array {
		$from = $this->revision($set_uuid, $from_uuid);
		$to   = $this->revision($set_uuid, $to_uuid);
		$diff = [];
		$this->diff_values($from['definition'], $to['definition'], '', $diff);
		return $diff;
	}

	/**
	 * @param array<string,mixed> $definition Definition.
	 * @return array<string,mixed>
	 */
	private function remap_definition(array $definition, string $new_set_uuid): array {
		$map = [];
		$collect = function (mixed $value) use (&$collect, &$map): void {
			if (! is_array($value)) {
				return;
			}
			if (isset($value['uuid']) && is_string($value['uuid']) && Uuid::is_valid($value['uuid'])) {
				$map[$value['uuid']] = Uuid::v4();
			}
			foreach ($value as $item) {
				if (is_array($item)) {
					$collect($item);
				}
			}
		};
		$collect($definition);
		$replace = function (mixed $value) use (&$replace, $map): mixed {
			if (is_string($value) && isset($map[$value])) {
				return $map[$value];
			}
			if (! is_array($value)) {
				return $value;
			}
			foreach ($value as $key => $item) {
				$value[$key] = $replace($item);
			}
			return $value;
		};
		$definition                 = $replace($definition);
		$definition['setUuid']      = $new_set_uuid;
		$definition['revisionUuid'] = Uuid::v4();
		return $definition;
	}

	/**
	 * @param list<array{path:string,before:mixed,after:mixed}> $diff Diff sink.
	 */
	private function diff_values(mixed $before, mixed $after, string $path, array &$diff): void {
		if (is_array($before) && is_array($after)) {
			$keys = array_unique(array_merge(array_keys($before), array_keys($after)));
			foreach ($keys as $key) {
				$child_path = '' === $path ? (string) $key : $path . '.' . $key;
				if (! array_key_exists($key, $before) || ! array_key_exists($key, $after)) {
					$diff[] = ['path' => $child_path, 'before' => $before[$key] ?? null, 'after' => $after[$key] ?? null];
				} else {
					$this->diff_values($before[$key], $after[$key], $child_path, $diff);
				}
			}
			return;
		}
		if ($before !== $after) {
			$diff[] = ['path' => $path, 'before' => $before, 'after' => $after];
		}
	}

	private function title(string $title): string {
		$title = trim(wp_strip_all_tags($title));
		$title = function_exists('mb_substr') ? (string) mb_substr($title, 0, 255) : substr($title, 0, 255);
		return '' !== $title ? $title : __('Untitled option set', 'wooptions-pro');
	}

	private function note(string $note): string {
		$note = trim(wp_strip_all_tags($note));
		return function_exists('mb_substr') ? (string) mb_substr($note, 0, 1000) : substr($note, 0, 1000);
	}

	private function unique_slug(string $title, string $uuid): string {
		$base = sanitize_title($title);
		$base = '' !== $base ? $base : 'option-set';
		$slug = $base;
		if ($this->repository->slug_exists($slug)) {
			$slug .= '-' . substr(str_replace('-', '', $uuid), 0, 8);
		}
		return $slug;
	}
}
