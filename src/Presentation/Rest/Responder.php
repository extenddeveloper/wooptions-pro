<?php
/**
 * Stable REST responses and exception mapping.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Presentation\Rest;

use RuntimeException;
use Throwable;
use WooptionsFic\Application\ConflictException;
use WooptionsFic\Application\NotFoundException;
use WooptionsFic\Application\ValidationException;

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
			return new \WP_Error($exception->getMessage(), __('The requested WooptionsFic resource was not found.', 'wooptionsfic'), ['status' => 404]);
		} catch (ConflictException $exception) {
			return new \WP_Error($exception->getMessage(), __('This item changed in another session. Reload it before saving again.', 'wooptionsfic'), ['status' => 409, 'conflict' => $exception->metadata()]);
		} catch (ValidationException $exception) {
			return new \WP_Error($exception->getMessage(), __('The request contains invalid configuration data.', 'wooptionsfic'), ['status' => 422, 'errors' => $exception->errors()]);
		} catch (RuntimeException $exception) {
			return new \WP_Error($exception->getMessage(), __('WooptionsFic could not complete the request.', 'wooptionsfic'), ['status' => 400]);
		} catch (Throwable $exception) {
			if (defined('WP_DEBUG') && WP_DEBUG) {
				error_log('WooptionsFic REST error: ' . $exception->getMessage()); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			}
			return new \WP_Error('wooptionsfic_internal_error', __('WooptionsFic encountered an unexpected error.', 'wooptionsfic'), ['status' => 500]);
		}
	}
}
