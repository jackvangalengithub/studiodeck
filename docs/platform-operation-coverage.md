# Platform operation coverage

UI command names are retained inside the client; they are never sent as API resource names.
Implemented data commands use platform table endpoints and declared custom repo actions
in batches. Bootstrap and project creation use `users:ensureIdentity` for canonical
identity linking.
“Unavailable” means an explicit error with no legacy fallback. See [issues and prerequisites](platform-porting-issues.md).
Some implemented composites have limitations called out in that report; this inventory is not a parity certification.

| UI operation | Adapter status |
|---|---|
| `add_client_question` | Implemented with platform requests |
| `add_project_pack_slide` | Implemented with platform requests |
| `add_slide_group` | Implemented with platform requests |
| `add_system_slide` | Implemented with platform requests |
| `apply_project_pack` | Implemented with platform requests |
| `archive_pack_item` | Implemented with platform requests |
| `attention` | Implemented with platform requests |
| `billing` | Unavailable; see issue report |
| `billing_cancel_change` | Unavailable; see issue report |
| `billing_cancel_checkout` | Unavailable; see issue report |
| `billing_change_checkout` | Unavailable; see issue report |
| `billing_change_confirm` | Unavailable; see issue report |
| `billing_change_preview` | Unavailable; see issue report |
| `billing_checkout` | Unavailable; see issue report |
| `billing_coverage` | Unavailable; see issue report |
| `billing_invoices` | Unavailable; see issue report |
| `billing_onboard` | Unavailable; see issue report |
| `billing_portal` | Unavailable; see issue report |
| `billing_refresh` | Unavailable; see issue report |
| `billing_resume_checkout` | Unavailable; see issue report |
| `budget_chat` | Unavailable; see issue report |
| `budget_choice` | Implemented with platform requests |
| `category` | Implemented with platform requests |
| `check_source_role` | Implemented with platform requests |
| `client_project` | Unavailable; see issue report |
| `comment` | Implemented with platform requests |
| `comment_answered` | Implemented with platform requests |
| `comments_feed` | Implemented with platform requests |
| `communication_post` | Implemented with platform requests |
| `communication_share` | Unavailable; see issue report |
| `communication_slide_link` | Implemented with platform requests |
| `communication_thread_update` | Implemented with platform requests |
| `communication_work_decide` | Implemented with platform requests |
| `complete_studio_setup` | Implemented with platform requests |
| `confirmation_decide` | Unavailable; see issue report |
| `conversation` | Unavailable; see issue report |
| `conversation_revoke` | Unavailable; see issue report |
| `create_project` | Implemented with platform requests |
| `create_studio` | Implemented with platform requests |
| `deck` | Implemented with platform requests |
| `delete_project` | Unavailable; see issue report |
| `destinations` | Implemented with platform requests |
| `dismiss_job` | Unavailable; see issue report |
| `document_page` | Implemented with platform requests |
| `drive_connect` | Unavailable; see issue report |
| `drive_disconnect` | Unavailable; see issue report |
| `drive_import` | Unavailable; see issue report |
| `drive_list` | Unavailable; see issue report |
| `drive_status` | Implemented with platform requests |
| `generate_open_questions` | Unavailable; see issue report |
| `generate_slide_motion` | Unavailable; see issue report |
| `image_edit` | Unavailable; see issue report |
| `lock_iteration` | Implemented with platform requests |
| `logout` | Implemented with platform requests |
| `match_subquotes` | Unavailable; see issue report |
| `mention_people` | Implemented with platform requests |
| `new_iteration` | Implemented with platform requests |
| `pin_project` | Implemented with platform requests |
| `prepare_delete_project` | Unavailable; see issue report |
| `product_feedback_inbox` | Implemented with platform requests |
| `product_feedback_review` | Implemented with platform requests |
| `product_feedback_submit` | Implemented with platform requests |
| `profile` | Implemented with platform requests |
| `project` | Implemented with platform requests |
| `project_access` | Unavailable; see issue report |
| `project_activate` | Unavailable; see issue report |
| `project_members` | Unavailable; see issue report |
| `project_settings` | Implemented with platform requests |
| `project_starting_pack` | Implemented with platform requests |
| `project_testimonial_delete` | Implemented with platform requests |
| `project_testimonial_save` | Implemented with platform requests |
| `project_testimonials` | Implemented with platform requests |
| `projects` | Implemented with platform requests |
| `read_comments` | Implemented with platform requests |
| `remove_avatar` | Implemented with platform requests |
| `remove_project_client` | Unavailable; see issue report |
| `remove_project_logo` | Implemented with platform requests |
| `remove_project_person` | Implemented with platform requests |
| `remove_slide_group` | Implemented with platform requests |
| `remove_studio_logo` | Implemented with platform requests |
| `remove_studio_user` | Unavailable; see issue report |
| `reorder_slide_groups` | Implemented with platform requests |
| `reply_open_question` | Implemented with platform requests |
| `reprocess` | Unavailable; see issue report |
| `resolve_slide` | Implemented with platform requests |
| `restore_job` | Unavailable; see issue report |
| `retry_job` | Unavailable; see issue report |
| `review_consistency_finding` | Implemented with platform requests |
| `review_subquote` | Implemented with platform requests |
| `revoke_share` | Unavailable; see issue report |
| `run_consistency_checks` | Unavailable; see issue report |
| `save_budget` | Implemented with platform requests |
| `save_contact` | Implemented with platform requests |
| `save_open_question` | Implemented with platform requests |
| `save_pack_item` | Implemented with platform requests |
| `save_profile` | Implemented with platform requests |
| `save_project_client` | Implemented with platform requests |
| `save_project_person` | Implemented with platform requests |
| `save_slide` | Implemented with platform requests |
| `save_slide_motion` | Implemented with platform requests |
| `save_studio_user` | Unavailable; see issue report |
| `select_slide_image` | Implemented with platform requests |
| `session` | Implemented with platform requests |
| `set_project_cover` | Implemented with platform requests |
| `share` | Unavailable; see issue report |
| `slide_image_edit` | Unavailable; see issue report |
| `slide_layout` | Implemented with platform requests |
| `studio_starting_pack` | Implemented with platform requests |
| `studio_theme` | Implemented with platform requests |
| `studio_users` | Unavailable; see issue report |
| `switch_studio` | Implemented with platform requests |
| `theme` | Implemented with platform requests |
| `unlink_subquote` | Implemented with platform requests |
| `website` | Unavailable; see issue report |
| `website_chat` | Unavailable; see issue report |
| `website_checkout` | Unavailable; see issue report |
| `website_domain` | Unavailable; see issue report |
| `website_import` | Unavailable; see issue report |
| `website_page` | Unavailable; see issue report |
| `website_publish` | Unavailable; see issue report |
| `website_refresh_billing` | Unavailable; see issue report |
| `website_reset` | Unavailable; see issue report |
| `website_restore` | Unavailable; see issue report |
| `website_save` | Unavailable; see issue report |
| `website_sources` | Unavailable; see issue report |
| `website_start` | Unavailable; see issue report |
| `website_undo` | Unavailable; see issue report |

Dedicated routes: platform authentication/MFA/logout, administration creation, OAuth, and userfiles.
Project uploads and avatar/logo uploads use userfiles plus batched metadata writes.
Other binary reads resolve file IDs through table queries and use userfiles; unsupported exports/previews report unavailable.
