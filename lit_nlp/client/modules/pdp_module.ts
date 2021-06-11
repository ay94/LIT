/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// tslint:disable:no-new-decorators
import {customElement, html} from 'lit-element';
import {until} from 'lit-html/directives/until';
import {observable} from 'mobx';
import {LitModule} from '../core/lit_module';
import {ModelInfoMap, Spec} from '../lib/types';
import {doesInputSpecContain, doesOutputSpecContain, findSpecKeys, setEquals} from '../lib/utils';

import {styles} from './pdp_module.css';
import {styles as sharedStyles} from './shared_styles.css';

// Dict of possible feature values to model outputs for a given prediction head
// (list for classification, single number for regression).
interface PdpInfo {
  [key: string]: number|number[];
}
// Dict of PdpInfo for all prediction heads of a model.
interface AllPdpInfo {
  [predKey: string]: PdpInfo;
}

/**
 * A LIT module that renders regression results.
 */
@customElement('pdp-module')
export class PdpModule extends LitModule {
  static title = 'Partial Dependence Plots';
  static duplicateForExampleComparison = true;
  static numCols = 4;
  static template = (model = '', selectionServiceIndex = 0) => {
    return html`<pdp-module model=${model} selectionServiceIndex=${
        selectionServiceIndex}></pdp-module>`;
  };

  static get styles() {
    return [sharedStyles, styles];
  }

  @observable private readonly plotVisibility = new Map<string, boolean>();
  @observable private readonly plotInfo = new Map<string, AllPdpInfo>();

  // Tracks the selected examples for current plots to ensure returned plot info
  // is for the current selection before displaying it.
  private selectionSet = new Set<string>();

  firstUpdated() {
    const getInputSpec = () => this.appState.getModelSpec(this.model).input;
    this.reactImmediately(
        getInputSpec, inputSpec => {
          this.resetPlots(inputSpec);
        });

    // When selected data changes, clear the cached plots and set all plots
    // back to hidden.
    this.react(() => this.selectionService.selectedInputData, () => {
      this.selectionSet = new Set(this.selectionService.selectedInputData.map(
          example => example.id));
      this.plotInfo.clear();
      for (const key of this.plotVisibility.keys()) {
        this.plotVisibility.set(key, false);
      }
    });
  }

  // Clear cached plots and find all features for which plots can be generated,
  // setting them to hidden by default.
  private async resetPlots(inputSpec: Spec) {
    this.plotVisibility.clear();
    this.plotInfo.clear();
    const feats = findSpecKeys(inputSpec, ['Scalar', 'CategoryLabel']);
    for (const feat of feats) {
      if (inputSpec[feat].required) {
        this.plotVisibility.set(feat, false);
      }
    }
  }

  // Get plots for a given feature and the selected data from the back-end.
  private async calculatePlotInfo(feat:string) {
    const config = {
      'feature': feat
    };
    const selectedInputs = this.selectionService.selectedInputData;
    const plotInfo = await this.apiService.getInterpretations(
        selectedInputs, this.model, this.appState.currentDataset, 'pdp',
        config);
    return plotInfo;
  }

  renderPlot(feat: string) {
    // Nothing to render if plot is hidden.
    if (!this.plotVisibility.get(feat)) {
      return null;
    }

    // Get plot info if already fetched by front-end, or make call to back-end
    // to calcuate it.
    const getPlotInfo = (feat: string): Promise<AllPdpInfo> => {
      const fetchedSelectionSet = new Set(this.selectionSet);

      return new Promise (async (resolved, rejected) => {
        if (this.plotInfo.get(feat) == null) {
          const plotInfo = await this.calculatePlotInfo(feat);
          if (setEquals(fetchedSelectionSet, this.selectionSet)) {
            this.plotInfo.set(feat, plotInfo);
          }
        }
        resolved(this.plotInfo.get(feat)!);
      });
    };

    const renderSpinner = () => {
      return html`
          <div class='pdp-background'>
            <lit-spinner size=${24} color="var(--app-secondary-color)">
            </lit-spinner>
          </div>`;
    };

    // TODO(jwexler): Implement line and bar chart elements and use them to
    // display PDP results.
    const renderPlotInfo = (plotInfo: AllPdpInfo) => {
      return html`
          <div class='pdp-background'>
            <div>${JSON.stringify(this.plotInfo.get(feat))}</div>
          </div>`;
    };

    // Render spinner until plot info is available, then render the plots.
    return html`${until(getPlotInfo(feat).then(plotInfo => {
      return renderPlotInfo(plotInfo);
    }), renderSpinner())}`;
  }

  renderPlotHolder(feat: string) {
    const toggleCollapse = () => {
      const isVisible = this.plotVisibility.get(feat);
      this.plotVisibility.set(feat, !isVisible);
    };
    const isVisible = this.plotVisibility.get(feat);

    // clang-format off
    return html`
        <div class='plot-holder'>
          <div class='collapse-bar' @click=${toggleCollapse}>
            <div class="pdp-title">
              <div>${feat}</div>
            </div>
            <mwc-icon class="icon-button min-button">
              ${isVisible ? 'expand_less': 'expand_more'}
            </mwc-icon>
          </div>
          ${this.renderPlot(feat)}
        </div>
      `;
    // clang-format on
  }

  render() {
    return html`${Array.from(this.plotVisibility.keys()).map(
        feat => this.renderPlotHolder(feat))}`;
  }

  static shouldDisplayModule(modelSpecs: ModelInfoMap, datasetSpec: Spec) {
    return doesOutputSpecContain(modelSpecs, ['RegressionScore', 'MulticlassPreds'])
        && doesInputSpecContain(modelSpecs, ['Scalar', 'CategoryLabel'], true);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pdp-module': PdpModule;
  }
}
