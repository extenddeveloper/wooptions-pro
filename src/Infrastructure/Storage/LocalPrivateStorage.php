<?php
/**
 * Private local file storage.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Infrastructure\Storage;

use RuntimeException;

final class LocalPrivateStorage {
	public function base_path(): string {
		$path = defined('WOOPTIONS_PRO_PRIVATE_DIR')
			? (string) WOOPTIONS_PRO_PRIVATE_DIR
			: WP_CONTENT_DIR . '/wooptions-pro-private';

		return untrailingslashit($path);
	}

	public function ensure_vault(): void {
		$path = $this->base_path();
		if (! is_dir($path) && ! wp_mkdir_p($path)) {
			throw new RuntimeException('wooptions-pro_storage_create_failed');
		}

		$protections = [
			'index.php'  => "<?php\n// Silence is golden.\n",
			'.htaccess'  => "Options -Indexes\n<FilesMatch \".*\">\nRequire all denied\nDeny from all\n</FilesMatch>\n",
			'web.config' => "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<configuration><system.webServer><authorization><deny users=\"*\" /></authorization></system.webServer></configuration>\n",
		];

		foreach ($protections as $filename => $contents) {
			$file = $path . '/' . $filename;
			if (! file_exists($file)) {
				// These fixed protection files contain no customer-controlled data.
				file_put_contents($file, $contents); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
			}
		}
	}

	public function path_for_key(string $key): string {
		if (1 !== preg_match('/\A[a-f0-9]{64}\z/', $key)) {
			throw new RuntimeException('wooptions-pro_invalid_storage_key');
		}
		return $this->base_path() . '/' . $key . '.dat';
	}

	public function move_uploaded_file(string $temporary_path, string $key): void {
		$this->ensure_vault();
		$destination = $this->path_for_key($key);
		if (! is_uploaded_file($temporary_path) || ! move_uploaded_file($temporary_path, $destination)) {
			throw new RuntimeException('wooptions-pro_upload_move_failed');
		}
		@chmod($destination, 0640);
	}

	/**
	 * @return resource
	 */
	public function open(string $key) {
		$handle = fopen($this->path_for_key($key), 'rb'); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		if (false === $handle) {
			throw new RuntimeException('wooptions-pro_storage_read_failed');
		}
		return $handle;
	}

	public function delete(string $key): bool {
		$path = $this->path_for_key($key);
		return ! file_exists($path) || wp_delete_file($path);
	}
}
