<?php
/**
 * Small explicit database transaction boundary.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Infrastructure\Persistence;

use Throwable;

final class Transaction {
	public function run(callable $callback): mixed {
		global $wpdb;

		$wpdb->query('START TRANSACTION');
		try {
			$result = $callback();
			$wpdb->query('COMMIT');
			return $result;
		} catch (Throwable $throwable) {
			$wpdb->query('ROLLBACK');
			throw $throwable;
		}
	}
}
