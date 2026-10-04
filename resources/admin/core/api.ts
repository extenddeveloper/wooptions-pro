namespace WooptionsFic.Api {
  const apiFetch = wp.apiFetch;
  apiFetch.use(apiFetch.createNonceMiddleware(window.WooptionsFicAdmin.nonce));

  export async function request<T>(path: string, options: { method?: string; data?: unknown } = {}): Promise<T> {
    return apiFetch({
      path: `/wooptionsfic/v1${path}`,
      method: options.method ?? 'GET',
      data: options.data,
    }) as Promise<T>;
  }

  export function listOptionSets(params: {
    page?: number;
    perPage?: number;
    status?: WooptionsFic.OptionSetStatus;
    search?: string;
    orderBy?: string;
    order?: 'ASC' | 'DESC';
  } = {}): Promise<WooptionsFic.OptionSetCollection> {
    const query = new URLSearchParams({
      page: String(params.page ?? 1),
      perPage: String(params.perPage ?? 10),
      status: params.status ?? 'active',
      search: params.search ?? '',
      orderBy: params.orderBy ?? 'updated_at_gmt',
      order: params.order ?? 'DESC',
    });
    return request<WooptionsFic.OptionSetCollection>(`/option-sets?${query.toString()}`);
  }

  export function createOptionSet(title: string): Promise<WooptionsFic.OptionSetRecord> {
    return request('/option-sets', { method: 'POST', data: { title } });
  }

  export function getOptionSet(uuid: string): Promise<WooptionsFic.OptionSetRecord> {
    return request(`/option-sets/${uuid}`);
  }

  export function updateOptionSet(uuid: string, data: Record<string, unknown>): Promise<WooptionsFic.OptionSetRecord> {
    return request(`/option-sets/${uuid}`, { method: 'PUT', data });
  }

  export function duplicateOptionSet(uuid: string): Promise<WooptionsFic.OptionSetRecord> {
    return request(`/option-sets/${uuid}/duplicate`, { method: 'POST' });
  }

  export function deleteOptionSet(uuid: string): Promise<{ deleted: boolean; uuid: string }> {
    return request(`/option-sets/${uuid}/delete-permanently`, { method: 'POST' });
  }

  export function saveRevision(
    uuid: string,
    definition: WooptionsFic.OptionSetDefinition,
    expectedHash: string,
    versionNote: string,
  ): Promise<WooptionsFic.OptionSetRecord> {
    return request(`/option-sets/${uuid}/revisions`, {
      method: 'POST',
      data: { definition, expectedHash, versionNote },
    });
  }

  export function validateDefinition(uuid: string, definition: WooptionsFic.OptionSetDefinition): Promise<{
    valid: boolean;
    errors: WooptionsFic.ValidationIssue[];
    warnings: WooptionsFic.ValidationIssue[];
    contentHash: string;
  }> {
    return request(`/option-sets/${uuid}/validate`, { method: 'POST', data: { definition } });
  }

  export function publishOptionSet(uuid: string, expectedHash: string): Promise<WooptionsFic.OptionSetRecord> {
    return request(`/option-sets/${uuid}/publish`, {
      method: 'POST',
      data: { expectedHash, versionNote: 'Published from the builder' },
    });
  }

  export function listRevisions(uuid: string): Promise<WooptionsFic.RevisionRecord[]> {
    return request(`/option-sets/${uuid}/revisions`);
  }

  export function rollback(uuid: string, revisionUuid: string): Promise<WooptionsFic.OptionSetRecord> {
    return request(`/option-sets/${uuid}/rollback`, { method: 'POST', data: { revisionUuid } });
  }

  export function getAssignments(uuid: string): Promise<{ items: WooptionsFic.AssignmentRecord[] }> {
    return request(`/option-sets/${uuid}/assignments`);
  }

  export function saveAssignments(uuid: string, assignments: WooptionsFic.AssignmentRecord[]): Promise<{ items: WooptionsFic.AssignmentRecord[] }> {
    return request(`/option-sets/${uuid}/assignments`, { method: 'PUT', data: { assignments } });
  }

  export function searchAssignmentTargets(
    type: 'product' | 'variation' | 'category' | 'tag',
    search: string,
    include: number[] = [],
  ): Promise<{ items: WooptionsFic.AssignmentTarget[] }> {
    const query = new URLSearchParams({ type, search, include: include.join(','), perPage: '25' });
    return request(`/assignment-targets?${query.toString()}`);
  }

  export function searchProductsForChoices(search: string, include: number[] = []): Promise<{ items: any[] }> {
    const query = new URLSearchParams({ type: 'product', search, include: include.join(','), perPage: '20', forChoices: '1' });
    return request(`/assignment-targets?${query.toString()}`);
  }

  export function listTemplates(): Promise<{ items: WooptionsFic.TemplateRecord[] }> {
    return request('/templates');
  }

  export function importTemplate(slug: string): Promise<WooptionsFic.OptionSetRecord> {
    return request('/templates', { method: 'POST', data: { slug } });
  }

  export function previewImport(payload: Record<string, unknown>): Promise<{ valid: boolean; errors: WooptionsFic.ValidationIssue[]; warnings: WooptionsFic.ValidationIssue[]; title: string; fieldCount: number; contentHash: string }> {
    return request('/imports/preview', { method: 'POST', data: payload });
  }

  export function commitImport(payload: Record<string, unknown>, title: string): Promise<WooptionsFic.OptionSetRecord> {
    return request('/imports/commit', { method: 'POST', data: { ...payload, title } });
  }

  export function exportOptionSet(uuid: string): Promise<Record<string, unknown>> {
    return request(`/exports/${uuid}`);
  }

  export function analytics(params?: { range?: string; from?: string; to?: string; productId?: number }): Promise<Record<string, any>> {
    const query = new URLSearchParams();
    if (params?.range) query.set('range', params.range);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.productId) query.set('productId', String(params.productId));
    const qs = query.toString();
    return request(qs ? `/analytics?${qs}` : '/analytics');
  }

  export function getSettings(): Promise<Record<string, any>> {
    return request('/settings');
  }

  export function saveSettings(settings: Record<string, unknown>): Promise<Record<string, any>> {
    return request('/settings', { method: 'PUT', data: settings });
  }
}
