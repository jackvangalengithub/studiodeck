<?php
declare(strict_types=1);

// Explicit compatibility surface. Binary transfers, login and OAuth callbacks
// cannot enter the JSON dispatcher through a batch.
function batch_action_method(string $action): ?string {
    static $reads=[
        'session','projects','project','deck','attention','mention_people','conversation',
        'project_testimonials','website','website_sources','project_access','billing',
        'billing_invoices','destinations','client_project','drive_status','drive_list',
        'document_page','studio_users','comments_feed','resolve_slide','profile',
        'studio_starting_pack','project_starting_pack','product_feedback_inbox',
    ];
    static $writes=[
        'add_client_question','add_project_pack_slide','add_slide_group','add_system_slide',
        'apply_project_pack','archive_pack_item','billing_cancel_change','billing_cancel_checkout',
        'billing_change_checkout','billing_change_confirm','billing_change_preview','billing_checkout',
        'billing_coverage','billing_onboard','billing_portal','billing_refresh','billing_resume_checkout',
        'budget_chat','budget_choice','category','check_source_role','comment','comment_answered',
        'communication_post','communication_share','communication_slide_link','communication_thread_update',
        'communication_work_decide','complete_studio_setup','confirmation_decide','conversation_revoke',
        'create_project','create_studio','delete_project','dismiss_job','drive_connect','drive_disconnect',
        'drive_import','generate_open_questions','generate_slide_motion','image_edit','lock_iteration',
        'logout','match_subquotes','new_iteration','pin_project','prepare_delete_project',
        'product_feedback_review','product_feedback_submit','project_activate','project_members',
        'project_settings','project_testimonial_delete','project_testimonial_save','read_comments',
        'remove_avatar','remove_project_client','remove_project_logo','remove_project_person',
        'remove_slide_group','remove_studio_logo','remove_studio_user','reorder_slide_groups',
        'reply_open_question','reprocess','restore_job','retry_job','review_consistency_finding',
        'review_subquote','revoke_share','run_consistency_checks','save_budget','save_contact',
        'save_open_question','save_pack_item','save_profile','save_project_client','save_project_person',
        'save_slide','save_slide_motion','save_studio_user','select_slide_image','set_project_cover',
        'share','slide_image_edit','slide_layout','studio_theme','switch_studio','theme','unlink_subquote',
        'website_chat','website_checkout','website_domain','website_import','website_page',
        'website_publish','website_refresh_billing','website_reset','website_restore','website_save',
        'website_start','website_undo',
    ];
    return in_array($action,$reads,true)?'QUERY':(in_array($action,$writes,true)?'POST':null);
}

function batch_context_action(string $action): bool {
    return in_array($action,['switch_studio','create_studio','logout'],true);
}
