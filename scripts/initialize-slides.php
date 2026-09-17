<?php
// Backfill draft slide records using stored extraction only. No paid AI calls.
declare(strict_types=1);
require_once __DIR__.'/../app/ingest.php';
if(PHP_SAPI!=='cli')exit;
$count=0;
foreach(rows("SELECT id FROM iterations WHERE status='draft'") as $i) {
    transaction(function()use($i,&$count){
        if(one("SELECT status FROM iterations WHERE id=?",[$i['id']])['status']!=='draft')return;
        if(one("SELECT id FROM jobs WHERE iteration_id=? AND status IN ('queued','running')",[$i['id']]))return;
        ensure_iteration_slides($i['id']);$count++;
    });
}
echo 'Initialized stored slide records for '.$count." draft(s). No AI requests made.\n";
