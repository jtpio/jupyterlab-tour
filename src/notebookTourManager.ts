import type { ErrorObject, ValidateFunction } from 'ajv';

import type { Notebook } from '@jupyterlab/notebook';
import type { ISignal } from '@lumino/signaling';
import { Signal } from '@lumino/signaling';
import { notebookTourIcon } from './icons';
import type { INotebookTourManager, ITour, ITourManager } from './tokens';
import { NOTEBOOK_PLUGIN_ID, NS } from './tokens';
import { PromiseDelegate } from '@lumino/coreutils';

/**
 * The NotebookTourManager is needed to sync Notebook metadata with the TourManager
 */
export class NotebookTourManager implements INotebookTourManager {
  constructor(options: INotebookTourManager.IOptions) {
    this._tourManager = options.tourManager;
  }

  get tourManager(): ITourManager {
    return this._tourManager;
  }

  /**
   * Handle the current notebook changing
   */
  async addNotebook(notebook: Notebook): Promise<void> {
    if (this._notebookTours.has(notebook)) {
      return;
    }

    if (!notebook.model) {
      return;
    }

    (notebook.model.metadataChanged ?? notebook.model.metadata.changed).connect(
      async () => await this._notebookMetadataChanged(notebook)
    );

    notebook.disposed.connect(this._onNotebookDisposed, this);

    await this._notebookMetadataChanged(notebook);
  }

  /**
   * Get the list of full tour ids for this notebook
   *
   * @param notebook the notebook
   */
  getNotebookTourIds(notebook: Notebook): string[] {
    const tourIds: string[] = [];

    for (const id of this._tourManager.tours.keys()) {
      if (id.startsWith(`${NOTEBOOK_PLUGIN_ID}:${notebook.id}:`)) {
        tourIds.push(id);
      }
    }
    return tourIds;
  }

  /**
   * Get the validation errors for a notebook
   * @param notebook the notebook
   * @returns the list of errors
   */
  getNotebookValidationErrors(notebook: Notebook): ErrorObject[] {
    return this._validationErrors.get(notebook) || [];
  }

  /** A signal that emits when notebook tours changes. */
  get notebookToursChanged(): ISignal<INotebookTourManager, Notebook> {
    return this._notebookToursChanged;
  }

  private _onNotebookDisposed(notebook: Notebook): void {
    this._cleanNotebookTours(notebook);
  }

  private _cleanNotebookTours(panel: Notebook): void {
    for (const id of this.getNotebookTourIds(panel)) {
      this._tourManager.removeTour(id);
    }
  }

  /**
   * The metadata changed, and therefore maybe tours: remove all of them, and
   * maybe re-add.
   */
  private async _notebookMetadataChanged(notebook: Notebook): Promise<void> {
    const { model } = notebook;
    const metadata = model
      ? model.getMetadata
        ? model.getMetadata(NS)
        : // @ts-expect-error JLab 3 API
          model.metadata.get(NS)
      : null;

    this._cleanNotebookTours(notebook);
    this._validationErrors.set(notebook, []);

    if (metadata) {
      await this._updateFromNotebookMetadata(notebook, metadata);
    }

    this._notebookToursChanged.emit(notebook);
  }

  /**
   * Tour metadata was found:
   */
  private async _updateFromNotebookMetadata(
    notebook: Notebook,
    metadata: any
  ): Promise<void> {
    const { translator } = this._tourManager;
    const _validator = await Private.ensureValidator();
    _validator(metadata);
    const errors = _validator.errors || [];
    this._validationErrors.set(notebook, errors);
    if (errors.length) {
      console.error(
        translator.__('Validation errors found: fix them in Advanced Settings')
      );
      console.table(errors);
    } else {
      const tours: ITour[] = metadata['tours'] ?? [];
      for (const tour of this.tourManager.sortTours(tours)) {
        try {
          this._addNotebookTour(notebook, tour);
          this._tourManager.launch([tour.id], false);
        } catch (error) {
          console.groupCollapsed(
            translator.__(
              'Error encountered adding notebook tour %1 (%2)',
              tour.label,
              tour.id
            ),
            error
          );
          console.table(tour.steps);
          console.log(tour.options ?? {});
          console.groupEnd();
        }
      }
    }
  }

  /**
   * Actually create a tour from JSON
   */
  private _addNotebookTour(notebook: Notebook, tour: ITour): void {
    this._tourManager.addTour({
      ...tour,
      id: `${NOTEBOOK_PLUGIN_ID}:${notebook.id}:${tour.id}`,
      icon: tour.icon || notebookTourIcon.name
    });
  }

  private _tourManager: ITourManager;
  private _notebookTours = new Map<Notebook, ITour[]>();
  private _notebookToursChanged = new Signal<INotebookTourManager, Notebook>(this);
  private _validationErrors = new Map<Notebook, ErrorObject[]>();
}

/** A namespace for private values. */
export namespace Private {
  let _validator: ValidateFunction | null = null;
  let _loading: PromiseDelegate<ValidateFunction> | null = null;

  /**
   * Get a singleton pre-compiled validator function.
   */
  export async function ensureValidator(): Promise<ValidateFunction> {
    if (!_loading) {
      _loading = new PromiseDelegate();

      const { Ajv } = await import('ajv');
      const schema = await import('../schema/user-tours.json');

      // `jupyter.lab...` keywords custom keywords rejected by default
      // we may be able to do better than `strict: false` by defining
      // custom keywords https://ajv.js.org/keywords.html
      const ajv = new Ajv({ strict: false });
      _validator = ajv.compile(schema);
      _loading.resolve(_validator);
    }

    return _loading.promise;
  }
}
