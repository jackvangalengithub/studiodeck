<?php
declare(strict_types=1);
// Caller must hold a write transaction and verify authorization / retention eligibility.
function delete_project_records(string $pid): void {
$iterations='SELECT id FROM iterations WHERE project_id=?';$versions='SELECT v.id FROM file_versions v JOIN assets a ON a.id=v.asset_id WHERE a.project_id=?';
        query("DELETE FROM login_tokens WHERE token_hash IN (SELECT l.token_hash FROM conversation_login_grants l JOIN conversation_grants g ON g.id=l.grant_id JOIN comments c ON c.id=g.root_id WHERE c.iteration_id IN ($iterations))",[$pid]);
        query("DELETE FROM email_outbox WHERE comment_id IN (SELECT id FROM comments WHERE iteration_id IN ($iterations))",[$pid]);
        query("DELETE FROM share_aliases WHERE share_id IN (SELECT id FROM shares WHERE iteration_id IN ($iterations))",[$pid]);
        foreach(['open_questions','comments','shares','iteration_pack_items','slide_sections','slide_groups','slide_layout','slide_content','system_slides','presentation_slides','iteration_files'] as $table)query("DELETE FROM $table WHERE iteration_id IN ($iterations)",[$pid]);
        query("UPDATE budget_items SET parent_id=NULL WHERE iteration_id IN ($iterations)",[$pid]);query("DELETE FROM budget_items WHERE iteration_id IN ($iterations)",[$pid]);
        query('DELETE FROM jobs WHERE project_id=?',[$pid]);
        query("UPDATE slide_image_versions SET parent_id=NULL WHERE source_version_id IN ($versions)",[$pid]);query("DELETE FROM slide_image_versions WHERE source_version_id IN ($versions)",[$pid]);
        query("DELETE FROM document_pages WHERE version_id IN ($versions)",[$pid]);
        query("UPDATE file_versions SET parent_id=NULL WHERE id IN ($versions)",[$pid]);query("DELETE FROM file_versions WHERE id IN ($versions)",[$pid]);
        foreach(['assets','contacts','events','project_members','project_pins','project_logos','project_details','iterations'] as $table)query("DELETE FROM $table WHERE project_id=?",[$pid]);
        query('DELETE FROM projects WHERE id=?',[$pid]);
}
