<?php
/**
 * Expected missing-resource error.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Application;

use RuntimeException;

final class NotFoundException extends RuntimeException {
}
