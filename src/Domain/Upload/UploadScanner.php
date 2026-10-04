<?php
/**
 * Upload scanner port.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Domain\Upload;

interface UploadScanner {
	/**
	 * @return array{accepted:bool,code:string}
	 */
	public function scan(string $path, string $detected_mime, string $extension): array;
}
