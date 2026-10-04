namespace WooptionsFic.Components {
  const iconMap: Record<string, string> = {
    select: 'list-view',
    radio: 'marker',
    checkbox_group: 'yes-alt',
    checkbox: 'yes',
    toggle: 'image-flip-horizontal',
    segmented: 'grid-view',
    color_swatch: 'art',
    image_swatch: 'format-image',
    product: 'products',
    font: 'editor-textcolor',
    text: 'editor-textcolor',
    textarea: 'text-page',
    tel: 'phone',
    email: 'email',
    url: 'admin-links',
    number: 'editor-ol',
    range: 'leftright',
    date: 'calendar-alt',
    date_range: 'calendar',
    time: 'clock',
    datetime: 'schedule',
    customer_defined_price: 'money-alt',
    color_picker: 'admin-customizer',
    file: 'upload',
    formula: 'calculator',
    calculated: 'chart-line',
    repeater: 'screenoptions',
    heading: 'heading',
    paragraph: 'editor-paragraph',
    help: 'editor-help',
    separator: 'minus',
    spacer: 'editor-contract',
    content: 'editor-alignleft',
    modal: 'external',
  };

  export function Dashicon(props: { name: string; className?: string }): any {
    return <span className={WooptionsFic.Utils.classNames('dashicons', `dashicons-${props.name}`, props.className)} aria-hidden="true" />;
  }

  export function FieldIcon(props: { type: string }): any {
    return <Dashicon name={iconMap[props.type] ?? 'admin-generic'} />;
  }

  export function GripIcon(): any {
    return <span className="wof-grip-dots" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>;
  }
}
