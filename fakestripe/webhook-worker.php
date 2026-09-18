<?php
declare(strict_types=1);
require __DIR__.'/service.php';
$file=setting('FAKESTRIPE_STATE_PATH',__DIR__.'/state.json');
while (true) {
    $lock=fopen($file.'.lock','c+'); flock($lock,LOCK_EX);
    $snapshot=is_file($file)?json_decode(file_get_contents($file),true,512,JSON_THROW_ON_ERROR):['events'=>[]];
    flock($lock,LOCK_UN);
    $before=$snapshot['events'];
    deliver_events($snapshot);
    if ($before!==$snapshot['events']) {
        flock($lock,LOCK_EX);
        $db=json_decode(file_get_contents($file),true,512,JSON_THROW_ON_ERROR);
        foreach ($snapshot['events'] as $id=>$event) if ($event!==$before[$id]) $db['events'][$id]=$event;
        file_put_contents($file.'.tmp',json_encode($db,JSON_THROW_ON_ERROR)); rename($file.'.tmp',$file);
        flock($lock,LOCK_UN);
    }
    fclose($lock); sleep(1);
}
