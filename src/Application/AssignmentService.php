<?php
/**
 * Deterministic assignment resolver and compiler merge.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Application;

use DateTimeImmutable;
use DateTimeZone;
use WooptionsFic\Domain\Support\CanonicalJson;
use WooptionsFic\Domain\Support\Uuid;
use WooptionsFic\Infrastructure\Persistence\AssignmentRepository;
use WooptionsFic\Infrastructure\Persistence\OptionSetRepository;
use WooptionsFic\Infrastructure\Persistence\Transaction;

final class AssignmentService {
	public function __construct(
		private readonly AssignmentRepository $assignments,
		private readonly OptionSetRepository $sets,
		private readonly Transaction $transaction
	) {
	}

	/**
	 * @return list<array<string,mixed>>
	 */
	public function for_set(string $set_uuid): array {
		$set = $this->sets->find_set($set_uuid);
		if (! $set) {
			throw new NotFoundException('wooptionsfic_set_not_found');
		}
		return $this->assignments->for_set((int) $set['id']);
	}

	/**
	 * @param list<array<string,mixed>> $assignments Assignments.
	 * @return list<array<string,mixed>>
	 */
	public function replace(string $set_uuid, array $assignments): array {
		$set = $this->sets->find_set($set_uuid);
		if (! $set) {
			throw new NotFoundException('wooptionsfic_set_not_found');
		}
		$normalized = $this->normalize_assignments($assignments);
		$this->transaction->run(
			function () use ($set, $normalized): null {
				$this->assignments->replace_for_set((int) $set['id'], $normalized);
				return null;
			}
		);
		return $this->for_set($set_uuid);
	}

	/**
	 * @param array<string,mixed> $context Context.
	 * @return array<string,mixed>|null
	 */
	public function resolve(array $context): ?array {
		$cache_key = 'effective_' . hash(
			'sha256',
			CanonicalJson::encode(
				[
					'generation' => $this->assignments->generation(),
					'revisions'  => (int) get_option('wooptionsfic_revision_generation', 1),
					'product'    => (int) ($context['productId'] ?? 0),
					'variation'  => (int) ($context['variationId'] ?? 0),
					'categories' => array_values(array_map('intval', (array) ($context['categoryIds'] ?? []))),
					'tags'       => array_values(array_map('intval', (array) ($context['tagIds'] ?? []))),
					'type'       => (string) ($context['productType'] ?? ''),
					'loggedIn'   => ! empty($context['loggedIn']),
					'roles'      => array_values(array_map('strval', (array) ($context['roles'] ?? []))),
					'hour'       => (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d-H'),
				]
			)
		);
		$cached = wp_cache_get($cache_key, 'wooptionsfic');
		if (is_array($cached)) {
			return $cached['configuration'] ?? null;
		}

		$candidates = $this->assignments->candidates($context);
		$grouped    = [];
		foreach ($candidates as $candidate) {
			if (! $this->context_matches((array) $candidate['context'], $context)) {
				continue;
			}
			$grouped[(int) $candidate['optionSetId']][] = $candidate;
		}

		$selected = [];
		foreach ($grouped as $set_id => $items) {
			$decision = $this->decision($items);
			if ($decision['included']) {
				$selected[] = [
					'setId'       => $set_id,
					'specificity' => $decision['specificity'],
					'setPriority' => (int) ($items[0]['setPriority'] ?? 10),
					'setUuid'     => (string) ($items[0]['setUuid'] ?? ''),
				];
			}
		}

		usort(
			$selected,
			static fn (array $a, array $b): int => ($b['specificity'] <=> $a['specificity'])
				?: ($a['setPriority'] <=> $b['setPriority'])
				?: strcmp($a['setUuid'], $b['setUuid'])
		);

		$revisions = $this->sets->published_revisions_for_sets(array_column($selected, 'setId'));
		$by_set    = [];
		foreach ($revisions as $revision) {
			$by_set[(int) $revision['optionSetId']] = $revision;
		}
		$ordered_revisions = [];
		foreach ($selected as $item) {
			if (isset($by_set[$item['setId']])) {
				$ordered_revisions[] = $by_set[$item['setId']];
			}
		}

		$configuration = $this->merge($ordered_revisions);
		wp_cache_set($cache_key, ['configuration' => $configuration], 'wooptionsfic', 300);
		return $configuration;
	}

	/**
	 * @param list<array<string,mixed>> $input Assignments.
	 * @return list<array<string,mixed>>
	 */
	private function normalize_assignments(array $input): array {
		$allowed_types = ['global', 'product', 'variation', 'category', 'tag', 'product_type'];
		$normalized    = [];
		foreach (array_slice($input, 0, 500) as $assignment) {
			if (! is_array($assignment)) {
				continue;
			}
			$type = (string) ($assignment['targetType'] ?? '');
			if (! in_array($type, $allowed_types, true)) {
				continue;
			}
			$target_id = null;
			if ('global' !== $type) {
				if ('product_type' === $type) {
					$target_id = AssignmentRepository::string_target_id(sanitize_key((string) ($assignment['targetValue'] ?? '')));
				} else {
					$target_id = max(1, (int) ($assignment['targetId'] ?? 0));
				}
			}
			$context = is_array($assignment['context'] ?? null) ? $assignment['context'] : [];
			$uuid    = (string) ($assignment['uuid'] ?? '');
			$normalized[] = [
				'uuid'       => \WooptionsFic\Domain\Support\Uuid::is_valid($uuid)
					? strtolower($uuid)
					: \WooptionsFic\Domain\Support\Uuid::v4(),
				'targetType' => $type,
				'targetId'   => $target_id,
				'mode'       => 'exclude' === ($assignment['mode'] ?? '') ? 'exclude' : 'include',
				'priority'   => max(-1000, min(1000, (int) ($assignment['priority'] ?? 10))),
				'context'    => [
					'loggedIn' => isset($context['loggedIn']) ? (bool) $context['loggedIn'] : null,
					'roles'    => array_values(array_filter(array_map('sanitize_key', (array) ($context['roles'] ?? [])))),
					'startsAt' => $this->valid_datetime((string) ($context['startsAt'] ?? '')),
					'endsAt'   => $this->valid_datetime((string) ($context['endsAt'] ?? '')),
				],
			];
		}
		return $normalized;
	}

	/**
	 * @param list<array<string,mixed>> $items Assignments.
	 * @return array{included:bool,specificity:int}
	 */
	private function decision(array $items): array {
		$weights = ['global' => 100, 'product_type' => 200, 'category' => 300, 'tag' => 300, 'product' => 500, 'variation' => 600];
		$include = -1;
		$exclude = -1;
		foreach ($items as $item) {
			$weight = $weights[(string) $item['targetType']] ?? 0;
			if ('exclude' === $item['mode']) {
				$exclude = max($exclude, $weight);
			} else {
				$include = max($include, $weight);
			}
		}
		return ['included' => $include >= 0 && $include > $exclude, 'specificity' => $include];
	}

	/**
	 * @param array<string,mixed> $assignment Assignment context.
	 * @param array<string,mixed> $request Request context.
	 */
	private function context_matches(array $assignment, array $request): bool {
		if (null !== ($assignment['loggedIn'] ?? null) && (bool) $assignment['loggedIn'] !== ! empty($request['loggedIn'])) {
			return false;
		}
		$roles = (array) ($assignment['roles'] ?? []);
		if ([] !== $roles && [] === array_intersect($roles, (array) ($request['roles'] ?? []))) {
			return false;
		}
		$now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
		try {
			if (! empty($assignment['startsAt']) && $now < new DateTimeImmutable((string) $assignment['startsAt'], new DateTimeZone('UTC'))) {
				return false;
			}
			if (! empty($assignment['endsAt']) && $now > new DateTimeImmutable((string) $assignment['endsAt'], new DateTimeZone('UTC'))) {
				return false;
			}
		} catch (\Exception) {
			return false;
		}
		return true;
	}

	/**
	 * @param list<array<string,mixed>> $revisions Revisions.
	 * @return array<string,mixed>|null
	 */
	private function merge(array $revisions): ?array {
		if ([] === $revisions) {
			return null;
		}
		if (1 === count($revisions) && is_array($revisions[0]['compiled'] ?? null)) {
			$compiled = $revisions[0]['compiled'];
			$compiled['sourceRevisions'] = [
				[
					'setUuid'      => (string) ($compiled['setUuid'] ?? ''),
					'revisionUuid' => (string) ($compiled['revisionUuid'] ?? ''),
					'contentHash'  => (string) ($compiled['contentHash'] ?? ''),
					'title'        => (string) ($revisions[0]['setTitle'] ?? ''),
				],
			];
			$compiled['mergeErrors'] = [];
			return $compiled;
		}
		$first    = $revisions[0]['compiled'] ?? null;
		if (! is_array($first)) {
			return null;
		}
		$effective = $first;
		$effective['fields']          = [];
		$effective['rules']           = [];
		$effective['sourceRevisions'] = [];
		$effective['settings']        = [
			'showPriceBreakdown' => false,
			'saveEnabled'        => false,
			'shareEnabled'       => false,
			'stickySummary'      => false,
		];
		$known                       = [];
		$errors                      = [];

		foreach ($revisions as $revision) {
			$compiled = $revision['compiled'] ?? null;
			if (! is_array($compiled)) {
				continue;
			}
			$effective['sourceRevisions'][] = [
				'setUuid'      => (string) ($compiled['setUuid'] ?? ''),
				'revisionUuid' => (string) ($compiled['revisionUuid'] ?? ''),
				'contentHash'  => (string) ($compiled['contentHash'] ?? ''),
				'title'        => (string) ($revision['setTitle'] ?? ''),
			];
			foreach ((array) ($compiled['fields'] ?? []) as $field) {
				$uuid = (string) ($field['uuid'] ?? '');
				if (isset($known[$uuid])) {
					$errors[] = ['code' => 'cross_set_duplicate_uuid', 'uuid' => $uuid];
					continue;
				}
				$known[$uuid]          = true;
				$effective['fields'][] = $field;
			}
			$effective['rules'] = array_merge($effective['rules'], (array) ($compiled['rules'] ?? []));
			$compiled_settings = is_array($compiled['settings'] ?? null) ? $compiled['settings'] : [];
			foreach (array_keys($effective['settings']) as $setting_key) {
				$effective['settings'][$setting_key] = ! empty($effective['settings'][$setting_key])
					|| ! empty($compiled_settings[$setting_key]);
			}
		}

		$effective['setUuid']      = Uuid::from_hash(CanonicalJson::hash(array_column($effective['sourceRevisions'], 'setUuid')));
		$effective['revisionUuid'] = Uuid::from_hash(CanonicalJson::hash(array_column($effective['sourceRevisions'], 'revisionUuid')));
		$effective['contentHash']  = CanonicalJson::hash($effective['sourceRevisions']);
		$effective['mergeErrors']  = $errors;
		return $effective;
	}

	private function valid_datetime(string $value): ?string {
		if ('' === trim($value)) {
			return null;
		}
		try {
			return (new DateTimeImmutable($value))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
		} catch (\Exception) {
			return null;
		}
	}
}
