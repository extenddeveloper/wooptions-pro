<?php
/**
 * Lightweight PSR-4 loader for production classes.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic;

final class Autoload {
	private const PREFIX = 'WooptionsFic\\';

	public static function register(): void {
		spl_autoload_register([self::class, 'load']);
	}

	private static function load(string $class): void {
		if (! str_starts_with($class, self::PREFIX)) {
			return;
		}

		$relative = substr($class, strlen(self::PREFIX));
		if (false === $relative || '' === $relative) {
			return;
		}

		$path = WOOPTIONSFIC_PATH . 'src/' . str_replace('\\', '/', $relative) . '.php';
		if (is_readable($path)) {
			require_once $path;
		}
	}
}
