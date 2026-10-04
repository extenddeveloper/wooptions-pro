<?php
/**
 * Authorized streaming of private uploads.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Infrastructure\WordPress;

use Throwable;
use WooOptionsPro\Application\UploadService;
use WooOptionsPro\Infrastructure\Storage\LocalPrivateStorage;

final class DownloadController {
	public function __construct(
		private readonly UploadService $uploads,
		private readonly LocalPrivateStorage $storage,
		private readonly SessionGuard $sessions
	) {
	}

	public function register(): void {
		add_action('admin_post_wooptions-pro_download', [$this, 'stream']);
		add_action('admin_post_nopriv_wooptions-pro_download', [$this, 'stream']);
	}

	public function stream(): void {
		$uuid  = isset($_GET['file']) ? sanitize_text_field(wp_unslash($_GET['file'])) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$nonce = isset($_GET['_wpnonce']) ? sanitize_text_field(wp_unslash($_GET['_wpnonce'])) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if (1 !== preg_match('/\A[0-9a-f-]{36}\z/i', $uuid) || ! wp_verify_nonce($nonce, 'wooptions-pro_download_' . $uuid)) {
			status_header(404);
			exit;
		}
		try {
			$record = $this->uploads->record_for_download($uuid, get_current_user_id(), $this->sessions->session_hash());
			$handle = $this->storage->open((string) $record['storageKey']);
			nocache_headers();
			header('Content-Type: ' . sanitize_mime_type((string) $record['detectedMime']));
			header('Content-Length: ' . (string) max(0, (int) $record['byteSize']));
			header('Content-Disposition: attachment; filename="' . rawurlencode((string) $record['originalFilename']) . '"');
			header('X-Content-Type-Options: nosniff');
			fpassthru($handle);
			fclose($handle);
			exit;
		} catch (Throwable) {
			status_header(404);
			exit;
		}
	}
}
