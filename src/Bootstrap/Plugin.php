<?php
/**
 * Plugin composition root.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Bootstrap;

use WooOptionsPro\Application\AnalyticsService;
use WooOptionsPro\Application\AssignmentService;
use WooOptionsPro\Application\DiagnosticsService;
use WooOptionsPro\Application\OptionSetService;
use WooOptionsPro\Application\QuoteService;
use WooOptionsPro\Application\SavedConfigurationService;
use WooOptionsPro\Application\TemplateService;
use WooOptionsPro\Application\UploadService;
use WooOptionsPro\Domain\Definition\Compiler;
use WooOptionsPro\Domain\Definition\FieldTypeRegistry;
use WooOptionsPro\Domain\Pricing\Formula\Evaluator;
use WooOptionsPro\Domain\Pricing\Formula\Parser;
use WooOptionsPro\Domain\Pricing\PriceEngine;
use WooOptionsPro\Domain\Font\CustomFontService;
use WooOptionsPro\Domain\Rule\RuleEngine;
use WooOptionsPro\Domain\Selection\SelectionService;
use WooOptionsPro\Domain\Snapshot\SnapshotFactory;
use WooOptionsPro\Domain\Style\ContrastValidator;
use WooOptionsPro\Domain\Style\PaletteRegistry;
use WooOptionsPro\Infrastructure\Persistence\AnalyticsRepository;
use WooOptionsPro\Infrastructure\Persistence\AssignmentRepository;
use WooOptionsPro\Infrastructure\Persistence\OptionSetRepository;
use WooOptionsPro\Infrastructure\Persistence\SavedConfigurationRepository;
use WooOptionsPro\Infrastructure\Persistence\Schema;
use WooOptionsPro\Infrastructure\Persistence\Transaction;
use WooOptionsPro\Infrastructure\Persistence\UploadRepository;
use WooOptionsPro\Infrastructure\Storage\BaselineUploadScanner;
use WooOptionsPro\Infrastructure\Storage\LocalPrivateStorage;
use WooOptionsPro\Infrastructure\WooCommerce\CartIntegration;
use WooOptionsPro\Infrastructure\WooCommerce\OrderIntegration;
use WooOptionsPro\Infrastructure\WooCommerce\ProductContext;
use WooOptionsPro\Infrastructure\WooCommerce\StoreApiIntegration;
use WooOptionsPro\Infrastructure\WooCommerce\WooLinkedProductValidator;
use WooOptionsPro\Infrastructure\WordPress\DownloadController;
use WooOptionsPro\Infrastructure\WordPress\RateLimiter;
use WooOptionsPro\Infrastructure\WordPress\SessionGuard;
use WooOptionsPro\Infrastructure\WordPress\SiteHealth;
use WooOptionsPro\Presentation\Admin\AdminPage;
use WooOptionsPro\Presentation\Rest\AdminController;
use WooOptionsPro\Presentation\Rest\PublicController;
use WooOptionsPro\Presentation\Storefront\Assets;
use WooOptionsPro\Presentation\Storefront\BlockIntegration;
use WooOptionsPro\Presentation\Storefront\Renderer;

use WooOptionsPro\License\LicenseGate;
use WooOptionsPro\License\LicenseManager;

final class Plugin {
	private ?LicenseManager $license = null;

	public function boot(): void {
		// Licensing boots first so the gate reflects the real state and the License admin page is always reachable.
		$this->license = new LicenseManager();
		$this->license->init();

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
		do_action('wooptions-pro_register_field_types', $registry);

		$formula_parser = new Parser();
		$formula_evaluator = new Evaluator(
			$formula_parser,
			(int) Settings::get('formula_operation_limit', 500)
		);
		$rules      = new RuleEngine((int) Settings::get('rule_node_limit', 500));
		$contrast   = new ContrastValidator();
		$palettes   = new PaletteRegistry((array) require WOOPTIONS_PRO_PATH . 'config/style-presets.php', $contrast);
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
			'wooptions-pro_cleanup',
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
