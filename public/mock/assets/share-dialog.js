import * as domView from "../../assets/render.js";
import {tr} from './i18n.js';
export function openShareDialog({state, pending, toast, openModal, button, projectClientUi, esc, iterationLabel, formFooter}) {
  if (state.client || !state.data || state.data.can_edit === false) {
    toast(tr("studio_only_project_team_members_can_share_presentations"));
    return;
  }
  if (pending()) {
    openModal(tr("studio_your_files_are_still_processing"), domView.fragment([domView.element("p", [], [tr("studio_wait_for_processing_to_finish_before_sending_this_presentation_to_your_clients")], false), domView.element("div", [{
      "class": "modal-footer"
    }], [button(tr("studio_got_it"), 'close-modal', 'primary')], false)]));
    return;
  }
  if (!projectClientUi.clients().length) {
    openModal(tr("studio_add_your_clients_first"), domView.fragment([domView.element("p", [], [tr("studio_add_client_members_to_this_project_then_choose_who_receives", {
      v0: iterationLabel(state.data.iteration)
    })], false), domView.element("div", [{
      "class": "modal-footer"
    }], [button(tr("studio_manage_clients"), 'project-clients', 'primary', '', 'users')], false)]));
    return;
  }
  openModal(tr("studio_send_to_your_clients"), domView.element("form", [{
    "data-form": "share"
  }], [projectClientUi.picker(), domView.element("label", [], [tr("studio_your_message"), domView.element("textarea", [{
    "name": "message"
  }, {
    "rows": "4"
  }, {
    "maxlength": "3000"
  }], [tr("studio_your_presentation_is_ready_you_can_review_the_design_explore_the_budget_and_leave_feedback")], false)], false), formFooter(tr("studio_send_to_clients"), 'send')], false));
  projectClientUi.updateSelection(document.querySelector('[data-form="share"]'));
}
