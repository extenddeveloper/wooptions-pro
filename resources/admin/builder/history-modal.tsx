namespace WooOptionsPro.Builder {
  const { Button, Modal } = wp.components;
  const { __ } = wp.i18n;
  const { useMemo, useState } = wp.element;

  export function HistoryModal(props: {
    revisions: WooOptionsPro.RevisionRecord[];
    busy: boolean;
    onClose: () => void;
    onRollback: (uuid: string) => Promise<void>;
  }): any {
    const [restoring, setRestoring] = useState<string | null>(null);
    const revisions = useMemo(
      () => [...props.revisions].sort((left, right) => Number(right.revisionNumber) - Number(left.revisionNumber)),
      [props.revisions],
    );
    const publishedCount = revisions.filter((revision) => revision.state === 'published').length;
    const latestNumber = revisions.reduce((latest, revision) => Math.max(latest, Number(revision.revisionNumber) || 0), 0);

    const restore = async (revisionUuid: string) => {
      setRestoring(revisionUuid);
      try {
        await props.onRollback(revisionUuid);
      } finally {
        setRestoring(null);
      }
    };

    return (
      <Modal
        title={__('Version history', 'wooptions-pro')}
        onRequestClose={props.onClose}
        className="wof-modal wof-history-modal"
      >
        <section className="wof-version-header">
          <div className="wof-version-header__copy">
            <span className="wof-version-header__icon dashicons dashicons-backup" aria-hidden="true" />
            <div>
              <h3>{__('A clear record of every saved version', 'wooptions-pro')}</h3>
              <p>{__('Published versions stay immutable. Restoring creates a new draft, so the current live configuration remains protected.', 'wooptions-pro')}</p>
            </div>
          </div>
          <div className="wof-version-overview">
            <span><small>{__('Versions', 'wooptions-pro')}</small><strong>{revisions.length}</strong></span>
            <span><small>{__('Published', 'wooptions-pro')}</small><strong>{publishedCount}</strong></span>
            <span><small>{__('Latest', 'wooptions-pro')}</small><strong>#{latestNumber || '—'}</strong></span>
          </div>
        </section>

        {props.busy && !revisions.length ? (
          <WooOptionsPro.Components.ModalLoading label={__('Loading version history…', 'wooptions-pro')} />
        ) : revisions.length ? (
          <div className="wof-version-list">
            {revisions.map((revision, index) => {
              const published = revision.state === 'published';
              const latest = index === 0;
              return (
                <article
                  key={revision.uuid}
                  className={`wof-version-row ${published ? 'is-published' : 'is-draft'} ${latest ? 'is-latest' : ''}`}
                >
                  <div className="wof-version-number">
                    <small>{__('Version', 'wooptions-pro')}</small>
                    <strong>#{revision.revisionNumber}</strong>
                  </div>
                  <div className="wof-version-details">
                    <div className="wof-version-details__top">
                      <div className="wof-version-badges">
                        <span className={`wof-version-state is-${revision.state}`}>
                          {published ? __('Published', 'wooptions-pro') : __('Draft', 'wooptions-pro')}
                        </span>
                        {latest ? <span className="wof-version-latest">{__('Latest', 'wooptions-pro')}</span> : null}
                      </div>
                      <time dateTime={revision.createdAtGmt}>{WooOptionsPro.Utils.formatDate(revision.createdAtGmt)}</time>
                    </div>
                    <p>{revision.versionNote || __('No version note was added for this save.', 'wooptions-pro')}</p>
                  </div>
                  <Button
                    variant="secondary"
                    className="wof-version-restore"
                    isBusy={restoring === revision.uuid}
                    disabled={props.busy || Boolean(restoring)}
                    onClick={() => restore(revision.uuid)}
                  >
                    <span className="dashicons dashicons-image-rotate" aria-hidden="true" />
                    {__('Restore', 'wooptions-pro')}
                  </Button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="wof-history-empty">
            <span className="dashicons dashicons-backup" aria-hidden="true" />
            <h3>{__('No saved versions yet', 'wooptions-pro')}</h3>
            <p>{__('Save a draft or publish this option set to create the first version.', 'wooptions-pro')}</p>
          </div>
        )}
      </Modal>
    );
  }
}
