<?php
/**
 * Capability-protected administration REST API.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Presentation\Rest;

use WooOptionsPro\Application\AnalyticsService;
use WooOptionsPro\Application\AssignmentService;
use WooOptionsPro\Application\DiagnosticsService;
use WooOptionsPro\Application\OptionSetService;
use WooOptionsPro\Application\TemplateService;
use WooOptionsPro\Bootstrap\Settings;
use WooOptionsPro\Domain\Definition\Compiler;
use WooOptionsPro\Domain\Pricing\Formula\Evaluator;
use WooOptionsPro\Domain\Pricing\Formula\Parser;
use WooOptionsPro\Domain\Rule\RuleEngine;
use WooOptionsPro\Domain\Style\ContrastValidator;

final class AdminController
{
	use Responder;

	private const NAMESPACE = 'wooptions-pro/v1';
	private const UUID_PATTERN = '[0-9a-fA-F-]{36}';

	public function __construct(
		private readonly OptionSetService $option_sets,
		private readonly AssignmentService $assignments,
		private readonly Compiler $compiler,
		private readonly Parser $formula_parser,
		private readonly Evaluator $formula_evaluator,
		private readonly RuleEngine $rules,
		private readonly ContrastValidator $contrast,
		private readonly TemplateService $templates,
		private readonly AnalyticsService $analytics,
		private readonly ?DiagnosticsService $diagnostics = null
	) {
	}

	public function register(): void
	{
		register_rest_route(
			self::NAMESPACE ,
			'/option-sets',
			[
				[
					'methods' => \WP_REST_Server::READABLE,
					'callback' => [$this, 'list_option_sets'],
					'permission_callback' => [$this, 'can_edit'],
					'args' => $this->collection_args(),
				],
				[
					'methods' => \WP_REST_Server::CREATABLE,
					'callback' => [$this, 'create_option_set'],
					'permission_callback' => [$this, 'can_edit'],
					'args' => [
						'title' => ['type' => 'string', 'required' => true, 'sanitize_callback' => 'sanitize_text_field'],
					],
				],
			]
		);

		$this->register_set_routes();
		$this->register_tool_routes();
	}

	private function register_set_routes(): void
	{
		$set_route = '/option-sets/(?P<uuid>' . self::UUID_PATTERN . ')';
		register_rest_route(
			self::NAMESPACE ,
			$set_route,
			[
				[
					'methods' => \WP_REST_Server::READABLE,
					'callback' => [$this, 'get_option_set'],
					'permission_callback' => [$this, 'can_edit'],
				],
				[
					'methods' => \WP_REST_Server::EDITABLE,
					'callback' => [$this, 'update_option_set'],
					'permission_callback' => [$this, 'can_edit'],
				],
				[
					'methods' => \WP_REST_Server::DELETABLE,
					'callback' => [$this, 'archive_option_set'],
					'permission_callback' => [$this, 'can_edit'],
				],
			]
		);

		$actions = [
			'duplicate' => ['POST', 'duplicate_option_set', 'can_edit'],
			'delete-permanently' => ['POST', 'delete_option_set_permanently', 'can_edit'],
			'publish' => ['POST', 'publish_option_set', 'can_publish'],
			'rollback' => ['POST', 'rollback_option_set', 'can_edit'],
			'validate' => ['POST', 'validate_option_set', 'can_edit'],
			'test-rules' => ['POST', 'test_rules', 'can_edit'],
			'test-formula' => ['POST', 'test_formula', 'can_edit'],
		];
		foreach ($actions as $action => [$method, $callback, $permission]) {
			register_rest_route(
				self::NAMESPACE ,
				$set_route . '/' . $action,
				[
					'methods' => $method,
					'callback' => [$this, $callback],
					'permission_callback' => [$this, $permission],
				]
			);
		}

		register_rest_route(
			self::NAMESPACE ,
			$set_route . '/revisions',
			[
				[
					'methods' => \WP_REST_Server::READABLE,
					'callback' => [$this, 'list_revisions'],
					'permission_callback' => [$this, 'can_edit'],
				],
				[
					'methods' => \WP_REST_Server::CREATABLE,
					'callback' => [$this, 'save_revision'],
					'permission_callback' => [$this, 'can_edit'],
				],
			]
		);
		register_rest_route(
			self::NAMESPACE ,
			$set_route . '/revisions/(?P<revision_uuid>' . self::UUID_PATTERN . ')',
			[
				'methods' => \WP_REST_Server::READABLE,
				'callback' => [$this, 'get_revision'],
				'permission_callback' => [$this, 'can_edit'],
			]
		);
		register_rest_route(
			self::NAMESPACE ,
			$set_route . '/diff',
			[
				'methods' => \WP_REST_Server::READABLE,
				'callback' => [$this, 'diff_revisions'],
				'permission_callback' => [$this, 'can_edit'],
				'args' => [
					'from' => ['type' => 'string', 'required' => true, 'pattern' => '^[0-9a-fA-F-]{36}$'],
					'to' => ['type' => 'string', 'required' => true, 'pattern' => '^[0-9a-fA-F-]{36}$'],
				],
			]
		);
		register_rest_route(
			self::NAMESPACE ,
			$set_route . '/assignments',
			[
				[
					'methods' => \WP_REST_Server::READABLE,
					'callback' => [$this, 'get_assignments'],
					'permission_callback' => [$this, 'can_edit'],
				],
				[
					'methods' => 'PUT',
					'callback' => [$this, 'put_assignments'],
					'permission_callback' => [$this, 'can_edit'],
				],
			]
		);
	}

	private function register_tool_routes(): void
	{
		register_rest_route(
			self::NAMESPACE ,
			'/assignment-targets',
			[
				'methods' => \WP_REST_Server::READABLE,
				'callback' => [$this, 'search_assignment_targets'],
				'permission_callback' => [$this, 'can_edit'],
				'args' => [
					'type' => ['type' => 'string', 'required' => true, 'sanitize_callback' => 'sanitize_key'],
					'search' => ['type' => 'string', 'default' => '', 'sanitize_callback' => 'sanitize_text_field'],
					'include' => ['type' => 'string', 'default' => '', 'sanitize_callback' => 'sanitize_text_field'],
					'perPage' => ['type' => 'integer', 'default' => 20, 'minimum' => 1, 'maximum' => 50],
					'forChoices' => ['type' => 'integer', 'default' => 0],
				],
			]
		);
		register_rest_route(
			self::NAMESPACE ,
			'/styles/contrast-check',
			[
				'methods' => \WP_REST_Server::CREATABLE,
				'callback' => [$this, 'contrast_check'],
				'permission_callback' => [$this, 'can_edit'],
			]
		);
		register_rest_route(
			self::NAMESPACE ,
			'/templates',
			[
				[
					'methods' => \WP_REST_Server::READABLE,
					'callback' => [$this, 'list_templates'],
					'permission_callback' => [$this, 'can_edit'],
				],
				[
					'methods' => \WP_REST_Server::CREATABLE,
					'callback' => [$this, 'import_template'],
					'permission_callback' => [$this, 'can_edit'],
				],
			]
		);
		register_rest_route(
			self::NAMESPACE ,
			'/imports/preview',
			[
				'methods' => \WP_REST_Server::CREATABLE,
				'callback' => [$this, 'preview_import'],
				'permission_callback' => [$this, 'can_edit'],
			]
		);
		register_rest_route(
			self::NAMESPACE ,
			'/imports/commit',
			[
				'methods' => \WP_REST_Server::CREATABLE,
				'callback' => [$this, 'commit_import'],
				'permission_callback' => [$this, 'can_edit'],
			]
		);
		register_rest_route(
			self::NAMESPACE ,
			'/test-formula',
			[
				'methods' => \WP_REST_Server::CREATABLE,
				'callback' => [$this, 'test_formula'],
				'permission_callback' => [$this, 'can_edit'],
			]
		);
		register_rest_route(
			self::NAMESPACE ,
			'/exports/(?P<uuid>' . self::UUID_PATTERN . ')',
			[
				'methods' => \WP_REST_Server::READABLE,
				'callback' => [$this, 'export_option_set'],
				'permission_callback' => [$this, 'can_edit'],
			]
		);
		register_rest_route(
			self::NAMESPACE ,
			'/analytics',
			[
				'methods' => \WP_REST_Server::READABLE,
				'callback' => [$this, 'analytics'],
				'permission_callback' => [$this, 'can_analytics'],
				'args' => [
					'from' => ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
					'to' => ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
					'productId' => ['type' => 'integer', 'minimum' => 0],
				],
			]
		);

		register_rest_route(
			self::NAMESPACE ,
			'/settings',
			[
				[
					'methods' => \WP_REST_Server::READABLE,
					'callback' => [$this, 'get_settings'],
					'permission_callback' => [$this, 'can_settings'],
				],
				[
					'methods' => \WP_REST_Server::EDITABLE,
					'callback' => [$this, 'update_settings'],
					'permission_callback' => [$this, 'can_settings'],
				],
			]
		);
	}

	public function list_option_sets(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		return $this->respond(fn(): array => $this->option_sets->list([
			'page' => (int) $request['page'],
			'perPage' => (int) $request['perPage'],
			'status' => (string) $request['status'],
			'search' => (string) $request['search'],
			'orderBy' => (string) $request['orderBy'],
			'order' => (string) $request['order'],
		]));
	}

	private function enforce_license(): ?\WP_Error
	{
		if (class_exists('\WooOptionsPro\License\LicenseGate') && ! \WooOptionsPro\License\LicenseGate::can_configure()) {
			$msg = \WooOptionsPro\License\LicenseGate::locked_message();
			return new \WP_Error(
				'wooptions_pro_license_required',
				$msg ?: __('Activate your WooOptions Pro license to create and edit product option sets.', 'wooptions-pro'),
				['status' => 403]
			);
		}
		if (class_exists('\WooOptionsPro_License_Gate') && ! \WooOptionsPro_License_Gate::can_configure()) {
			$msg = \WooOptionsPro_License_Gate::locked_message();
			return new \WP_Error(
				'wooptions_pro_license_required',
				$msg ?: __('Activate your WooOptions Pro license to create and edit product option sets.', 'wooptions-pro'),
				['status' => 403]
			);
		}
		return null;
	}

	public function create_option_set(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		if ($err = $this->enforce_license()) {
			return $err;
		}
		return $this->respond(
			fn(): array => $this->option_sets->create((string) $request['title'], get_current_user_id()),
			201
		);
	}

	public function get_option_set(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		return $this->respond(fn(): array => $this->option_sets->get((string) $request['uuid']));
	}

	public function update_option_set(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		if ($err = $this->enforce_license()) {
			return $err;
		}
		return $this->respond(function () use ($request): array {
			$set = $this->option_sets->get((string) $request['uuid']);
			$body = $this->body($request);
			if ('archived' === ($body['status'] ?? '')) {
				return $this->option_sets->archive((string) $set['uuid'], get_current_user_id());
			}
			if ('active' === ($body['status'] ?? '')) {
				return $this->option_sets->activate((string) $set['uuid'], get_current_user_id());
			}
			if ('inactive' === ($body['status'] ?? '')) {
				return $this->option_sets->deactivate((string) $set['uuid'], get_current_user_id());
			}
			$definition = (array) $set['currentRevision']['definition'];
			$definition['title'] = (string) ($body['title'] ?? $set['title']);
			return $this->option_sets->save_draft(
				(string) $set['uuid'],
				$definition,
				(string) ($body['expectedHash'] ?? $set['currentRevision']['contentHash']),
				(string) ($body['versionNote'] ?? __('Renamed option set', 'wooptions-pro')),
				get_current_user_id()
			);
		});
	}

	public function archive_option_set(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		if ($err = $this->enforce_license()) {
			return $err;
		}
		return $this->respond(fn(): array => $this->option_sets->archive((string) $request['uuid'], get_current_user_id()));
	}

	public function duplicate_option_set(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		if ($err = $this->enforce_license()) {
			return $err;
		}
		return $this->respond(fn(): array => $this->option_sets->duplicate((string) $request['uuid'], get_current_user_id()), 201);
	}

	public function delete_option_set_permanently(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		if ($err = $this->enforce_license()) {
			return $err;
		}
		return $this->respond(fn(): array => $this->option_sets->delete_permanently((string) $request['uuid']));
	}

	public function list_revisions(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		return $this->respond(fn(): array => $this->option_sets->revisions((string) $request['uuid']));
	}

	public function save_revision(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		if ($err = $this->enforce_license()) {
			return $err;
		}
		return $this->respond(function () use ($request): array {
			$body = $this->body($request);
			return $this->option_sets->save_draft(
				(string) $request['uuid'],
				(array) ($body['definition'] ?? []),
				(string) ($body['expectedHash'] ?? ''),
				(string) ($body['versionNote'] ?? __('Autosaved draft', 'wooptions-pro')),
				get_current_user_id()
			);
		}, 201);
	}

	public function get_revision(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		return $this->respond(fn(): array => $this->option_sets->revision((string) $request['uuid'], (string) $request['revision_uuid']));
	}

	public function publish_option_set(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		if ($err = $this->enforce_license()) {
			return $err;
		}
		return $this->respond(function () use ($request): array {
			$body = $this->body($request);
			return $this->option_sets->publish(
				(string) $request['uuid'],
				(string) ($body['expectedHash'] ?? ''),
				(string) ($body['versionNote'] ?? __('Published from the builder', 'wooptions-pro')),
				get_current_user_id()
			);
		});
	}

	public function rollback_option_set(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		if ($err = $this->enforce_license()) {
			return $err;
		}
		return $this->respond(function () use ($request): array {
			$body = $this->body($request);
			return $this->option_sets->rollback(
				(string) $request['uuid'],
				(string) ($body['revisionUuid'] ?? ''),
				get_current_user_id()
			);
		}, 201);
	}

	public function diff_revisions(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		return $this->respond(fn(): array => [
			'changes' => $this->option_sets->diff((string) $request['uuid'], (string) $request['from'], (string) $request['to']),
		]);
	}

	public function search_assignment_targets(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		return $this->respond(function () use ($request): array {
			$type = sanitize_key((string) $request->get_param('type'));
			$search = sanitize_text_field((string) $request->get_param('search'));
			$per_page = max(1, min(50, (int) $request->get_param('perPage')));
			$include = array_values(array_unique(array_filter(array_map('absint', explode(',', (string) $request->get_param('include'))))));
			$items = [];

			if (in_array($type, ['category', 'tag'], true)) {
				$taxonomy = 'category' === $type ? 'product_cat' : 'product_tag';
				$args = [
					'taxonomy' => $taxonomy,
					'hide_empty' => false,
					'number' => $include ? count($include) : $per_page,
					'orderby' => $include ? 'include' : 'name',
					'order' => 'ASC',
				];
				if ($include) {
					$args['include'] = $include;
				} elseif ('' !== $search) {
					$args['search'] = $search;
				}
				$terms = get_terms($args);
				if (!is_wp_error($terms)) {
					foreach ($terms as $term) {
						$parent = '';
						if ((int) $term->parent > 0) {
							$parent_term = get_term((int) $term->parent, $taxonomy);
							if ($parent_term && !is_wp_error($parent_term)) {
								$parent = (string) $parent_term->name;
							}
						}
						$items[] = [
							'id' => (int) $term->term_id,
							'type' => $type,
							'label' => (string) $term->name,
							'meta' => $parent ? sprintf(__('Under %s', 'wooptions-pro'), $parent) : sprintf(_n('%d product', '%d products', (int) $term->count, 'wooptions-pro'), (int) $term->count),
							'image' => '',
						];
					}
				}
				return ['items' => $items];
			}

			if (!in_array($type, ['product', 'variation'], true)) {
				return ['items' => []];
			}

			$post_type = 'variation' === $type ? 'product_variation' : 'product';
			$query_args = [
				'post_type' => $post_type,
				'post_status' => ['publish', 'private', 'draft', 'pending'],
				'posts_per_page' => $include ? count($include) : $per_page,
				'fields' => 'ids',
				'no_found_rows' => true,
				'orderby' => $include ? 'post__in' : 'title',
				'order' => 'ASC',
			];
			if ($include) {
				$query_args['post__in'] = $include;
			} elseif ('' !== $search) {
				$query_args['s'] = $search;
			}
			$ids = (new \WP_Query($query_args))->posts;

			if (!$include && '' !== $search) {
				$sku_ids = get_posts([
					'post_type' => $post_type,
					'post_status' => ['publish', 'private', 'draft', 'pending'],
					'posts_per_page' => $per_page,
					'fields' => 'ids',
					'no_found_rows' => true,
					'meta_query' => [
						[
							'key' => '_sku',
							'value' => $search,
							'compare' => 'LIKE',
						]
					],
				]);
				$ids = array_values(array_unique(array_merge(array_map('intval', $ids), array_map('intval', $sku_ids))));
				if (ctype_digit($search)) {
					$exact = absint($search);
					if ($exact && $post_type === get_post_type($exact)) {
						array_unshift($ids, $exact);
						$ids = array_values(array_unique($ids));
					}
				}
				$ids = array_slice($ids, 0, $per_page);
			}

			$for_choices = (int) $request->get_param('forChoices') === 1;

			foreach ($ids as $id) {
				$product = function_exists('wc_get_product') ? wc_get_product((int) $id) : null;
				$label = $product ? $product->get_name() : get_the_title((int) $id);
				if (!$label) {
					$label = sprintf(__('Item #%d', 'wooptions-pro'), (int) $id);
				}
				$sku = $product ? (string) $product->get_sku() : '';
				$meta = $sku ? sprintf(__('SKU: %s', 'wooptions-pro'), $sku) : sprintf(__('ID: %d', 'wooptions-pro'), (int) $id);
				if ('variation' === $type && $product && method_exists($product, 'get_parent_id')) {
					$parent_id = (int) $product->get_parent_id();
					if ($parent_id > 0) {
						$meta .= ' · ' . get_the_title($parent_id);
					}
				}
				$image = get_the_post_thumbnail_url((int) $id, 'thumbnail');
				if (!$image && 'variation' === $type && $product && method_exists($product, 'get_parent_id')) {
					$image = get_the_post_thumbnail_url((int) $product->get_parent_id(), 'thumbnail');
				}
				$item = [
					'id' => (int) $id,
					'type' => $type,
					'label' => wp_strip_all_tags((string) $label),
					'meta' => wp_strip_all_tags($meta),
					'image' => $image ? esc_url_raw($image) : '',
				];
				if ($for_choices && 'product' === $type && $product) {
					$price = (string) $product->get_price();
					$regular_price = (string) $product->get_regular_price();
					$sale_price = (string) $product->get_sale_price();
					$is_variable = $product->is_type('variable');
					if ($is_variable && method_exists($product, 'get_variation_price')) {
						if ('' === $price) {
							$price = (string) $product->get_variation_price('min');
						}
						if ('' === $regular_price && method_exists($product, 'get_variation_regular_price')) {
							$regular_price = (string) $product->get_variation_regular_price('min');
						}
						if ('' === $sale_price && method_exists($product, 'get_variation_sale_price')) {
							$sale_price = (string) $product->get_variation_sale_price('min');
						}
					}
					$variations = [];
					if ($is_variable && method_exists($product, 'get_children')) {
						foreach (array_slice($product->get_children(), 0, 50) as $var_id) {
							$var = wc_get_product((int) $var_id);
							if (!$var)
								continue;
							$var_attrs = [];
							if (method_exists($var, 'get_variation_attributes')) {
								foreach ($var->get_variation_attributes() as $attr_key => $attr_val) {
									$var_attrs[wc_attribute_label(str_replace('attribute_', '', $attr_key))] = $attr_val;
								}
							}
							$var_img = get_the_post_thumbnail_url((int) $var_id, 'thumbnail');
							if (!$var_img)
								$var_img = $image ? $image : '';
							$var_label = $var->get_name();
							if ($var_label === $product->get_name() && !empty($var_attrs)) {
								$var_label = implode(', ', array_values($var_attrs));
							}
							$variations[] = [
								'id' => (int) $var_id,
								'label' => wp_strip_all_tags((string) $var_label),
								'price' => (string) $var->get_price(),
								'regularPrice' => (string) $var->get_regular_price(),
								'salePrice' => (string) $var->get_sale_price(),
								'image' => $var_img ? esc_url_raw($var_img) : '',
								'attributes' => $var_attrs,
							];
						}
					}
					$item['price'] = $price;
					$item['regularPrice'] = $regular_price;
					$item['salePrice'] = $sale_price;
					$item['isVariable'] = $is_variable;
					$item['variations'] = $variations;
				}
				$items[] = $item;
			}
			return ['items' => $items];
		});
	}

	public function get_assignments(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		return $this->respond(fn(): array => ['items' => $this->assignments->for_set((string) $request['uuid'])]);
	}

	public function put_assignments(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		if ($err = $this->enforce_license()) {
			return $err;
		}
		return $this->respond(function () use ($request): array {
			$body = $this->body($request);
			return ['items' => $this->assignments->replace((string) $request['uuid'], (array) ($body['assignments'] ?? []))];
		});
	}

	public function validate_option_set(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		return $this->respond(function () use ($request): array {
			$body = $this->body($request);
			$result = $this->compiler->compile((array) ($body['definition'] ?? []));
			return [
				'valid' => $result['valid'],
				'errors' => $result['errors'],
				'warnings' => $result['warnings'],
				'contentHash' => $result['contentHash'],
				'compiled' => $result['valid'] ? $result['compiled'] : null,
			];
		});
	}

	public function test_rules(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		return $this->respond(function () use ($request): array {
			$body = $this->body($request);
			return $this->rules->trace(
				(array) ($body['condition'] ?? []),
				(array) ($body['values'] ?? []),
				(array) ($body['context'] ?? [])
			);
		});
	}

	public function test_formula(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		return $this->respond(function () use ($request): array {
			$body = $this->body($request);
			$expression = substr(trim((string) ($body['expression'] ?? '0')), 0, 2000);
			$fields = (array) ($body['fields'] ?? []);
			$resolved = \WooOptionsPro\Domain\Pricing\Formula\Evaluator::resolve_tokens($expression, $fields);
			$ast = $this->formula_parser->parse($resolved);

			$variables = (array) ($body['variables'] ?? []);
			if (!isset($variables['fields'])) {
				$sample_values = [];
				$sample_context = (array) ($body['context'] ?? []);
				$sample_context['basePrice'] = (string) ($sample_context['basePrice'] ?? '100');
				$sample_context['quantity'] = (int) ($sample_context['quantity'] ?? 1);

				// Generate mock values
				foreach ($fields as $f) {
					if (!is_array($f)) {
						continue;
					}
					$u = (string) ($f['uuid'] ?? '');
					$def = $f['default'] ?? null;
					$t = (string) ($f['type'] ?? '');
					$choices = (array) ($f['choices'] ?? ($f['options'] ?? []));

					if (!empty($choices)) {
						$selected_choice_uuids = [];
						foreach ($choices as $ci => $ch) {
							$ch_lbl = trim((string) ($ch['label'] ?? ('Option ' . ($ci + 1))));
							$ch_slug = (string) preg_replace('/\s+/', '_', $ch_lbl);
							$ch_uuid = (string) ($ch['uuid'] ?? '');
							$ch_val = (string) ($ch['value'] ?? '');
							$ch_clean = preg_replace('/[^a-z0-9]/', '', strtolower($ch_lbl));

							$is_mentioned = ('' !== $ch_lbl && false !== stripos($expression, $ch_lbl))
								|| ('' !== $ch_slug && false !== stripos($expression, $ch_slug))
								|| ('' !== $ch_slug && false !== stripos($expression, str_replace('_', '-', $ch_slug)))
								|| ('' !== $ch_uuid && false !== stripos($expression, $ch_uuid))
								|| ('' !== $ch_val && false !== stripos($expression, $ch_val))
								|| ('' !== $ch_clean && false !== stripos(preg_replace('/[^a-z0-9]/', '', strtolower($expression)), $ch_clean));

							if ($is_mentioned) {
								$selected_choice_uuids[] = $ch_uuid ?: ($ch_val ?: $ch_lbl);
							}
						}
						if (empty($selected_choice_uuids)) {
							$first_ch = reset($choices);
							$selected_choice_uuids[] = (string) ($first_ch['uuid'] ?? ($first_ch['value'] ?? ($first_ch['label'] ?? '')));
						}
						$is_mult = !empty($f['multiple']) || 'checkbox_group' === $t;
						$sample_values[$u] = $is_mult ? $selected_choice_uuids : reset($selected_choice_uuids);
					} elseif (in_array($t, ['checkbox', 'toggle', 'switch'], true)) {
						$sample_values[$u] = '1';
					} elseif (in_array($t, ['number', 'range', 'customer_defined_price'], true)) {
						$sample_values[$u] = (is_numeric($def) && '' !== (string) $def) ? (string) $def : '10';
					} elseif (in_array($t, ['text', 'textarea', 'email', 'url', 'tel'], true)) {
						$sample_values[$u] = (string) ($def ?: 'Sample text');
					} elseif (in_array($t, ['date', 'datetime', 'date_range'], true)) {
						$sample_values[$u] = (string) date('Y-m-d');
					} else {
						$sample_values[$u] = (is_numeric($def) && '' !== (string) $def) ? (string) $def : '10';
					}
				}

				$variables['fields'] = \WooOptionsPro\Domain\Pricing\PriceEngine::resolve_formula_variables(
					$fields,
					$sample_values,
					$sample_context
				);
				$variables['base_price'] = $sample_context['basePrice'];
				$variables['product_price'] = $sample_context['basePrice'];
				$variables['quantity'] = $sample_context['quantity'];

				// In test mode, ensure any choice option referenced in the expression has actual calculated values
				foreach ($fields as $f) {
					$choices = (array) ($f['choices'] ?? ($f['options'] ?? []));
					if (empty($choices)) {
						continue;
					}
					$f_lbl = trim((string) ($f['label'] ?? ''));
					$f_slug = (string) preg_replace('/\s+/', '_', $f_lbl);
					$f_type = (string) ($f['type'] ?? '');
					$f_keys = array_filter(array_unique([
						$f_lbl,
						$f_slug,
						(string) ($f['uuid'] ?? ''),
						$f_type,
						str_replace('_', '-', $f_slug),
						strtolower($f_lbl),
						strtolower($f_slug),
					]));

					foreach ($choices as $ci => $ch) {
						$c_lbl = trim((string) ($ch['label'] ?? ('Option ' . ($ci + 1))));
						$c_slug = (string) preg_replace('/\s+/', '_', $c_lbl);
						$c_keys = array_filter(array_unique([
							$c_lbl,
							$c_slug,
							(string) ($ch['uuid'] ?? ''),
							(string) ($ch['value'] ?? ''),
							str_replace('_', '-', $c_slug),
							strtolower($c_lbl),
							strtolower($c_slug),
						]));
						$c_num = \WooOptionsPro\Domain\Pricing\PriceEngine::calculate_choice_price(
							$ch,
							$f,
							$sample_context['basePrice'],
							$sample_context
						);
						$c_amount = (string) $c_num;
						$c_checked = $c_num > 0 ? $c_amount : '1';

						$is_mentioned = ('' !== $c_lbl && false !== stripos($expression, $c_lbl))
							|| ('' !== $c_slug && false !== stripos($expression, $c_slug))
							|| ('' !== $c_slug && false !== stripos($expression, str_replace('_', '-', $c_slug)))
							|| (!empty($ch['uuid']) && false !== stripos($expression, (string) $ch['uuid']));

						if ($is_mentioned) {
							foreach ($f_keys as $fk) {
								foreach ($c_keys as $ck) {
									$prefix = "{$fk}.options.{$ck}.";
									$prefix_short = "{$fk}.{$ck}.";

									$props = [
										'checked' => $c_checked,
										'selected' => $c_checked,
										'formula' => $c_amount,
										'formula-value' => $c_amount,
										'formula_value' => $c_amount,
										'value' => $c_amount,
										'price' => $c_amount,
										'qty' => '1',
										'quantity' => '1',
									];

									foreach ($props as $pk => $pv) {
										$variables['fields'][$prefix . $pk] = $pv;
										$variables['fields'][$prefix_short . $pk] = $pv;
									}

									$variables['fields']["{$fk}.options.{$ck}"] = $c_amount;
									$variables['fields']["{$fk}.{$ck}"] = $c_amount;
								}
							}

							foreach ($c_keys as $ck) {
								$variables['fields'][$ck] = $c_amount;
								$variables['fields']["{$ck}.checked"] = $c_checked;
								$variables['fields']["{$ck}.formula"] = $c_amount;
								$variables['fields']["{$ck}.price"] = $c_amount;
								$variables['fields']["{$ck}.qty"] = '1';
							}
						}
					}
				}
			}
			$variables['all_fields'] = $fields;

			$result = $this->formula_evaluator->evaluate(
				$resolved,
				$variables,
				(array) ($body['rows'] ?? [])
			);
			return [
				'valid' => true,
				'ast' => $ast,
				'result' => $result->to_string(false),
				'resolved' => $resolved,
			];
		});
	}

	public function contrast_check(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		return $this->respond(function () use ($request): array {
			$body = $this->body($request);
			$foreground = strtoupper((string) ($body['foreground'] ?? ''));
			$background = strtoupper((string) ($body['background'] ?? ''));
			$minimum = max(3.0, min(7.0, (float) ($body['minimum'] ?? 4.5)));
			$ratio = $this->contrast->ratio($foreground, $background);
			return [
				'ratio' => null === $ratio ? null : round($ratio, 2),
				'minimum' => $minimum,
				'passes' => null !== $ratio && $ratio >= $minimum,
				'suggestion' => $this->contrast->suggested_on_color($background),
			];
		});
	}

	public function list_templates(): \WP_REST_Response|\WP_Error
	{
		return $this->respond(fn(): array => ['items' => $this->templates->list()]);
	}

	public function import_template(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		if ($err = $this->enforce_license()) {
			return $err;
		}
		return $this->respond(function () use ($request): array {
			$body = $this->body($request);
			return $this->templates->import((string) ($body['slug'] ?? ''), get_current_user_id());
		}, 201);
	}

	public function preview_import(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		return $this->respond(function () use ($request): array {
			$body = $this->body($request);
			$definition = (array) ($body['optionSet']['definition'] ?? $body['definition'] ?? []);
			$result = $this->compiler->compile($definition);
			return [
				'valid' => $result['valid'],
				'errors' => $result['errors'],
				'warnings' => $result['warnings'],
				'title' => $result['definition']['title'],
				'fieldCount' => count((array) $result['definition']['fields']),
				'contentHash' => $result['contentHash'],
			];
		});
	}

	public function commit_import(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		if ($err = $this->enforce_license()) {
			return $err;
		}
		return $this->respond(function () use ($request): array {
			$body = $this->body($request);
			$definition = (array) ($body['optionSet']['definition'] ?? $body['definition'] ?? []);
			return $this->option_sets->import($definition, (string) ($body['title'] ?? ''), get_current_user_id());
		}, 201);
	}

	public function export_option_set(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		return $this->respond(fn(): array => $this->option_sets->export((string) $request['uuid']));
	}

	public function analytics(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		return $this->respond(fn(): array => $this->analytics->summary(
			(string) ($request['range'] ?? '30d'),
			(string) ($request['from'] ?? ''),
			(string) ($request['to'] ?? ''),
			(int) ($request['productId'] ?? 0)
		));
	}



	public function get_settings(): \WP_REST_Response|\WP_Error
	{
		return $this->respond(fn(): array => Settings::all());
	}

	public function update_settings(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
	{
		if ($err = $this->enforce_license()) {
			return $err;
		}
		return $this->respond(function () use ($request): array {
			$settings = Settings::sanitize($this->body($request));
			update_option(Settings::OPTION, $settings, false);
			return $settings;
		});
	}

	public function can_edit(): bool
	{
		return current_user_can('manage_options') || current_user_can('manage_woocommerce') || current_user_can('edit_wooptions-pro_sets');
	}

	public function can_publish(): bool
	{
		return current_user_can('manage_options') || current_user_can('manage_woocommerce') || current_user_can('publish_wooptions-pro_sets');
	}

	public function can_manage(): bool
	{
		return current_user_can('manage_options') || current_user_can('manage_woocommerce') || current_user_can('manage_wooptions-pro');
	}

	public function can_settings(): bool
	{
		return current_user_can('manage_options') || current_user_can('manage_woocommerce') || current_user_can('manage_wooptions-pro_settings');
	}

	public function can_analytics(): bool
	{
		return current_user_can('manage_options') || current_user_can('manage_woocommerce') || current_user_can('view_wooptions-pro_analytics');
	}

	/**
	 * @return array<string,mixed>
	 */
	private function body(\WP_REST_Request $request): array
	{
		$body = $request->get_json_params();
		return is_array($body) ? $body : [];
	}

	/**
	 * @return array<string,array<string,mixed>>
	 */
	private function collection_args(): array
	{
		return [
			'page' => ['type' => 'integer', 'default' => 1, 'minimum' => 1],
			'perPage' => ['type' => 'integer', 'default' => 20, 'minimum' => 1, 'maximum' => 100],
			'status' => ['type' => 'string', 'default' => 'active', 'enum' => ['active', 'inactive', 'archived']],
			'search' => ['type' => 'string', 'default' => '', 'sanitize_callback' => 'sanitize_text_field'],
			'orderBy' => ['type' => 'string', 'default' => 'updated_at_gmt', 'enum' => ['title', 'updated_at_gmt', 'created_at_gmt', 'priority']],
			'order' => ['type' => 'string', 'default' => 'DESC', 'enum' => ['ASC', 'DESC']],
		];
	}
}
