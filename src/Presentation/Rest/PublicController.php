<?php
/**
 * Session-bound customer REST API.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Presentation\Rest;

use WooOptionsPro\Application\AnalyticsService;
use WooOptionsPro\Application\NotFoundException;
use WooOptionsPro\Application\QuoteService;
use WooOptionsPro\Application\SavedConfigurationService;
use WooOptionsPro\Application\UploadService;
use WooOptionsPro\Application\ValidationException;
use WooOptionsPro\Bootstrap\Settings;
use WooOptionsPro\Infrastructure\WooCommerce\ProductContext;
use WooOptionsPro\Infrastructure\WordPress\RateLimiter;
use WooOptionsPro\Infrastructure\WordPress\SessionGuard;

final class PublicController {
	use Responder;

	private const NAMESPACE = 'wooptions-pro/v1';

	public function __construct(
		private readonly QuoteService $quotes,
		private readonly ProductContext $products,
		private readonly SessionGuard $sessions,
		private readonly RateLimiter $rate_limiter,
		private readonly UploadService $uploads,
		private readonly SavedConfigurationService $saved,
		private readonly AnalyticsService $analytics
	) {
	}

	public function register(): void {
		register_rest_route(
			self::NAMESPACE,
			'/products/(?P<id>\d+)/configuration',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [$this, 'configuration'],
				'permission_callback' => '__return_true',
				'args'                => [
					'id'          => ['type' => 'integer', 'minimum' => 1],
					'variationId' => ['type' => 'integer', 'default' => 0, 'minimum' => 0],
				],
			]
		);
		register_rest_route(
			self::NAMESPACE,
			'/products/(?P<id>\d+)/quote',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [$this, 'quote'],
				'permission_callback' => '__return_true',
				'args'                => ['id' => ['type' => 'integer', 'minimum' => 1]],
			]
		);
		register_rest_route(
			self::NAMESPACE,
			'/products/(?P<id>\d+)/interaction',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [$this, 'interaction'],
				'permission_callback' => '__return_true',
				'args'                => ['id' => ['type' => 'integer', 'minimum' => 1]],
			]
		);
		register_rest_route(
			self::NAMESPACE,
			'/uploads/intents',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [$this, 'upload_intent'],
				'permission_callback' => '__return_true',
			]
		);
		register_rest_route(
			self::NAMESPACE,
			'/uploads/(?P<opaque_id>[0-9a-fA-F-]{36})/complete',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [$this, 'upload_complete'],
				'permission_callback' => '__return_true',
			]
		);
		register_rest_route(
			self::NAMESPACE,
			'/saved-configurations',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [$this, 'saved_list'],
					'permission_callback' => '__return_true',
				],
				[
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => [$this, 'saved_create'],
					'permission_callback' => '__return_true',
				],
			]
		);
		register_rest_route(
			self::NAMESPACE,
			'/saved-configurations/(?P<uuid>[0-9a-fA-F-]{36})',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [$this, 'saved_get'],
					'permission_callback' => '__return_true',
				],
				[
					'methods'             => \WP_REST_Server::EDITABLE,
					'callback'            => [$this, 'saved_update'],
					'permission_callback' => '__return_true',
				],
				[
					'methods'             => \WP_REST_Server::DELETABLE,
					'callback'            => [$this, 'saved_delete'],
					'permission_callback' => '__return_true',
				],
			]
		);
		register_rest_route(
			self::NAMESPACE,
			'/shared-configurations/(?P<token>[A-Za-z0-9_-]{32,128})/load',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [$this, 'shared_load'],
				'permission_callback' => '__return_true',
			]
		);
	}

	public function configuration(\WP_REST_Request $request): \WP_REST_Response|\WP_Error {
		return $this->respond(function () use ($request): array {
			$product_id   = (int) $request['id'];
			$variation_id = (int) ($request['variationId'] ?? 0);
			$this->assert_product($product_id);
			$context = $this->context($product_id, $variation_id, 1);
			$config  = $this->quotes->configuration($context);
			if (! $config) {
				throw new NotFoundException('wooptions-pro_configuration_not_found');
			}
			return $this->configuration_payload($config, $context);
		});
	}

	public function quote(\WP_REST_Request $request): \WP_REST_Response|\WP_Error {
		return $this->respond(function () use ($request): array {
			$this->guard_payload($request);
			$body         = $this->body($request);
			$product_id   = (int) $request['id'];
			$variation_id = max(0, (int) ($body['variationId'] ?? 0));
			$quantity     = max(1, min(999, (int) ($body['quantity'] ?? 1)));
			$this->assert_product($product_id);
			$context = $this->context($product_id, $variation_id, $quantity);
			if (! empty($body['productVariations']) && is_array($body['productVariations'])) {
				$context['productVariations'] = $body['productVariations'];
			}
			if (! empty($body['choiceQuantities']) && is_array($body['choiceQuantities'])) {
				$context['choiceQuantities'] = $body['choiceQuantities'];
			}
			$config  = $this->quotes->configuration($context);
			if (! $config) {
				throw new NotFoundException('wooptions-pro_configuration_not_found');
			}
			$provided_token = (string) ($body['token'] ?? '');
			$token_is_valid = $this->sessions->verify($provided_token, $product_id, (string) $config['revisionUuid']);
			$this->assert_rate('quote', (int) Settings::get('quote_rate_limit_per_minute', 60));
			$result = $this->quotes->quote((array) ($body['selection'] ?? []), $context);
			$result['token'] = $token_is_valid
				? $provided_token
				: $this->sessions->issue($product_id, (string) $config['revisionUuid']);
			if (! $result['valid']) {
				foreach ((array) ($result['errors'] ?? []) as $error) {
					$this->analytics->record(
						'validation_error',
						[
							'productId'    => $product_id,
							'optionSetUuid'=> (string) ($config['setUuid'] ?? ''),
							'revisionUuid' => (string) ($config['revisionUuid'] ?? ''),
							'fieldUuid'    => (string) ($error['fieldUuid'] ?? ''),
						]
					);
				}
			}
			return $result;
		});
	}

	public function interaction(\WP_REST_Request $request): \WP_REST_Response|\WP_Error {
		return $this->respond(function () use ($request): array {
			$this->guard_payload($request);
			$body         = $this->body($request);
			$product_id   = (int) $request['id'];
			$variation_id = max(0, (int) ($body['variationId'] ?? 0));
			$this->assert_product($product_id);
			$context = $this->context($product_id, $variation_id, 1);
			$config  = $this->quotes->configuration($context);
			if (! $config) {
				throw new NotFoundException('wooptions-pro_configuration_not_found');
			}
			$this->assert_token((string) ($body['token'] ?? ''), $product_id, (string) $config['revisionUuid']);
			if ((string) ($body['setUuid'] ?? '') !== (string) ($config['setUuid'] ?? '')
				|| (string) ($body['revisionUuid'] ?? '') !== (string) ($config['revisionUuid'] ?? '')
			) {
				throw new ValidationException('wooptions-pro_analytics_context_invalid', [['code' => 'analytics_context_invalid']]);
			}
			$this->assert_rate('interaction', 20);
			$this->analytics->record(
				'interaction',
				[
					'productId'     => $product_id,
					'optionSetUuid' => (string) ($body['setUuid'] ?? ''),
					'revisionUuid'  => (string) ($body['revisionUuid'] ?? ''),
					'fieldUuid'     => (string) ($body['fieldUuid'] ?? ''),
					'choiceUuid'    => (string) ($body['choiceUuid'] ?? ''),
				]
			);
			return ['recorded' => true];
		}, 202);
	}

	public function upload_intent(\WP_REST_Request $request): \WP_REST_Response|\WP_Error {
		return $this->respond(function () use ($request): array {
			$body         = $this->body($request);
			$product_id   = max(1, (int) ($body['productId'] ?? 0));
			$variation_id = max(0, (int) ($body['variationId'] ?? 0));
			$this->assert_product($product_id);
			$context      = $this->context($product_id, $variation_id, 1);
			$config       = $this->quotes->configuration($context);
			if (! $config) {
				throw new NotFoundException('wooptions-pro_configuration_not_found');
			}
			$this->assert_token((string) ($body['token'] ?? ''), $product_id, (string) $config['revisionUuid']);
			$field = $this->find_field((array) $config['fields'], (string) ($body['fieldUuid'] ?? ''));
			if (! $field || 'file' !== ($field['type'] ?? '')) {
				throw new ValidationException('wooptions-pro_invalid_upload_field', [['code' => 'invalid_upload_field']]);
			}
			$this->assert_rate('upload_intent', 20);
			return $this->uploads->create_intent(
				$product_id,
				$variation_id,
				$field,
				(string) $config['revisionUuid'],
				get_current_user_id(),
				$this->sessions->session_hash(),
				(string) ($body['rowUuid'] ?? '')
			);
		}, 201);
	}

	public function upload_complete(\WP_REST_Request $request): \WP_REST_Response|\WP_Error {
		return $this->respond(function () use ($request): array {
			$uuid    = (string) $request['opaque_id'];
			$session = $this->sessions->session_hash();
			$record  = $this->uploads->intent_record($uuid, get_current_user_id(), $session);
			$this->assert_product((int) $record['productId']);
			$context = $this->context((int) $record['productId'], (int) ($record['variationId'] ?? 0), 1);
			$config  = $this->quotes->configuration($context);
			if (! $config || (string) $config['revisionUuid'] !== (string) $record['revisionUuid']) {
				throw new ValidationException('wooptions-pro_upload_revision_changed', [['code' => 'upload_revision_changed']]);
			}
			$token = (string) ($request->get_param('token') ?? '');
			$this->assert_token($token, (int) $record['productId'], (string) $record['revisionUuid']);
			$field = $this->find_field((array) $config['fields'], (string) $record['fieldUuid']);
			if (! $field) {
				throw new ValidationException('wooptions-pro_invalid_upload_field', [['code' => 'invalid_upload_field']]);
			}
			$file = $_FILES['file'] ?? null; // phpcs:ignore WordPress.Security.NonceVerification.Missing
			if (! is_array($file)) {
				throw new ValidationException('wooptions-pro_upload_transport_error', [['code' => 'upload_missing']]);
			}
			$this->assert_rate('upload_complete', 20);
			return $this->uploads->complete($uuid, $file, get_current_user_id(), $session, $field);
		});
	}

	public function saved_list(): \WP_REST_Response|\WP_Error {
		return $this->respond(fn (): array => [
			'items' => $this->saved->list(get_current_user_id(), $this->sessions->session_hash()),
		]);
	}

	public function saved_get(\WP_REST_Request $request): \WP_REST_Response|\WP_Error {
		return $this->respond(fn (): array => $this->saved->get(
			(string) $request['uuid'],
			get_current_user_id(),
			$this->sessions->session_hash()
		));
	}

	public function saved_create(\WP_REST_Request $request): \WP_REST_Response|\WP_Error {
		return $this->respond(function () use ($request): array {
			$this->guard_payload($request);
			$body         = $this->body($request);
			$product_id   = max(1, (int) ($body['productId'] ?? 0));
			$variation_id = max(0, (int) ($body['variationId'] ?? 0));
			$this->assert_product($product_id);
			$context      = $this->context($product_id, $variation_id, 1);
			$config       = $this->quotes->configuration($context);
			if (! $config) {
				throw new NotFoundException('wooptions-pro_configuration_not_found');
			}
			if (empty($config['settings']['saveEnabled']) && empty($config['settings']['shareEnabled'])) {
				throw new ValidationException('wooptions-pro_saved_config_disabled', [['code' => 'saved_config_disabled']]);
			}
			$this->assert_token((string) ($body['token'] ?? ''), $product_id, (string) $config['revisionUuid']);
			$quote = $this->quotes->quote((array) ($body['selection'] ?? []), $context);
			if (empty($quote['valid'])) {
				throw new ValidationException('wooptions-pro_saved_config_invalid', (array) ($quote['errors'] ?? []));
			}
			return $this->saved->save(
				get_current_user_id(),
				$this->sessions->session_hash(),
				$product_id,
				$variation_id,
				(string) $quote['revisionUuid'],
				(string) $quote['revisionHash'],
				(string) ($body['name'] ?? ''),
				(array) $quote['snapshot']['values'],
				(array) ($body['preview'] ?? [])
			);
		}, 201);
	}

	public function saved_update(\WP_REST_Request $request): \WP_REST_Response|\WP_Error {
		return $this->respond(function () use ($request): array {
			$body    = $this->body($request);
			$uuid    = (string) $request['uuid'];
			$user_id = get_current_user_id();
			$session = $this->sessions->session_hash();
			$action  = (string) ($body['action'] ?? 'rename');
			if ('share' === $action) {
				$record = $this->saved->get($uuid, $user_id, $session);
				$this->assert_product((int) $record['productId']);
				$config = $this->quotes->configuration(
					$this->context((int) $record['productId'], (int) $record['variationId'], 1)
				);
				if (! $config || empty($config['settings']['shareEnabled'])) {
					throw new ValidationException('wooptions-pro_share_disabled', [['code' => 'share_disabled']]);
				}
				return $this->saved->share($uuid, $user_id, $session);
			}
			if ('revoke-share' === $action) {
				$this->saved->revoke_share($uuid, $user_id, $session);
				return ['revoked' => true];
			}
			return $this->saved->rename($uuid, (string) ($body['name'] ?? ''), $user_id, $session);
		});
	}

	public function saved_delete(\WP_REST_Request $request): \WP_REST_Response|\WP_Error {
		return $this->respond(function () use ($request): array {
			$this->saved->delete((string) $request['uuid'], get_current_user_id(), $this->sessions->session_hash());
			return ['deleted' => true];
		});
	}

	public function shared_load(\WP_REST_Request $request): \WP_REST_Response|\WP_Error {
		return $this->respond(function () use ($request): array {
			$this->assert_rate('shared_load', 30);
			$record  = $this->saved->load_shared((string) $request['token']);
			$this->assert_product((int) $record['productId']);
			$context = $this->context((int) $record['productId'], (int) $record['variationId'], 1);
			$quote   = $this->quotes->quote((array) ($record['selection'] ?? []), $context);
			return ['configuration' => $record, 'currentValidation' => $quote];
		});
	}

	/**
	 * @param array<string,mixed> $config Compiled config.
	 * @param array<string,mixed> $context Context.
	 * @return array<string,mixed>
	 */
	public function configuration_payload(array $config, array $context): array {
		$payload = [
			'configuration' => $config,
			'token'         => $this->sessions->issue((int) $context['productId'], (string) $config['revisionUuid']),
			'currency'      => (string) $context['currency'],
			'currencyScale' => (int) $context['currencyScale'],
			'basePrice'     => (string) $context['basePrice'],
		];
		$this->analytics->record(
			'view',
			[
				'productId'     => (int) $context['productId'],
				'optionSetUuid' => (string) ($config['setUuid'] ?? ''),
				'revisionUuid'  => (string) ($config['revisionUuid'] ?? ''),
			]
		);
		return $payload;
	}

	/**
	 * @return array<string,mixed>
	 */
	private function context(int $product_id, int $variation_id, int $quantity): array {
		return $this->products->make(
			$product_id,
			$variation_id,
			$quantity,
			get_current_user_id(),
			$this->sessions->session_hash()
		);
	}

	private function assert_product(int $product_id): void {
		if (! $this->products->visible_and_purchasable($product_id)) {
			throw new NotFoundException('wooptions-pro_product_not_found');
		}
	}

	private function assert_token(string $token, int $product_id, string $revision_uuid): void {
		if (! $this->sessions->verify($token, $product_id, $revision_uuid)) {
			throw new ValidationException('wooptions-pro_public_token_invalid', [['code' => 'public_token_invalid']]);
		}
	}

	private function assert_rate(string $scope, int $limit): void {
		$session  = $this->sessions->session_hash();
		$identity = $this->rate_limiter->request_identity($session);
		if (! $this->rate_limiter->allow($scope, $identity, $limit)) {
			throw new ValidationException('wooptions-pro_rate_limited', [['code' => 'rate_limited']]);
		}
	}

	private function guard_payload(\WP_REST_Request $request): void {
		if (strlen($request->get_body()) > 262144) {
			throw new ValidationException('wooptions-pro_payload_too_large', [['code' => 'payload_too_large']]);
		}
	}

	/**
	 * @return array<string,mixed>
	 */
	private function body(\WP_REST_Request $request): array {
		$body = $request->get_json_params();
		return is_array($body) ? $body : [];
	}

	/**
	 * @param list<array<string,mixed>> $fields Fields.
	 * @return array<string,mixed>|null
	 */
	private function find_field(array $fields, string $uuid): ?array {
		foreach ($fields as $field) {
			if ((string) ($field['uuid'] ?? '') === $uuid) {
				return $field;
			}
			$child = $this->find_field((array) ($field['children'] ?? []), $uuid);
			if ($child) {
				return $child;
			}
		}
		return null;
	}
}
