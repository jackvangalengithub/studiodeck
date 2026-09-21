import {tr} from './i18n.js';
export const imagePresets={
 photorealistic:{get label(){return tr("studio_make_photorealistic");},get prompt(){return tr("studio_render_the_original_image_as_an_ultra_photorealistic_architectural_photograph_indistinguishable_from");}},
 viewpoint:{get label(){return tr("studio_change_the_viewpoint");},get prompt(){return tr("studio_show_the_same_space_from_a_different_plausible_camera_position_move_the_camera_a_few_steps_to_the_ri");}},
 clutter:{get label(){return tr("studio_add_some_daily_clutter");},get prompt(){return tr("studio_add_some_daily_small_clutter_to_the_original_image_a_few_subtle_believable_everyday_items_appropriat");}},
 evening:{get label(){return tr("studio_visualize_in_the_evening");},get prompt(){return tr("studio_visualize_the_original_space_in_the_evening_with_soft_dusk_outside_the_windows_and_warm_realistic_il");}},
 custom:{get label(){return tr("studio_custom");},prompt:''}
};
export const customImagePlaceholder=()=>tr("studio_describe_what_you_would_like_to_change_in_the_original_image_for_example_change_only_the_kitchen_cab");
