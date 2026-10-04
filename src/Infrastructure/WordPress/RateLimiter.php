<?php
/**
 * Small bounded public endpoint rate limiter.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Infrastructure\WordPress;

final class RateLimiter {
	public function allow(string $scope, string $identity, int $limit, int $window = 60): bool {
		$limit    = max(1, min(1000, $limit));
		$window   = max(10, min(3600, $window));
		$bucket   = (int) floor(time() / $window);
		$cache_key= 'wof_rate_' . hash('sha256', $scope . '|' . $identity . '|' . $bucket);
		$current  = (int) get_transient($cache_key);
		if ($current >= $limit) {
			return false;
		}
		set_transient($cache_key, $current + 1, $window + 5);
		return true;
	}

	public function request_identity(string $session_hash): string {
		if ('' !== $session_hash) {
			return $session_hash;
		}
		$address = isset($_SERVER['REMOTE_ADDR']) ? (string) wp_unslash($_SERVER['REMOTE_ADDR']) : 'unknown';
		return hash_hmac('sha256', $address, wp_salt('auth'));
	}
}
