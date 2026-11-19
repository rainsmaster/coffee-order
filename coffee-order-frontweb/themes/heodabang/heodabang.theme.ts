// The heodabang theme. `astryx experimental theme editor` wrote this file once and never changes it again.
// The checked settings live in heodabang.settings.json and the generated heodabang.settings.ts;
// change them with `astryx experimental theme editor set heodabang ...`. Add your own changes below: they win over the settings.
import {defineTheme} from '@astryxdesign/core/theme';
import {heodabangSettings} from './heodabang.settings';

export const heodabangTheme = defineTheme({
  extends: heodabangSettings,
  name: 'heodabang',
});
