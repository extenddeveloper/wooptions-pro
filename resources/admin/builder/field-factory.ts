namespace WooptionsFic.FieldFactory {
  const choiceTypes = new Set(['select', 'radio', 'checkbox_group', 'segmented', 'color_swatch', 'image_swatch', 'product', 'font']);

  export function emptyPricing(): WooptionsFic.PricingDefinition {
    return { strategy: 'none', amount: '0', percent: '0', mode: 'adjustment' };
  }

  export function choice(label: string, index = 0): WooptionsFic.ChoiceDefinition {
    return {
      uuid: WooptionsFic.Utils.uuid(),
      label,
      description: '',
      adminLabel: '',
      color: index === 0 ? '#5B4FF5' : index === 1 ? '#0F766E' : '#64748B',
      imageId: 0,
      imageUrl: '',
      disabled: false,
      default: index === 0,
      pricing: emptyPricing(),
      quantityEnabled: false,
      linkedProductId: 0,
      linkedVariationId: 0,
      linkedQuantity: 1,
      preview: {},
    };
  }

  export function create(type: string): WooptionsFic.FieldDefinition {
    const manifest = window.WooptionsFicAdmin.fieldTypes[type];
    const label = manifest?.label ?? 'Field';
    const field: WooptionsFic.FieldDefinition = {
      uuid: WooptionsFic.Utils.uuid(),
      type,
      label,
      description: '',
      required: false,
      disabled: false,
      default: null,
      validation: {},
      pricing: emptyPricing(),
      conditions: {},
      style: {},
      preview: {},
      help: '',
      helpTextPosition: 'below_title',
      width: '100%',
    };

    if (choiceTypes.has(type)) {
      field.choices = type === 'product' ? [] : [choice('Choice 1', 0), choice('Choice 2', 1), choice('Choice 3', 2)];
      field.multiple = Boolean(manifest?.multiple);
      field.minChoices = 0;
      field.maxChoices = 0;
      field.choiceWidth = '';
      field.choiceHeight = '';
      field.choiceBorderRadius = '';
      field.enableQuantity = false;
      field.minQuantity = 1;
      field.maxQuantity = 100;
      if (type === 'image_swatch') field.updateProductImage = false;
      if (['radio', 'checkbox_group', 'select'].includes(type)) {
        field.columns = 'one';
        field.imageStyle = 'normal';
      }
      if (['product', 'image_swatch', 'color_swatch'].includes(type)) {
        field.imageStyle = 'default';
      }
      if (type === 'product') {
        field.mergeVariationProducts = false;
      }
      if (type === 'font') {
        field.appliedFields = [];
        field.placeholder = 'Choose a font...';
        field.choices = [
          {
            uuid: WooptionsFic.Utils.uuid(),
            label: 'Roboto',
            description: '',
            adminLabel: '',
            color: '',
            imageId: 0,
            imageUrl: '',
            disabled: false,
            default: true,
            pricing: emptyPricing(),
            quantityEnabled: false,
            linkedProductId: 0,
            linkedVariationId: 0,
            linkedQuantity: 1,
            preview: {},
            fontFamily: 'Roboto, sans-serif',
            fontCategory: 'Sans-Serif',
            fontSource: 'google',
          },
          {
            uuid: WooptionsFic.Utils.uuid(),
            label: 'Playfair Display',
            description: '',
            adminLabel: '',
            color: '',
            imageId: 0,
            imageUrl: '',
            disabled: false,
            default: false,
            pricing: emptyPricing(),
            quantityEnabled: false,
            linkedProductId: 0,
            linkedVariationId: 0,
            linkedQuantity: 1,
            preview: {},
            fontFamily: "'Playfair Display', serif",
            fontCategory: 'Serif',
            fontSource: 'google',
          },
          {
            uuid: WooptionsFic.Utils.uuid(),
            label: 'Dancing Script',
            description: '',
            adminLabel: '',
            color: '',
            imageId: 0,
            imageUrl: '',
            disabled: false,
            default: false,
            pricing: emptyPricing(),
            quantityEnabled: false,
            linkedProductId: 0,
            linkedVariationId: 0,
            linkedQuantity: 1,
            preview: {},
            fontFamily: "'Dancing Script', cursive",
            fontCategory: 'Handwriting / Script',
            fontSource: 'google',
          },
          {
            uuid: WooptionsFic.Utils.uuid(),
            label: 'Pacifico',
            description: '',
            adminLabel: '',
            color: '',
            imageId: 0,
            imageUrl: '',
            disabled: false,
            default: false,
            pricing: emptyPricing(),
            quantityEnabled: false,
            linkedProductId: 0,
            linkedVariationId: 0,
            linkedQuantity: 1,
            preview: {},
            fontFamily: "'Pacifico', cursive",
            fontCategory: 'Handwriting / Script',
            fontSource: 'google',
          },
        ];
      }
      if (type === 'checkbox_group') {
        field.choices.forEach((c) => {
          c.default = false;
        });
      }
    }

    if (type === 'tel') {
      field.flagStyle = 'number_only';
      field.defaultCountry = 'US';
    }

    if (type === 'datetime' || type === 'date' || type === 'time') {
      field.dateTimeType = type === 'time' ? 'time' : 'date';
      field.dateFormat = 'DD/MM/YYYY';
      field.minDateType = 'none';
      field.minDateCustom = '';
      field.maxDateType = 'none';
      field.maxDateCustom = '';
      field.disableToday = false;
      field.disableNextNDays = 0;
      field.disabledDates = [];
      field.disabledWeekdays = [];
      field.disabledMonthlyDays = '';
      field.minTime = '12:00 AM';
      field.maxTime = '12:00 PM';
      field.timeFormat = '12';
    }

    if (type === 'date_range') {
      field.dateFormat = 'DD/MM/YYYY';
      field.minDateType = 'none';
      field.minDateCustom = '';
      field.maxDateType = 'none';
      field.maxDateCustom = '';
      field.disableToday = false;
      field.disableNextNDays = 0;
      field.disabledDates = [];
      field.disabledWeekdays = [];
      field.disabledMonthlyDays = '';
      field.minDays = 0;
      field.maxDays = 0;
      field.allowSameDay = true;
    }

    if (['text', 'textarea', 'tel', 'email', 'url', 'number', 'range', 'date', 'date_range', 'time', 'datetime', 'customer_defined_price', 'color_picker'].includes(type)) {
      field.placeholder = '';
      field.min = null;
      field.max = null;
      field.step = ['number', 'range', 'customer_defined_price'].includes(type) ? '1' : null;
      field.maxLength = 0;
    }

    if (type === 'text' || type === 'textarea') {
      field.minLength = 0;
      field.maxLength = 0;
      field.textTransform = 'none';
      if (type === 'textarea') {
        field.rows = 4;
      }
    }

    if (type === 'number') {
      field.enableMinMax = true;
      field.min = '1';
      field.max = '100';
      field.step = '1';
      field.default = '';
    }

    if (type === 'range') {
      field.enablePostfix = false;
      field.postfix = 'PostFix';
      field.min = '1';
      field.max = '100';
      field.step = '1';
      field.default = '10';
    }

    if (type === 'file') {
      field.allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf'];
      field.maxFiles = 1;
      field.maxFileMb = 5;
    }

    if (type === 'formula') {
      field.expression = '0';
      field.displayMode = 'currency';
      field.decimalPlaces = 2;
      field.prefix = '';
      field.suffix = '';
      field.hideWhenZero = false;
    }

    if (type === 'repeater') {
      field.label = 'Section Container';
      field.sectionStyle = 'section';
      field.initialState = 'open';
      field.repeatable = true;
      field.repeatMethod = 'button';
      field.repeatLabel = 'Item {n}';
      field.repeatPriceType = 'fixed';
      field.repeatRegularPrice = '3';
      field.repeatSalePrice = '';
      field.buttonLabel = 'Add Another';
      field.maxRepeats = 0;
      field.minRepeats = 1;
      field.children = [];
    }

    if (type === 'heading') {
      field.label = 'Section heading';
      field.help = '';
      field.helpTextPosition = 'below_title';
    }
    if (type === 'paragraph') {
      field.label = 'Paragraph';
      field.description = 'Add supporting product-option content here.';
      field.content = 'Add supporting product-option content here.';
      field.help = '';
    }
    if (type === 'help') {
      field.label = 'Help content';
      field.description = 'Helpful information for customers.';
      field.content = 'Helpful information for customers.';
      field.help = '';
    }
    if (type === 'spacer') {
      field.height = 24;
      field.style = { height: 24 };
    }
    if (type === 'separator') {
      field.height = 1;
      field.color = '#E2E8F0';
      field.style = { height: 1, color: '#E2E8F0' };
    }
    if (type === 'content') {
      field.label = 'Content';
      field.content = '<p>Add rich product description or information here.</p>';
    }
    if (type === 'modal') {
      field.label = 'Modal';
      field.buttonText = 'View details';
      field.modalTitle = 'Product Details';
      field.buttonStyle = 'outline';
      field.content = '<p>Add modal popup information and images here.</p>';
    }

    return field;
  }

  export function duplicate(field: WooptionsFic.FieldDefinition): WooptionsFic.FieldDefinition {
    const copy = WooptionsFic.Utils.clone(field);
    const remap = (item: WooptionsFic.FieldDefinition): WooptionsFic.FieldDefinition => ({
      ...item,
      uuid: WooptionsFic.Utils.uuid(),
      label: item === copy ? `${item.label} copy` : item.label,
      choices: item.choices?.map((choiceItem) => ({ ...choiceItem, uuid: WooptionsFic.Utils.uuid() })),
      children: item.children?.map(remap),
    });
    return remap(copy);
  }
}
