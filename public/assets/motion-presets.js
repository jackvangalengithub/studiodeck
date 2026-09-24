import {tr} from './i18n.js';
// Presets only populate the editor. Generation receives the edited prompt, not a preset ID.
export const motionPresets={
 'pan-right':{get label(){return tr('media_pan-right');},get prompt(){return tr('media_prompt_pan_right');}},
 'pan-left':{get label(){return tr('media_pan-left');},get prompt(){return tr('media_prompt_pan_left');}},
 'zoom-out':{get label(){return tr('media_zoom-out');},get prompt(){return tr('media_prompt_pull_back');}},
 orbit:{get label(){return tr('media_orbit');},get prompt(){return tr('media_prompt_orbit');}},
 custom:{get label(){return tr('studio_custom');},prompt:''}
};
