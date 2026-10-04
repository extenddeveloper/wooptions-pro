namespace WooptionsFic {
  export type UUID = string;
  export type OptionSetStatus = 'active' | 'inactive' | 'archived';
  export type RevisionState = 'draft' | 'published';
  export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict';
  export type PreviewDevice = 'desktop' | 'tablet' | 'mobile';
  export type InspectorTab = 'content' | 'choices' | 'pricing' | 'logic' | 'style' | 'advanced';
  export type AssignmentType = 'global' | 'product' | 'variation' | 'category' | 'tag' | 'product_type';

  export interface AdminBootstrap {
    restRoot: string;
    nonce: string;
    version: string;
    initialRoute: string;
    fieldTypes: Record<string, FieldTypeManifest>;
    palettes: Record<string, PalettePreset>;
    fontCatalog?: FontCatalogItem[];
    settings: Record<string, unknown>;
    wooAvailable: boolean;
    currentUser: { id: number; name: string };
    urls: { products: string; siteHealth: string };
    pluginUrl?: string;
    assetsUrl?: string;
  }

  export interface FontCatalogItem {
    id: string;
    name: string;
    family: string;
    googleParam?: string | null;
    category: string;
    source: 'google' | 'system' | 'custom';
  }

  export interface FieldTypeManifest {
    group: string;
    label: string;
    multiple?: boolean;
    value?: string;
  }

  export interface PalettePreset {
    name: string;
    tokens: Record<string, string>;
  }

  export interface PricingDefinition {
    strategy: 'none' | 'fixed' | 'percentage' | 'per_character' | 'per_unit' | 'setup' | 'tiered' | 'formula' | 'product_linked';
    amount: string;
    percent: string;
    mode: 'adjustment' | 'unit_price';
    expression?: string;
    tiers?: Array<{ min: string; amount: string }>;
  }

  export interface ProductVariationInfo {
    id: number;
    label: string;
    price: string;
    regularPrice: string;
    salePrice: string;
    image: string;
    attributes: Record<string, string>;
  }

  export interface ChoiceDefinition {
    uuid: UUID;
    label: string;
    description: string;
    adminLabel: string;
    color: string;
    imageId: number;
    imageUrl: string;
    disabled: boolean;
    default: boolean;
    pricing: PricingDefinition;
    quantityEnabled: boolean;
    linkedProductId: number;
    linkedVariationId: number;
    linkedQuantity: number;
    preview: Record<string, unknown>;
    // Product field specific
    productId?: number;
    isVariable?: boolean;
    selectedVariationIds?: number[];
    productInfo?: {
      price: string;
      regularPrice: string;
      salePrice: string;
      image: string;
      isVariable: boolean;
      variations: ProductVariationInfo[];
    };
    // Font field specific
    fontFamily?: string;
    fontCategory?: string;
    fontSource?: 'google' | 'system' | 'custom';
  }

  export interface ConditionLeaf {
    type: 'field';
    fieldUuid: UUID;
    operator: string;
    value: unknown;
  }

  export interface ConditionGroup {
    type: 'all' | 'any';
    conditions: Condition[];
  }

  export type Condition = ConditionLeaf | ConditionGroup;

  export interface RuleAction {
    type: 'show' | 'hide' | 'enable' | 'disable' | 'require' | 'optional' | 'help';
    target: UUID;
    value?: string;
  }

  export interface RuleDefinition {
    uuid: UUID;
    name: string;
    condition: Condition;
    actions: RuleAction[];
  }

  export interface FieldDefinition {
    uuid: UUID;
    type: string;
    label: string;
    description: string;
    required: boolean;
    disabled: boolean;
    default: unknown;
    validation: Record<string, unknown>;
    pricing: PricingDefinition;
    conditions: Record<string, unknown>;
    style: Record<string, unknown>;
    preview: Record<string, unknown>;
    help: string;
    helpTextPosition?: 'below_title' | 'tooltip' | 'below_field';
    width?: string;
    height?: number | string;
    color?: string;
    content?: string;
    buttonText?: string;
    buttonStyle?: 'primary' | 'secondary' | 'outline' | 'link';
    modalTitle?: string;
    flagStyle?: 'number_only' | 'number_flag' | 'number_flag_dialcode';
    defaultCountry?: string;
    dateTimeType?: 'date' | 'datetime' | 'time';
    dateFormat?: string;
    minDateType?: 'none' | 'current_day' | 'custom';
    minDateCustom?: string;
    maxDateType?: 'none' | 'current_day' | 'custom';
    maxDateCustom?: string;
    disableToday?: boolean;
    disableNextNDays?: number;
    disabledDates?: string[];
    disabledWeekdays?: number[];
    disabledMonthlyDays?: string;
    minTime?: string;
    maxTime?: string;
    timeFormat?: '12' | '24';
    minDays?: number;
    maxDays?: number;
    allowSameDay?: boolean;
    choiceWidth?: string | number;
    choiceHeight?: string | number;
    choiceBorderRadius?: string | number;
    enableQuantity?: boolean;
    minQuantity?: number;
    maxQuantity?: number;
    placeholder?: string;
    enableMinMax?: boolean;
    enablePostfix?: boolean;
    postfix?: string;
    min?: string | null;
    max?: string | null;
    step?: string | null;
    minLength?: number;
    maxLength?: number;
    textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
    rows?: number;
    privacyMode?: boolean;
    choices?: ChoiceDefinition[];
    multiple?: boolean;
    minChoices?: number;
    maxChoices?: number;
    updateProductImage?: boolean;
    allowedExtensions?: string[];
    maxFiles?: number;
    maxFileMb?: number;
    expression?: string;
    displayMode?: 'number' | 'currency' | 'text';
    decimalPlaces?: number;
    prefix?: string;
    suffix?: string;
    hideWhenZero?: boolean;
    displayDirection?: 'horizontal' | 'vertical';
    columns?: 'one' | 'two' | 1 | 2;
    imageStyle?: 'normal' | 'circle' | 'default' | 'overlay' | 'only_image';
    mergeVariationProducts?: boolean;
    children?: FieldDefinition[];
    minRows?: number;
    maxRows?: number;
    appliedFields?: UUID[];
    sectionStyle?: 'section' | 'accordion' | 'blank';
    initialState?: 'open' | 'close';
    repeatable?: boolean;
    repeatMethod?: 'button' | 'quantity';
    repeatLabel?: string;
    repeatPriceType?: 'none' | 'fixed' | 'percentage';
    repeatRegularPrice?: string;
    repeatSalePrice?: string;
    buttonLabel?: string;
    maxRepeats?: number;
    minRepeats?: number;
    hideSectionTitle?: boolean;
  }

  export interface TypographyDefinition {
    family: string;
    labelWeight?: number;
    bodyWeight?: number;
    fontSize?: number;
    lineHeight?: number;
  }

  export interface OptionSetDefinition {
    schemaVersion: number;
    setUuid: UUID;
    revisionUuid: UUID;
    title: string;
    layout: { type: 'stack' | 'inline' | 'grid' | 'accordion' | 'tabs' | 'wizard'; settings: Record<string, unknown> };
    fields: FieldDefinition[];
    rules: RuleDefinition[];
    pricing: unknown[];
    preview: { baseImageId?: number; assets?: unknown[]; layers: unknown[]; bindings: unknown[] };
    style: { palette: string; overrides: Record<string, string>; typography: TypographyDefinition };
    settings: {
      showPriceBreakdown: boolean;
      saveEnabled: boolean;
      shareEnabled: boolean;
      stickySummary: boolean;
    };
  }

  export interface ValidationIssue {
    code: string;
    path?: string;
    fieldUuid?: UUID;
    detail?: string;
    [key: string]: unknown;
  }

  export interface RevisionRecord {
    id: number;
    uuid: UUID;
    optionSetId: number;
    revisionNumber: number;
    parentRevisionId: number | null;
    state: RevisionState;
    schemaVersion: number;
    compilerVersion: string;
    definition?: OptionSetDefinition;
    compiled?: Record<string, unknown> | null;
    contentHash: string;
    validationSummary: { valid: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[] };
    versionNote: string;
    createdAtGmt: string;
    createdBy?: number;
  }

  export interface OptionSetRecord {
    id: number;
    uuid: UUID;
    title: string;
    slug: string;
    status: OptionSetStatus;
    priority: number;
    draftRevisionId: number | null;
    publishedRevisionId: number | null;
    fieldCount?: number;
    createdAtGmt: string;
    updatedAtGmt: string;
    currentRevision?: RevisionRecord;
    publishedRevision?: RevisionRecord | null;
  }

  export interface OptionSetCollection {
    items: OptionSetRecord[];
    total: number;
    page: number;
    perPage: number;
  }

  export interface AssignmentRecord {
    id?: number;
    uuid?: UUID;
    optionSetUuid?: UUID;
    targetType: AssignmentType;
    targetId: number | null;
    mode: 'include' | 'exclude';
    priority: number;
    context?: Record<string, unknown>;
    targetLabel?: string;
    targetMeta?: string;
    targetImage?: string;
  }

  export interface AssignmentTarget {
    id: number;
    type: 'product' | 'variation' | 'category' | 'tag';
    label: string;
    meta: string;
    image: string;
  }

  export interface TemplateRecord {
    slug: string;
    name: string;
    level?: string;
    description: string;
    category: string;
    categoryLabel?: string;
    fieldCount?: number;
    fieldsCount?: number;
    rulesCount?: number;
    pricingModel?: string;
    layoutModel?: string;
    tested?: boolean;
    previewImage: string;
    heroImage?: string;
    features?: string[];
    details?: Record<string, string>;
    footerIcons?: string[];
    fieldTypes?: string[];
    usage?: number;
    popularity?: number;
    order?: number;
    previewUrl?: string;
    preview?: Record<string, unknown>;
  }

  export interface BuilderState {
    optionSet: OptionSetRecord | null;
    document: OptionSetDefinition | null;
    selectedUuid: UUID | null;
    inspectorTab: InspectorTab;
    device: PreviewDevice;
    saveStatus: SaveStatus;
    dirty: boolean;
    history: OptionSetDefinition[];
    future: OptionSetDefinition[];
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
  }
}
