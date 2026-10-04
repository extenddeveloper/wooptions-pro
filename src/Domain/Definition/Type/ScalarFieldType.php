<?php
/**
 * Scalar field type.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Domain\Definition\Type;

use DateTimeImmutable;

final class ScalarFieldType extends AbstractFieldType {
	public function __construct(
		private readonly string $type_key,
		private readonly string $value_kind = 'string'
	) {
	}

	public function key(): string {
		return $this->type_key;
	}

	public function normalize_definition(array $definition): array {
		$normalized = $this->base_definition($definition);
		$normalized['placeholder'] = self::plain_text((string) ($definition['placeholder'] ?? ''), 200);
		$enable_min_max            = ! empty($definition['enableMinMax']) || (! isset($definition['enableMinMax']) && (isset($definition['min']) || isset($definition['max'])));
		$normalized['enableMinMax'] = $enable_min_max;
		$normalized['min']         = $enable_min_max ? $this->decimal_or_null($definition['min'] ?? null) : null;
		$normalized['max']         = $enable_min_max ? $this->decimal_or_null($definition['max'] ?? null) : null;
		$normalized['step']        = $this->decimal_or_null($definition['step'] ?? null);
		if (isset($definition['default'])) {
			$normalized['default'] = self::plain_text((string) $definition['default'], 200);
		}
		$normalized['minLength']   = max(0, min(10000, (int) ($definition['minLength'] ?? 0)));
		$normalized['maxLength']   = max(0, min(10000, (int) ($definition['maxLength'] ?? 0)));
		$text_transform            = (string) ($definition['textTransform'] ?? 'none');
		$normalized['textTransform'] = in_array($text_transform, ['none', 'uppercase', 'lowercase', 'capitalize'], true) ? $text_transform : 'none';
		if ('textarea' === $this->type_key) {
			$normalized['rows'] = max(1, min(100, (int) ($definition['rows'] ?? 4)));
		}
		$normalized['privacyMode'] = 'secret' === $this->value_kind;
		if ('tel' === $this->type_key) {
			$flag_style = (string) ($definition['flagStyle'] ?? 'number_only');
			$normalized['flagStyle']      = in_array($flag_style, ['number_only', 'number_flag', 'number_flag_dialcode'], true) ? $flag_style : 'number_only';
			$normalized['defaultCountry'] = self::plain_text((string) ($definition['defaultCountry'] ?? 'US'), 10);
		}
		if ('range' === $this->type_key) {
			$normalized['enablePostfix'] = ! empty($definition['enablePostfix']);
			$normalized['postfix']       = self::plain_text((string) ($definition['postfix'] ?? 'PostFix'), 50);
			if (null === $normalized['min'] || '' === $normalized['min']) {
				$normalized['min'] = '1';
			}
			if (null === $normalized['max'] || '' === $normalized['max']) {
				$normalized['max'] = '100';
			}
			if (null === $normalized['step'] || '' === $normalized['step']) {
				$normalized['step'] = '1';
			}
			if (! isset($normalized['default']) || '' === $normalized['default']) {
				$normalized['default'] = '10';
			}
		}
		if (in_array($this->type_key, ['datetime', 'date', 'time', 'date_range'], true)) {
			$date_time_type = (string) ($definition['dateTimeType'] ?? ('time' === $this->type_key ? 'time' : 'date'));
			$normalized['dateTimeType']        = in_array($date_time_type, ['date', 'datetime', 'time'], true) ? $date_time_type : 'date';
			$normalized['dateFormat']          = self::plain_text((string) ($definition['dateFormat'] ?? 'DD/MM/YYYY'), 50);
			$min_date_type                     = (string) ($definition['minDateType'] ?? 'none');
			$normalized['minDateType']         = in_array($min_date_type, ['none', 'current_day', 'custom'], true) ? $min_date_type : 'none';
			$normalized['minDateCustom']       = self::plain_text((string) ($definition['minDateCustom'] ?? ''), 50);
			$max_date_type                     = (string) ($definition['maxDateType'] ?? 'none');
			$normalized['maxDateType']         = in_array($max_date_type, ['none', 'current_day', 'custom'], true) ? $max_date_type : 'none';
			$normalized['maxDateCustom']       = self::plain_text((string) ($definition['maxDateCustom'] ?? ''), 50);
			$normalized['disableToday']        = ! empty($definition['disableToday']);
			$normalized['disableNextNDays']    = max(0, (int) ($definition['disableNextNDays'] ?? 0));
			$disabled_dates                    = is_array($definition['disabledDates'] ?? null) ? $definition['disabledDates'] : [];
			$normalized['disabledDates']       = array_values(array_filter(array_map(fn ($d) => self::plain_text((string) $d, 50), $disabled_dates)));
			$disabled_weekdays                 = is_array($definition['disabledWeekdays'] ?? null) ? $definition['disabledWeekdays'] : [];
			$normalized['disabledWeekdays']    = array_values(array_filter(array_map('intval', $disabled_weekdays), fn ($w) => $w >= 0 && $w <= 6));
			$normalized['disabledMonthlyDays'] = self::plain_text((string) ($definition['disabledMonthlyDays'] ?? ''), 100);
			$normalized['minTime']             = self::plain_text((string) ($definition['minTime'] ?? ''), 20);
			$normalized['maxTime']             = self::plain_text((string) ($definition['maxTime'] ?? ''), 20);
			$time_format                       = (string) ($definition['timeFormat'] ?? '12');
			$normalized['timeFormat']          = in_array($time_format, ['12', '24'], true) ? $time_format : '12';
			$normalized['minDays']             = max(0, (int) ($definition['minDays'] ?? 0));
			$normalized['maxDays']             = max(0, (int) ($definition['maxDays'] ?? 0));
			$normalized['allowSameDay']        = ! isset($definition['allowSameDay']) || ! empty($definition['allowSameDay']);
		}
		return $normalized;
	}

	public function normalize_value(mixed $value, array $definition): mixed {
		if (is_array($value) && 'date_range' !== $this->value_kind) {
			if ('tel' === $this->value_kind) {
				$num = (string) ($value['number'] ?? '');
				if ('' === trim($num)) {
					return '';
				}
				$dial = (string) ($value['dial'] ?? '');
				$country = strtoupper(trim((string) ($value['country'] ?? '')));
				if ('' === $dial && '' !== $country) {
					$definitions = self::country_definitions();
					$dial = $definitions[$country]['dial'] ?? '';
				}
				$clean_dial = preg_replace('/[^\d+]/', '', $dial) ?? '';
				$clean_num  = preg_replace('/[^\d().\-\s]/', '', $num) ?? '';
				return trim($clean_dial . ' ' . $clean_num);
			}
			return '';
		}

		return match ($this->value_kind) {
			'integer'    => $this->normalize_integer($value),
			'decimal'    => $this->normalize_decimal($value),
			'email'      => strtolower(trim((string) $value)),
			'url'        => trim((string) $value),
			'tel'        => preg_replace('/[^\d+().\-\s]/u', '', (string) $value) ?? '',
			'date'       => trim((string) $value),
			'time'       => trim((string) $value),
			'datetime'   => trim((string) $value),
			'date_range' => $this->normalize_date_range($value),
			'color'      => $this->normalize_color((string) $value),
			default      => $this->normalize_string($value, $definition),
		};
	}

	public function validate(mixed $value, array $definition): array {
		$errors = [];
		$empty  = null === $value || '' === $value || ([] === $value)
			|| ('date_range' === $this->value_kind && is_array($value) && '' === trim((string) ($value['start'] ?? '')) && '' === trim((string) ($value['end'] ?? '')));
		if (! empty($definition['required']) && $empty) {
			return [['code' => 'required', 'params' => []]];
		}
		if ($empty) {
			return [];
		}

		return match ($this->value_kind) {
			'email'      => $this->validate_email((string) $value),
			'url'        => $this->validate_url((string) $value),
			'integer'    => $this->validate_number((string) $value, $definition, true),
			'decimal'    => $this->validate_number((string) $value, $definition, false),
			'tel'        => $this->validate_phone($value, $definition),
			'date'       => $this->validate_datetime_field((string) $value, $definition),
			'time'       => $this->validate_datetime_field((string) $value, $definition),
			'datetime'   => $this->validate_datetime_field((string) $value, $definition),
			'date_range' => $this->validate_date_range(is_array($value) ? $value : [], $definition),
			'color'      => $this->validate_color((string) $value),
			default      => $this->validate_string((string) $value, $definition),
		};
	}

	public function format_value(mixed $value, array $definition): string {
		if ('date_range' === $this->value_kind && is_array($value)) {
			$start = trim((string) ($value['start'] ?? ''));
			$end   = trim((string) ($value['end'] ?? ''));
			if ('' === $start && '' === $end) {
				return '';
			}
			return trim($start . ' → ' . $end);
		}
		return is_scalar($value) ? (string) $value : '';
	}

	public function accepts_customer_value(): bool {
		return true;
	}

	private function decimal_or_null(mixed $value): ?string {
		if (null === $value || '' === $value || ! is_numeric($value)) {
			return null;
		}
		return (string) round((float) $value, 4);
	}

	private function normalize_string(mixed $value, array $definition): string {
		$max       = (int) ($definition['maxLength'] ?? 0);
		$text      = self::plain_text((string) $value, $max > 0 ? $max : 5000);
		$transform = (string) ($definition['textTransform'] ?? 'none');
		if ('uppercase' === $transform) {
			$text = mb_strtoupper($text);
		} elseif ('lowercase' === $transform) {
			$text = mb_strtolower($text);
		} elseif ('capitalize' === $transform) {
			$text = mb_convert_case($text, MB_CASE_TITLE, 'UTF-8');
		}
		return $text;
	}

	private function normalize_integer(mixed $value): string {
		if (is_numeric($value)) {
			return (string) (int) $value;
		}
		return '';
	}

	private function normalize_decimal(mixed $value): string {
		if (! is_numeric($value)) {
			return '';
		}
		return (string) round((float) $value, 4);
	}

	private function normalize_date_range(mixed $value): array {
		if (! is_array($value)) {
			return ['start' => '', 'end' => ''];
		}
		return [
			'start' => trim((string) ($value['start'] ?? '')),
			'end'   => trim((string) ($value['end'] ?? '')),
		];
	}

	private function validate_email(string $value): array {
		return is_email($value) ? [] : [['code' => 'invalid_email', 'params' => []]];
	}

	private function validate_url(string $value): array {
		return 1 === preg_match('/\Ahttps?:\/\/[^\s<>"#%{}|\\^~`]+\z/i', $value)
			? []
			: [['code' => 'invalid_url', 'params' => []]];
	}

	private function validate_number(string $value, array $definition, bool $integer_only): array {
		$errors = [];
		if ($integer_only && 1 !== preg_match('/\A-?\d+\z/', $value)) {
			return [['code' => 'invalid_number', 'params' => []]];
		}
		if (! is_numeric($value)) {
			return [['code' => 'invalid_number', 'params' => []]];
		}
		$numeric = (float) $value;
		$check_min_max = ! isset($definition['enableMinMax']) || ! empty($definition['enableMinMax']);
		if ($check_min_max && null !== ($definition['min'] ?? null) && $numeric < (float) $definition['min']) {
			$errors[] = ['code' => 'below_minimum', 'params' => ['minimum' => (string) $definition['min']]];
		}
		if ($check_min_max && null !== ($definition['max'] ?? null) && $numeric > (float) $definition['max']) {
			$errors[] = ['code' => 'above_maximum', 'params' => ['maximum' => (string) $definition['max']]];
		}
		return $errors;
	}

	private function validate_datetime_field(string $value, array $definition): array {
		$type = (string) ($definition['dateTimeType'] ?? ('time' === $this->type_key ? 'time' : 'date'));
		if ('time' === $type) {
			return $this->validate_time($value);
		}
		if ('date' === $type) {
			return $this->validate_date($value);
		}
		return $this->validate_datetime($value);
	}

	private function validate_date(string $value): array {
		if (false !== DateTimeImmutable::createFromFormat('Y-m-d', $value)) {
			return [];
		}
		try {
			new DateTimeImmutable($value);
			return [];
		} catch (\Exception) {
			return [['code' => 'invalid_date', 'params' => []]];
		}
	}

	private function validate_time(string $value): array {
		if (1 === preg_match('/\A\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?\z/i', $value)) {
			return [];
		}
		return [['code' => 'invalid_time', 'params' => []]];
	}

	private function validate_datetime(string $value): array {
		if (1 === preg_match('/\A\d{4}-\d{2}-\d{2}[T ]\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?\z/i', $value)) {
			return [];
		}
		try {
			new DateTimeImmutable($value);
			return [];
		} catch (\Exception) {
			return [['code' => 'invalid_datetime', 'params' => []]];
		}
	}

	private function validate_date_range(array $value, array $definition = []): array {
		$start = trim((string) ($value['start'] ?? ''));
		$end   = trim((string) ($value['end'] ?? ''));
		if ('' === $start && '' === $end) {
			return ! empty($definition['required']) ? [['code' => 'required', 'params' => []]] : [];
		}
		if ('' === $start || '' === $end) {
			return [['code' => 'incomplete_date_range', 'params' => []]];
		}
		$d_start = DateTimeImmutable::createFromFormat('Y-m-d', $start);
		$d_end   = DateTimeImmutable::createFromFormat('Y-m-d', $end);
		if (! $d_start || ! $d_end) {
			return [['code' => 'invalid_date_range', 'params' => []]];
		}
		if ($d_end < $d_start) {
			return [['code' => 'invalid_date_range_order', 'params' => []]];
		}
		$allow_same_day = ! isset($definition['allowSameDay']) || ! empty($definition['allowSameDay']);
		if (! $allow_same_day && $start === $end) {
			return [['code' => 'same_day_not_allowed', 'params' => []]];
		}
		$interval = $d_start->diff($d_end);
		$days     = (int) $interval->days + 1;
		$min_days = (int) ($definition['minDays'] ?? 0);
		if ($min_days > 0 && $days < $min_days) {
			return [['code' => 'date_range_too_short', 'params' => ['min' => (string) $min_days]]];
		}
		$max_days = (int) ($definition['maxDays'] ?? 0);
		if ($max_days > 0 && $days > $max_days) {
			return [['code' => 'date_range_too_long', 'params' => ['max' => (string) $max_days]]];
		}
		return [];
	}

	private function normalize_color(string $value): string {
		$v = strtoupper(trim($value));
		if ('' === $v) {
			return '';
		}
		if (! str_starts_with($v, '#')) {
			$v = '#' . $v;
		}
		if (1 === preg_match('/\A#([0-9A-F])([0-9A-F])([0-9A-F])\z/', $v, $m)) {
			return '#' . $m[1] . $m[1] . $m[2] . $m[2] . $m[3] . $m[3];
		}
		return $v;
	}

	private function validate_color(string $value): array {
		return 1 === preg_match('/\A#[0-9A-F]{6}\z/', $value)
			? []
			: [['code' => 'invalid_color', 'params' => []]];
	}

	private function validate_string(string $value, array $definition): array {
		$errors = [];
		$min    = (int) ($definition['minLength'] ?? 0);
		$max    = (int) ($definition['maxLength'] ?? 0);
		$length = mb_strlen($value);
		if ($min > 0 && $length < $min) {
			$errors[] = ['code' => 'too_short', 'params' => ['minimum' => $min]];
		}
		if ($max > 0 && $length > $max) {
			$errors[] = ['code' => 'too_long', 'params' => ['maximum' => $max]];
		}
		return $errors;
	}

	/**
	 * Supported countries with dial codes and national significant number digit constraints.
	 *
	 * @return array<string,array{name:string,dial:string,min:int,max:int}>
	 */
	public static function country_definitions(): array {
		return [
			'US' => ['name' => 'United States', 'dial' => '+1', 'min' => 10, 'max' => 10],
			'GB' => ['name' => 'United Kingdom', 'dial' => '+44', 'min' => 10, 'max' => 11],
			'CA' => ['name' => 'Canada', 'dial' => '+1', 'min' => 10, 'max' => 10],
			'AU' => ['name' => 'Australia', 'dial' => '+61', 'min' => 9, 'max' => 10],
			'DE' => ['name' => 'Germany', 'dial' => '+49', 'min' => 10, 'max' => 11],
			'FR' => ['name' => 'France', 'dial' => '+33', 'min' => 9, 'max' => 10],
			'IT' => ['name' => 'Italy', 'dial' => '+39', 'min' => 9, 'max' => 10],
			'ES' => ['name' => 'Spain', 'dial' => '+34', 'min' => 9, 'max' => 9],
			'NL' => ['name' => 'Netherlands', 'dial' => '+31', 'min' => 9, 'max' => 10],
			'BR' => ['name' => 'Brazil', 'dial' => '+55', 'min' => 10, 'max' => 11],
			'IN' => ['name' => 'India', 'dial' => '+91', 'min' => 10, 'max' => 10],
			'CN' => ['name' => 'China', 'dial' => '+86', 'min' => 11, 'max' => 11],
			'JP' => ['name' => 'Japan', 'dial' => '+81', 'min' => 10, 'max' => 11],
			'KR' => ['name' => 'South Korea', 'dial' => '+82', 'min' => 9, 'max' => 11],
			'MX' => ['name' => 'Mexico', 'dial' => '+52', 'min' => 10, 'max' => 10],
			'AE' => ['name' => 'United Arab Emirates', 'dial' => '+971', 'min' => 9, 'max' => 9],
			'SA' => ['name' => 'Saudi Arabia', 'dial' => '+966', 'min' => 9, 'max' => 9],
			'SG' => ['name' => 'Singapore', 'dial' => '+65', 'min' => 8, 'max' => 8],
			'BD' => ['name' => 'Bangladesh', 'dial' => '+880', 'min' => 10, 'max' => 11],
			'PK' => ['name' => 'Pakistan', 'dial' => '+92', 'min' => 10, 'max' => 11],
			'ZA' => ['name' => 'South Africa', 'dial' => '+27', 'min' => 9, 'max' => 10],
			'TR' => ['name' => 'Turkey', 'dial' => '+90', 'min' => 10, 'max' => 10],
			'SE' => ['name' => 'Sweden', 'dial' => '+46', 'min' => 9, 'max' => 10],
			'CH' => ['name' => 'Switzerland', 'dial' => '+41', 'min' => 9, 'max' => 9],
			'PL' => ['name' => 'Poland', 'dial' => '+48', 'min' => 9, 'max' => 9],
			'AR' => ['name' => 'Argentina', 'dial' => '+54', 'min' => 10, 'max' => 10],
			'BE' => ['name' => 'Belgium', 'dial' => '+32', 'min' => 9, 'max' => 9],
			'AT' => ['name' => 'Austria', 'dial' => '+43', 'min' => 10, 'max' => 11],
			'NO' => ['name' => 'Norway', 'dial' => '+47', 'min' => 8, 'max' => 8],
			'DK' => ['name' => 'Denmark', 'dial' => '+45', 'min' => 8, 'max' => 8],
			'FI' => ['name' => 'Finland', 'dial' => '+358', 'min' => 9, 'max' => 10],
			'IE' => ['name' => 'Ireland', 'dial' => '+353', 'min' => 9, 'max' => 9],
			'NZ' => ['name' => 'New Zealand', 'dial' => '+64', 'min' => 8, 'max' => 10],
			'PT' => ['name' => 'Portugal', 'dial' => '+351', 'min' => 9, 'max' => 9],
			'GR' => ['name' => 'Greece', 'dial' => '+30', 'min' => 10, 'max' => 10],
			'IL' => ['name' => 'Israel', 'dial' => '+972', 'min' => 9, 'max' => 10],
			'HK' => ['name' => 'Hong Kong', 'dial' => '+852', 'min' => 8, 'max' => 8],
			'MY' => ['name' => 'Malaysia', 'dial' => '+60', 'min' => 9, 'max' => 10],
			'PH' => ['name' => 'Philippines', 'dial' => '+63', 'min' => 10, 'max' => 10],
			'ID' => ['name' => 'Indonesia', 'dial' => '+62', 'min' => 10, 'max' => 12],
			'TH' => ['name' => 'Thailand', 'dial' => '+66', 'min' => 9, 'max' => 10],
			'VN' => ['name' => 'Vietnam', 'dial' => '+84', 'min' => 9, 'max' => 10],
			'EG' => ['name' => 'Egypt', 'dial' => '+20', 'min' => 10, 'max' => 10],
			'NG' => ['name' => 'Nigeria', 'dial' => '+234', 'min' => 10, 'max' => 11],
			'KE' => ['name' => 'Kenya', 'dial' => '+254', 'min' => 9, 'max' => 10],
		];
	}

	/**
	 * @param mixed $value
	 * @param array<string,mixed> $definition
	 * @return list<array{code:string,params:array<string,mixed>}>
	 */
	private function validate_phone(mixed $value, array $definition): array {
		$str = trim((string) $value);
		if ('' === $str) {
			return [];
		}

		// Must contain only digits, spaces, parentheses, hyphens, dots, and optional leading +.
		if (! preg_match('/^\+?[\d\s().\-]+$/u', $str)) {
			return [['code' => 'invalid_phone', 'params' => []]];
		}

		$definitions = self::country_definitions();
		$country     = null;
		$national    = $str;

		if (str_starts_with($str, '+')) {
			$matched_dial = '';
			foreach ($definitions as $code => $info) {
				$dial = $info['dial'];
				if (str_starts_with($str, $dial) && strlen($dial) > strlen($matched_dial)) {
					$matched_dial = $dial;
					$country      = $code;
				}
			}
			if ('' !== $matched_dial) {
				$national = substr($str, strlen($matched_dial));
			}
		}

		if (null === $country) {
			$country = strtoupper((string) ($definition['defaultCountry'] ?? 'US'));
		}

		$digits = preg_replace('/\D/', '', $national) ?? '';
		$len    = strlen($digits);

		$rule = $definitions[$country] ?? ['min' => 7, 'max' => 15, 'name' => 'International'];
		if ($len < $rule['min'] || $len > $rule['max']) {
			return [
				[
					'code'   => 'invalid_phone_digits',
					'params' => [
						'country'     => $country,
						'countryName' => $rule['name'],
						'min'         => $rule['min'],
						'max'         => $rule['max'],
						'actual'      => $len,
					],
				],
			];
		}

		if (! empty($definition['minLength']) && $len < (int) $definition['minLength']) {
			return [['code' => 'too_short', 'params' => ['minimum' => (int) $definition['minLength']]]];
		}

		if (! empty($definition['maxLength']) && $len > (int) $definition['maxLength']) {
			return [['code' => 'too_long', 'params' => ['maximum' => (int) $definition['maxLength']]]];
		}

		return [];
	}
}
