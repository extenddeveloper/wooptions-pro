<?php
/**
 * Stable REST responses and exception mapping.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Presentation\Rest;

use RuntimeException;
use Throwable;
use WooOptionsPro\Application\ConflictException;
use WooOptionsPro\Application\NotFoundException;
use WooOptionsPro\Application\ValidationException;

trait Responder {
	/**
	 * @return \WP_REST_Response|\WP_Error
	 */
	private function respond(callable $callback, int $success_status = 200): \WP_REST_Response|\WP_Error {
		try {
			$result   = $callback();
			$response = new \WP_REST_Response($result, $success_status);
			$response->header('Cache-Control', 'no-store');
			return $response;
		} catch (NotFoundException $exception) {
			return new \WP_Error($exception->getMessage(), __('The requested WooOptions Pro resource was not found.', 'wooptions-pro'), ['status' => 404]);
		} catch (ConflictException $exception) {
			return new \WP_Error($exception->getMessage(), __('This item changed in another session. Reload it before saving again.', 'wooptions-pro'), ['status' => 409, 'conflict' => $exception->metadata()]);
		} catch (ValidationException $exception) {
			return new \WP_Error($exception->getMessage(), __('The request contains invalid configuration data.', 'wooptions-pro'), ['status' => 422, 'errors' => $exception->errors()]);
		} catch (RuntimeException $exception) {
			return new \WP_Error($exception->getMessage(), __('WooOptions Pro could not complete the request.', 'wooptions-pro'), ['status' => 400]);
		} catch (Throwable $exception) {
			if (defined('WP_DEBUG') && WP_DEBUG) {
				error_log('WooOptions Pro REST error: ' . $exception->getMessage()); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			}
			return new \WP_Error('wooptions-pro_internal_error', __('WooOptions Pro encountered an unexpected error.', 'wooptions-pro'), ['status' => 500]);
		}
	}
}
