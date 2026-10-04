<?php
/**
 * Versioned database schema.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Infrastructure\Persistence;

final class Schema {
	public const VERSION_OPTION = 'wooptions-pro_db_version';

	public static function migrate(): void {
		global $wpdb;
		$installed = (string) get_option(self::VERSION_OPTION, '0');
		$table_name = self::table('option_sets');
		$table_exists = $wpdb && $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table_name)) === $table_name;

		if ($table_exists && version_compare($installed, WOOPTIONS_PRO_DB_VERSION, '>=')) {
			return;
		}

		self::migration_1();
		update_option(self::VERSION_OPTION, WOOPTIONS_PRO_DB_VERSION, false);
	}

	public static function table(string $suffix): string {
		global $wpdb;
		return $wpdb->prefix . 'wof_' . $suffix;
	}

	private static function migration_1(): void {
		global $wpdb;

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$collate = $wpdb->get_charset_collate();

		$option_sets = self::table('option_sets');
		$revisions   = self::table('revisions');
		$assignments = self::table('assignments');
		$style_kits  = self::table('style_kits');
		$style_revs  = self::table('style_revisions');
		$uploads     = self::table('uploads');
		$saved       = self::table('saved_configs');
		$analytics   = self::table('analytics_daily');

		$sql = [];

		$sql[] = "CREATE TABLE {$option_sets} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			uuid char(36) NOT NULL,
			title varchar(255) NOT NULL,
			slug varchar(191) NOT NULL,
			status varchar(24) NOT NULL DEFAULT 'active',
			current_draft_revision_id bigint(20) unsigned NULL,
			current_published_revision_id bigint(20) unsigned NULL,
			priority int(11) NOT NULL DEFAULT 10,
			created_by bigint(20) unsigned NOT NULL DEFAULT 0,
			updated_by bigint(20) unsigned NOT NULL DEFAULT 0,
			created_at_gmt datetime NOT NULL,
			updated_at_gmt datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY uuid (uuid),
			KEY slug (slug),
			KEY status_updated (status,updated_at_gmt)
		) {$collate};";

		$sql[] = "CREATE TABLE {$revisions} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			uuid char(36) NOT NULL,
			option_set_id bigint(20) unsigned NOT NULL,
			revision_number int(10) unsigned NOT NULL,
			parent_revision_id bigint(20) unsigned NULL,
			state varchar(24) NOT NULL,
			schema_version int(10) unsigned NOT NULL DEFAULT 1,
			compiler_version varchar(32) NOT NULL DEFAULT '1',
			definition_json longtext NOT NULL,
			compiled_json longtext NULL,
			content_hash char(64) NOT NULL,
			validation_summary_json longtext NULL,
			version_note text NULL,
			created_by bigint(20) unsigned NOT NULL DEFAULT 0,
			created_at_gmt datetime NOT NULL,
			published_at_gmt datetime NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY uuid (uuid),
			UNIQUE KEY set_revision (option_set_id,revision_number),
			KEY set_state_date (option_set_id,state,created_at_gmt),
			KEY content_hash (content_hash)
		) {$collate};";

		$sql[] = "CREATE TABLE {$assignments} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			uuid char(36) NOT NULL,
			option_set_id bigint(20) unsigned NOT NULL,
			target_type varchar(32) NOT NULL,
			target_id bigint(20) unsigned NULL,
			include_exclude varchar(12) NOT NULL DEFAULT 'include',
			priority int(11) NOT NULL DEFAULT 10,
			context_json text NULL,
			created_at_gmt datetime NOT NULL,
			updated_at_gmt datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY uuid (uuid),
			KEY target (target_type,target_id,include_exclude),
			KEY option_set (option_set_id),
			KEY priority (priority)
		) {$collate};";

		$sql[] = "CREATE TABLE {$style_kits} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			uuid char(36) NOT NULL,
			name varchar(191) NOT NULL,
			status varchar(24) NOT NULL DEFAULT 'active',
			current_draft_revision_id bigint(20) unsigned NULL,
			current_published_revision_id bigint(20) unsigned NULL,
			created_by bigint(20) unsigned NOT NULL DEFAULT 0,
			updated_by bigint(20) unsigned NOT NULL DEFAULT 0,
			created_at_gmt datetime NOT NULL,
			updated_at_gmt datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY uuid (uuid),
			KEY status_updated (status,updated_at_gmt)
		) {$collate};";

		$sql[] = "CREATE TABLE {$style_revs} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			uuid char(36) NOT NULL,
			style_kit_id bigint(20) unsigned NOT NULL,
			revision_number int(10) unsigned NOT NULL,
			parent_revision_id bigint(20) unsigned NULL,
			state varchar(24) NOT NULL,
			schema_version int(10) unsigned NOT NULL DEFAULT 1,
			tokens_json longtext NOT NULL,
			typography_json longtext NULL,
			content_hash char(64) NOT NULL,
			created_by bigint(20) unsigned NOT NULL DEFAULT 0,
			created_at_gmt datetime NOT NULL,
			published_at_gmt datetime NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY uuid (uuid),
			UNIQUE KEY kit_revision (style_kit_id,revision_number),
			KEY kit_state_date (style_kit_id,state,created_at_gmt),
			KEY content_hash (content_hash)
		) {$collate};";

		$sql[] = "CREATE TABLE {$uploads} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			uuid char(36) NOT NULL,
			owner_user_id bigint(20) unsigned NULL,
			session_hash char(64) NOT NULL DEFAULT '',
			product_id bigint(20) unsigned NOT NULL,
			variation_id bigint(20) unsigned NOT NULL DEFAULT 0,
			field_uuid char(36) NOT NULL,
			row_uuid char(36) NULL,
			revision_uuid char(36) NOT NULL,
			original_filename varchar(255) NULL,
			storage_key char(64) NULL,
			detected_mime varchar(127) NULL,
			extension varchar(16) NULL,
			byte_size bigint(20) unsigned NOT NULL DEFAULT 0,
			file_hash char(64) NULL,
			state varchar(24) NOT NULL DEFAULT 'intent',
			scanner_result varchar(64) NULL,
			cart_key varchar(64) NULL,
			order_id bigint(20) unsigned NULL,
			expires_at_gmt datetime NOT NULL,
			created_at_gmt datetime NOT NULL,
			updated_at_gmt datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY uuid (uuid),
			KEY owner_session (owner_user_id,session_hash),
			KEY state_expiry (state,expires_at_gmt),
			KEY order_id (order_id)
		) {$collate};";

		$sql[] = "CREATE TABLE {$saved} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			uuid char(36) NOT NULL,
			owner_user_id bigint(20) unsigned NULL,
			session_hash char(64) NOT NULL DEFAULT '',
			product_id bigint(20) unsigned NOT NULL,
			variation_id bigint(20) unsigned NOT NULL DEFAULT 0,
			revision_uuid char(36) NOT NULL,
			revision_hash char(64) NOT NULL,
			name varchar(191) NOT NULL,
			selection_json longtext NOT NULL,
			preview_json longtext NULL,
			share_token_hash char(64) NULL,
			share_expires_at_gmt datetime NULL,
			share_revoked tinyint(1) NOT NULL DEFAULT 0,
			created_at_gmt datetime NOT NULL,
			updated_at_gmt datetime NOT NULL,
			last_used_at_gmt datetime NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY uuid (uuid),
			KEY owner_date (owner_user_id,updated_at_gmt),
			KEY product_id (product_id),
			KEY share_token (share_token_hash),
			KEY share_expiry (share_expires_at_gmt)
		) {$collate};";

		$sql[] = "CREATE TABLE {$analytics} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			metric_date date NOT NULL,
			product_id bigint(20) unsigned NOT NULL DEFAULT 0,
			option_set_uuid char(36) NOT NULL DEFAULT '',
			revision_uuid char(36) NOT NULL DEFAULT '',
			field_uuid char(36) NOT NULL DEFAULT '',
			choice_uuid char(36) NOT NULL DEFAULT '',
			metric_key varchar(64) NOT NULL,
			count_value bigint(20) unsigned NOT NULL DEFAULT 0,
			revenue_minor bigint(20) NOT NULL DEFAULT 0,
			currency varchar(3) NOT NULL DEFAULT '',
			PRIMARY KEY  (id),
			UNIQUE KEY metric_dimension (metric_date,product_id,option_set_uuid,revision_uuid,field_uuid,choice_uuid,metric_key,currency),
			KEY metric_date_key (metric_date,metric_key),
			KEY product_date (product_id,metric_date)
		) {$collate};";

		foreach ($sql as $statement) {
			dbDelta($statement);
		}
	}
}
