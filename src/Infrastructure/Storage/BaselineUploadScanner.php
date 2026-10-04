<?php
/**
 * Baseline signature scanner.
 *
 * This is a defensive file-policy check, not an antivirus claim.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Infrastructure\Storage;

use WooptionsFic\Domain\Upload\UploadScanner;

final class BaselineUploadScanner implements UploadScanner {
	public function scan(string $path, string $detected_mime, string $extension): array {
		$handle = fopen($path, 'rb'); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		if (false === $handle) {
			return ['accepted' => false, 'code' => 'scanner_read_failed'];
		}
		$prefix = (string) fread($handle, 8192); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fread
		fclose($handle); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

		$lower = strtolower($prefix);
		if (str_contains($lower, '<?php') || str_contains($lower, '<script')) {
			return ['accepted' => false, 'code' => 'blocked_active_content'];
		}

		// Executable and archive signatures are meaningful only at the start.
		foreach (['#!/bin/', 'mz', "\x7felf", 'pk' . "\x03\x04"] as $signature) {
			if (str_starts_with($lower, $signature)) {
				// ZIP/OOXML archives are not accepted by the baseline policy.
				return ['accepted' => false, 'code' => 'blocked_signature'];
			}
		}

		if (in_array($extension, ['php', 'phtml', 'phar', 'exe', 'com', 'js', 'html', 'svg', 'sh'], true)) {
			return ['accepted' => false, 'code' => 'blocked_extension'];
		}
		if (str_starts_with($detected_mime, 'text/html') || str_contains($detected_mime, 'javascript')) {
			return ['accepted' => false, 'code' => 'blocked_mime'];
		}

		return ['accepted' => true, 'code' => 'baseline_policy_passed'];
	}
}
