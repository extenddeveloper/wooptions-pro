namespace WooOptionsPro.Utils {
  export const i18n = wp.i18n;

  export function clone<T>(value: T): T {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value)) as T;
  }

  export function uuid(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
      const random = Math.floor(Math.random() * 16);
      const value = character === 'x' ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }

  export function errorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
      return (error as { message: string }).message;
    }
    return i18n.__('Something went wrong. Please try again.', 'wooptions-pro');
  }

  export function formatDate(value: string): string {
    if (!value) return '—';
    const normalized = /Z$/.test(value) ? value : `${value}Z`;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  export function downloadJson(filename: string, payload: unknown): void {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  export function slug(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  export function fieldByUuid(document: WooOptionsPro.OptionSetDefinition | null, uuidValue: string | null): WooOptionsPro.FieldDefinition | null {
    if (!document || !uuidValue) return null;
    const walk = (fields: WooOptionsPro.FieldDefinition[]): WooOptionsPro.FieldDefinition | null => {
      for (const field of fields) {
        if (field.uuid === uuidValue) return field;
        if (field.children?.length) {
          const child = walk(field.children);
          if (child) return child;
        }
      }
      return null;
    };
    return walk(document.fields);
  }

  export function updateFieldTree(
    fields: WooOptionsPro.FieldDefinition[],
    uuidValue: string,
    updater: (field: WooOptionsPro.FieldDefinition) => WooOptionsPro.FieldDefinition,
  ): WooOptionsPro.FieldDefinition[] {
    return fields.map((field) => {
      if (field.uuid === uuidValue) return updater(field);
      if (field.children?.length) {
        return { ...field, children: updateFieldTree(field.children, uuidValue, updater) };
      }
      return field;
    });
  }

  export function removeFieldTree(fields: WooOptionsPro.FieldDefinition[], uuidValue: string): WooOptionsPro.FieldDefinition[] {
    return fields
      .filter((field) => field.uuid !== uuidValue)
      .map((field) => ({
        ...field,
        children: field.children ? removeFieldTree(field.children, uuidValue) : field.children,
      }));
  }

  export function allFields(fields: WooOptionsPro.FieldDefinition[]): WooOptionsPro.FieldDefinition[] {
    const result: WooOptionsPro.FieldDefinition[] = [];
    const walk = (items: WooOptionsPro.FieldDefinition[]) => {
      items.forEach((field) => {
        result.push(field);
        if (field.children?.length) walk(field.children);
      });
    };
    walk(fields);
    return result;
  }

  export function countChoices(fields: WooOptionsPro.FieldDefinition[]): number {
    return allFields(fields).reduce((count, field) => count + (field.choices?.length ?? 0), 0);
  }

  export function compactNumber(value: number): string {
    const number = Number(value || 0);
    if (number < 1000) return String(number);
    return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(number);
  }

  export function classNames(...values: Array<string | false | null | undefined>): string {
    return values.filter(Boolean).join(' ');
  }
}
