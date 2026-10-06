namespace WooOptionsPro.Components {
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
    return <span className={WooOptionsPro.Utils.classNames('dashicons', `dashicons-${props.name}`, props.className)} aria-hidden="true" />;
  }

  export function FieldIcon(props: { type: string }): any {
    return <Dashicon name={iconMap[props.type] ?? 'admin-generic'} />;
  }

  export function GripIcon(): any {
    return <span className="wof-grip-dots" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>;
  }

  export function PaletteIcon(props: { className?: string; size?: number }): any {
    const size = props.size || 18;
    return (
      <svg
        className={WooOptionsPro.Utils.classNames('wof-svg-icon', props.className)}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 2C6.5 2 2 6.5 2 12c0 5.5 4.5 10 10 10 .93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13 0-.92.75-1.67 1.67-1.67h2.02c3.05 0 5.54-2.5 5.54-5.55C22 6.01 17.5 2 12 2Z" />
        <circle cx="6.8" cy="12.2" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="8.8" cy="7.8" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="13.5" cy="6.2" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="17.5" cy="9.8" r="1.3" fill="currentColor" stroke="none" />
      </svg>
    );
  }
}
