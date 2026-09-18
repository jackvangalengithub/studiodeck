<?php
// Backfill unlocked iteration slide records using stored extraction only. No paid AI calls.
declare(strict_types=1);
require_once __DIR__.'/../app/ingest.php';
if(PHP_SAPI!=='cli')exit;
$count=0;
foreach(rows("SELECT id FROM iterations WHERE locked=0") as $i) {
    transaction(function()use($i,&$count){
        if(one("SELECT locked FROM iterations WHERE id=?",[$i['id']])['locked'])return;
        if(one("SELECT id FROM jobs WHERE iteration_id=? AND status IN ('queued','running')",[$i['id']]))return;
        ensure_iteration_slides($i['id']);$count++;
    });
}
echo 'Initialized stored slide records for '.$count." unlocked iteration(s). No AI requests made.\n";
