<?php
/**
 * Guest/customer session binding and signed public request tokens.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Infrastructure\WordPress;

final class SessionGuard {
	private const COOKIE = 'wooptions-pro_guest';

	public function ensure_guest_cookie(): void {
		if (is_user_logged_in()) {
			return;
		}

		$existing = isset($_COOKIE[self::COOKIE])
			? sanitize_text_field(wp_unslash($_COOKIE[self::COOKIE]))
			: '';
		if ('' !== $existing) {
			return;
		}

		$value = rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
		if (! headers_sent()) {
			setcookie(
				self::COOKIE,
				$value,
				[
					'expires'  => time() + (30 * DAY_IN_SECONDS),
					'path'     => COOKIEPATH ?: '/',
					'domain'   => COOKIE_DOMAIN,
					'secure'   => is_ssl(),
					'httponly' => true,
					'samesite' => 'Lax',
				]
			);
		}

		// Make the identity available during this request as well. This is
		// important for REST requests where WooCommerce has not created its
		// customer session yet.
		$_COOKIE[self::COOKIE] = $value;
	}

	/**
	 * Return a stable session hash for newly issued tokens and private records.
	 *
	 * WordPress page rendering and REST requests do not always initialize the
	 * WooCommerce customer session at the same point. Using the plugin guest
	 * cookie first prevents a token from being issued against one identity and
	 * verified against another a moment later.
	 */
	public function session_hash(): string {
		$identities = $this->session_identities();
		if ([] === $identities && ! is_user_logged_in()) {
			$this->ensure_guest_cookie();
			$identities = $this->session_identities();
		}

		return [] === $identities ? '' : $this->hash_identity($identities[0]);
	}

	public function issue(int $product_id, string $revision_uuid, int $ttl = 1800): string {
		$payload = [
			'p' => $product_id,
			'r' => $revision_uuid,
			's' => $this->session_hash(),
			'e' => time() + max(60, min(3600, $ttl)),
			'n' => bin2hex(random_bytes(8)),
		];
		$encoded   = $this->base64url(wp_json_encode($payload, JSON_UNESCAPED_SLASHES));
		$signature = $this->base64url(hash_hmac('sha256', $encoded, wp_salt('nonce'), true));
		return $encoded . '.' . $signature;
	}

	public function verify(string $token, int $product_id, string $revision_uuid): bool {
		$parts = explode('.', $token, 2);
		if (2 !== count($parts)) {
			return false;
		}
		[$encoded, $signature] = $parts;
		$expected = $this->base64url(hash_hmac('sha256', $encoded, wp_salt('nonce'), true));
		if (! hash_equals($expected, $signature)) {
			return false;
		}
		$json = $this->base64url_decode($encoded);
		if (false === $json) {
			return false;
		}
		$payload = json_decode($json, true);
		if (! is_array($payload)
			|| (int) ($payload['p'] ?? 0) !== $product_id
			|| ! hash_equals((string) ($payload['r'] ?? ''), $revision_uuid)
			|| (int) ($payload['e'] ?? 0) < time()
		) {
			return false;
		}

		$token_session = (string) ($payload['s'] ?? '');
		$candidates    = $this->session_hash_candidates();
		if ([] === $candidates) {
			return '' === $token_session;
		}
		foreach ($candidates as $candidate) {
			if (hash_equals($token_session, $candidate)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Current identities in preferred order, with compatibility candidates.
	 *
	 * @return list<string>
	 */
	private function session_identities(): array {
		$identities = [];

		if (is_user_logged_in()) {
			$identities[] = 'user:' . get_current_user_id();
		}

		if (isset($_COOKIE[self::COOKIE])) {
			$guest = sanitize_text_field(wp_unslash($_COOKIE[self::COOKIE]));
			if ('' !== $guest) {
				$identities[] = $guest;
			}
		}

		if (function_exists('WC') && WC()->session) {
			$customer = (string) WC()->session->get_customer_id();
			if ('' !== $customer) {
				$identities[] = $customer;
			}
		}

		return array_values(array_unique(array_filter($identities, static fn (string $value): bool => '' !== $value)));
	}

	/**
	 * @return list<string>
	 */
	private function session_hash_candidates(): array {
		return array_values(array_unique(array_map([$this, 'hash_identity'], $this->session_identities())));
	}

	private function hash_identity(string $identity): string {
		return hash_hmac('sha256', $identity, wp_salt('auth'));
	}

	private function base64url(string $value): string {
		return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
	}

	private function base64url_decode(string $value): string|false {
		$padding = strlen($value) % 4;
		if ($padding > 0) {
			$value .= str_repeat('=', 4 - $padding);
		}
		return base64_decode(strtr($value, '-_', '+/'), true);
	}
}
