<?php
/**
 * Server-authoritative configuration quote.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Application;

use RuntimeException;
use WooptionsFic\Bootstrap\Settings;
use WooptionsFic\Domain\Pricing\PriceEngine;
use WooptionsFic\Domain\Selection\SelectionService;
use WooptionsFic\Domain\Snapshot\SnapshotFactory;

final class QuoteService {
	public function __construct(
		private readonly AssignmentService $assignments,
		private readonly SelectionService $selections,
		private readonly PriceEngine $prices,
		private readonly SnapshotFactory $snapshots,
		private readonly UploadService $uploads,
		private readonly LinkedProductValidator $linked_products
	) {
	}

	/**
	 * @param array<string,mixed> $context Product/customer context.
	 * @return array<string,mixed>|null
	 */
	public function configuration(array $context): ?array {
		return $this->assignments->resolve($context);
	}

	/**
	 * @param array<string,mixed> $raw_selection Untrusted selection.
	 * @param array<string,mixed> $context Product, price, user, and session context.
	 * @return array<string,mixed>
	 */
	public function quote(array $raw_selection, array $context): array {
		$compiled = $this->configuration($context);
		if (! $compiled) {
			throw new NotFoundException('wooptionsfic_configuration_not_found');
		}
		if (! empty($compiled['mergeErrors'])) {
			throw new ValidationException('wooptionsfic_configuration_merge_failed', (array) $compiled['mergeErrors']);
		}

		$selection = $this->selections->normalize_and_validate($raw_selection, $compiled, $context);
		$errors    = $selection['errors'];
		$references= [];
		$total_upload_bytes = 0;
		$this->validate_uploads(
			$compiled,
			$selection['values'],
			$context,
			$errors,
			$references,
			$total_upload_bytes
		);
		$maximum_upload_bytes = max(1, (int) Settings::get('upload_max_total_mb', 15)) * 1024 * 1024;
		if ($total_upload_bytes > $maximum_upload_bytes) {
			$errors[] = [
				'code'         => 'upload_total_size',
				'fieldUuid'    => '',
				'maximumBytes' => $maximum_upload_bytes,
			];
		}

		$linked = $this->linked_products->validate(
			$compiled,
			$selection['values'],
			(int) ($context['productId'] ?? 0),
			max(1, (int) ($context['quantity'] ?? 1)),
			$context
		);
		$errors = array_merge($errors, $linked['errors']);

		$price = null;
		try {
			$price = $this->prices->calculate($compiled, $selection['values'], $context);
		} catch (RuntimeException $exception) {
			$errors[] = ['code' => $exception->getMessage(), 'fieldUuid' => ''];
		}

		if ([] !== $errors) {
			return [
				'valid'         => false,
				'errors'        => $errors,
				'warnings'      => $selection['warnings'],
				'values'        => $selection['values'],
				'states'        => $selection['states'],
				'price'         => $price,
				'settings'      => (array) ($compiled['settings'] ?? []),
				'style'         => (array) ($compiled['style'] ?? []),
				'revisionUuid'  => (string) ($compiled['revisionUuid'] ?? ''),
				'revisionHash'  => (string) ($compiled['contentHash'] ?? ''),
			];
		}

		$snapshot = $this->snapshots->create(
			$compiled,
			$selection['values'],
			$price,
			(int) ($context['productId'] ?? 0),
			(int) ($context['variationId'] ?? 0),
			$context
		);

		return [
			'valid'          => true,
			'errors'         => [],
			'warnings'       => array_merge($selection['warnings'], $price['warnings']),
			'values'         => $selection['values'],
			'states'         => $selection['states'],
			'settings'       => (array) ($compiled['settings'] ?? []),
			'style'          => (array) ($compiled['style'] ?? []),
			'price'          => $price,
			'snapshot'       => $snapshot,
			'uploadRefs'     => $references,
			'linkedProducts' => $linked['items'],
			'revisionUuid'   => (string) ($compiled['revisionUuid'] ?? ''),
			'revisionHash'   => (string) ($compiled['contentHash'] ?? ''),
		];
	}

	/**
	 * @param array<string,mixed> $compiled Configuration.
	 * @param array<string,mixed> $values Values.
	 * @param array<string,mixed> $context Context.
	 * @param list<array<string,mixed>> $errors Errors.
	 * @param list<string> $references Valid references.
	 */
	private function validate_uploads(
		array $compiled,
		array $values,
		array $context,
		array &$errors,
		array &$references,
		int &$total_bytes
	): void {
		foreach ((array) ($compiled['fields'] ?? []) as $field) {
			$this->validate_upload_field($field, $values, $compiled, $context, $errors, $references, $total_bytes);
		}
	}

	/**
	 * @param array<string,mixed> $field Field.
	 * @param array<string,mixed> $values Values.
	 * @param array<string,mixed> $compiled Configuration.
	 * @param array<string,mixed> $context Context.
	 * @param list<array<string,mixed>> $errors Errors.
	 * @param list<string> $references Valid references.
	 */
	private function validate_upload_field(
		array $field,
		array $values,
		array $compiled,
		array $context,
		array &$errors,
		array &$references,
		int &$total_bytes,
		string $row_uuid = ''
	): void {
		$uuid = (string) ($field['uuid'] ?? '');
		if ('file' === ($field['type'] ?? '')) {
			foreach ((array) ($values[$uuid] ?? []) as $reference) {
				try {
					$record = $this->uploads->validate_reference(
						(string) $reference,
						(int) ($context['productId'] ?? 0),
						(int) ($context['variationId'] ?? 0),
						$uuid,
						(string) ($compiled['revisionUuid'] ?? ''),
						(int) ($context['ownerUserId'] ?? 0),
						(string) ($context['sessionHash'] ?? ''),
						$row_uuid
					);
					$references[] = (string) $reference;
					$total_bytes += max(0, (int) ($record['byteSize'] ?? 0));
				} catch (ValidationException|NotFoundException $exception) {
					$errors[] = ['code' => 'upload_reference_invalid', 'fieldUuid' => $uuid];
				}
			}
		}

		if ('repeater' === ($field['type'] ?? '')) {
			foreach ((array) ($values[$uuid] ?? []) as $row) {
				$row_values = is_array($row['values'] ?? null) ? $row['values'] : [];
				$current_row_uuid = (string) ($row['rowUuid'] ?? '');
				foreach ((array) ($field['children'] ?? []) as $child) {
					$this->validate_upload_field(
						$child,
						$row_values,
						$compiled,
						$context,
						$errors,
						$references,
						$total_bytes,
						$current_row_uuid
					);
				}
			}
		}
	}
}
