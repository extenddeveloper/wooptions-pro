<?php
/**
 * Plugin composition root.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Bootstrap;

use WooptionsFic\Application\AnalyticsService;
use WooptionsFic\Application\AssignmentService;
use WooptionsFic\Application\DiagnosticsService;
use WooptionsFic\Application\OptionSetService;
use WooptionsFic\Application\QuoteService;
use WooptionsFic\Application\SavedConfigurationService;
use WooptionsFic\Application\TemplateService;
use WooptionsFic\Application\UploadService;
use WooptionsFic\Domain\Definition\Compiler;
use WooptionsFic\Domain\Definition\FieldTypeRegistry;
use WooptionsFic\Domain\Pricing\Formula\Evaluator;
use WooptionsFic\Domain\Pricing\Formula\Parser;
use WooptionsFic\Domain\Pricing\PriceEngine;
use WooptionsFic\Domain\Font\CustomFontService;
use WooptionsFic\Domain\Rule\RuleEngine;
use WooptionsFic\Domain\Selection\SelectionService;
use WooptionsFic\Domain\Snapshot\SnapshotFactory;
use WooptionsFic\Domain\Style\ContrastValidator;
use WooptionsFic\Domain\Style\PaletteRegistry;
use WooptionsFic\Infrastructure\Persistence\AnalyticsRepository;
use WooptionsFic\Infrastructure\Persistence\AssignmentRepository;
use WooptionsFic\Infrastructure\Persistence\OptionSetRepository;
use WooptionsFic\Infrastructure\Persistence\SavedConfigurationRepository;
use WooptionsFic\Infrastructure\Persistence\Schema;
use WooptionsFic\Infrastructure\Persistence\Transaction;
use WooptionsFic\Infrastructure\Persistence\UploadRepository;
use WooptionsFic\Infrastructure\Storage\BaselineUploadScanner;
use WooptionsFic\Infrastructure\Storage\LocalPrivateStorage;
use WooptionsFic\Infrastructure\WooCommerce\CartIntegration;
use WooptionsFic\Infrastructure\WooCommerce\OrderIntegration;
use WooptionsFic\Infrastructure\WooCommerce\ProductContext;
use WooptionsFic\Infrastructure\WooCommerce\StoreApiIntegration;
use WooptionsFic\Infrastructure\WooCommerce\WooLinkedProductValidator;
use WooptionsFic\Infrastructure\WordPress\DownloadController;
use WooptionsFic\Infrastructure\WordPress\RateLimiter;
use WooptionsFic\Infrastructure\WordPress\SessionGuard;
use WooptionsFic\Infrastructure\WordPress\SiteHealth;
use WooptionsFic\Presentation\Admin\AdminPage;
use WooptionsFic\Presentation\Rest\AdminController;
use WooptionsFic\Presentation\Rest\PublicController;
use WooptionsFic\Presentation\Storefront\Assets;
use WooptionsFic\Presentation\Storefront\BlockIntegration;
use WooptionsFic\Presentation\Storefront\Renderer;

final class Plugin {
	public function boot(): void {
		Schema::migrate();
		CustomFontService::register();

		$registry = new FieldTypeRegistry((int) Settings::get('max_repeater_rows', 25));
		/**
		 * Register an additional field type implementation.
		 *
		 * Implementations must honor the FieldType normalization and validation
		 * contract and must not trust browser values.
		 *
		 * @param FieldTypeRegistry $registry Registry.
		 */
		do_action('wooptionsfic_register_field_types', $registry);

		$formula_parser = new Parser();
		$formula_evaluator = new Evaluator(
			$formula_parser,
			(int) Settings::get('formula_operation_limit', 500)
		);
		$rules      = new RuleEngine((int) Settings::get('rule_node_limit', 500));
		$contrast   = new ContrastValidator();
		$palettes   = new PaletteRegistry((array) require WOOPTIONSFIC_PATH . 'config/style-presets.php', $contrast);
		$compiler   = new Compiler(
			$registry,
			$formula_parser,
			$palettes,
			(int) Settings::get('max_fields', 200),
			(int) Settings::get('max_choices', 1000)
		);

		$transaction       = new Transaction();
		$option_repository = new OptionSetRepository();
		$assignment_repo   = new AssignmentRepository();
		$upload_repo       = new UploadRepository();
		$saved_repo        = new SavedConfigurationRepository();
		$analytics_repo    = new AnalyticsRepository();
		$storage           = new LocalPrivateStorage();

		$option_sets = new OptionSetService($option_repository, $compiler, $transaction);
		$assignments = new AssignmentService($assignment_repo, $option_repository, $transaction);
		$uploads     = new UploadService($upload_repo, $storage, new BaselineUploadScanner());
		$saved       = new SavedConfigurationService($saved_repo);
		$analytics   = new AnalyticsService($analytics_repo);
		$diagnostics = new DiagnosticsService($storage);
		$templates   = new TemplateService($option_sets);

		$admin_api = new AdminController(
			$option_sets,
			$assignments,
			$compiler,
			$formula_parser,
			$formula_evaluator,
			$rules,
			$contrast,
			$templates,
			$analytics,
			$diagnostics
		);
		add_action('rest_api_init', [$admin_api, 'register']);

		$admin = new AdminPage();
		add_action('admin_menu', [$admin, 'register_menu']);
		add_action('admin_enqueue_scripts', [$admin, 'enqueue']);
		add_action('admin_notices', [$admin, 'activated_notice']);

		$site_health = new SiteHealth($diagnostics);
		$site_health->register();

		add_action(
			'wooptionsfic_cleanup',
			static function () use ($uploads, $analytics): void {
				$uploads->cleanup(200);
				$analytics->prune();
			}
		);

		if (! Requirements::woocommerce_is_available()) {
			Requirements::register_woocommerce_notice();
			return;
		}

		$sessions = new SessionGuard();
		$products = new ProductContext();
		$selections = new SelectionService($registry, $rules);
		$prices     = new PriceEngine($rules, $formula_evaluator);
		$snapshots  = new SnapshotFactory($registry);
		$quotes     = new QuoteService(
			$assignments,
			$selections,
			$prices,
			$snapshots,
			$uploads,
			new WooLinkedProductValidator()
		);

		add_action('init', [$sessions, 'ensure_guest_cookie'], 1);

		$public_api = new PublicController(
			$quotes,
			$products,
			$sessions,
			new RateLimiter(),
			$uploads,
			$saved,
			$analytics
		);
		add_action('rest_api_init', [$public_api, 'register']);

		$assets = new Assets();
		add_action('wp_enqueue_scripts', [$assets, 'register'], 5);
		add_action('wp_enqueue_scripts', [$assets, 'enqueue_on_product_pages'], 10);

		$renderer = new Renderer($quotes, $products, $sessions, $analytics);
		add_action('woocommerce_before_add_to_cart_button', [$renderer, 'render_for_current_product'], 15);

		$block = new BlockIntegration($renderer);
		add_action('init', [$block, 'register'], 20);

		$cart = new CartIntegration($quotes, $products, $sessions, $uploads, $analytics);
		$cart->register();

		$order = new OrderIntegration($uploads, $analytics, $sessions);
		$order->register();

		$store_api = new StoreApiIntegration();
		$store_api->register();

		$downloads = new DownloadController($uploads, $storage, $sessions);
		$downloads->register();
	}
}
