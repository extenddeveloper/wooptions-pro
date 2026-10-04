<?php
/**
 * Upload scanner port.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Domain\Upload;

interface UploadScanner {
	/**
	 * @return array{accepted:bool,code:string}
	 */
	public function scan(string $path, string $detected_mime, string $extension): array;
}
