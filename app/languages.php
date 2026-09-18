<?php
declare(strict_types=1);

// Empty overrides inherit the studio/project default; existing accounts stay English.
function language_field(mixed $value, bool $inherit=true): string {
    if(!is_string($value)||!in_array($value,$inherit?['','en','nl']:['en','nl'],true))fail('Choose English or Dutch.');
    return $value;
}
function migrate_languages(PDO $db): void {
    if($db->query("SELECT 1 FROM migrations WHERE name='languages-v1'")->fetchColumn())return;
    $db->exec('BEGIN IMMEDIATE');
    try {
        foreach(['studios'=>'en','projects'=>'','person_profiles'=>''] as $table=>$default) {
            if(!in_array('language',array_column($db->query("PRAGMA table_info($table)")->fetchAll(),'name'),true))
                $db->exec("ALTER TABLE $table ADD COLUMN language TEXT NOT NULL DEFAULT '$default'");
        }
        $db->exec("INSERT OR IGNORE INTO migrations(name) VALUES('languages-v1')");
        $db->exec('COMMIT');
    } catch(Throwable $e) { $db->exec('ROLLBACK');throw $e; }
}
function project_language(string $pid): array {
    $p=one('SELECT p.language,s.language AS studio_language FROM projects p JOIN studios s ON s.id=p.studio_id WHERE p.id=?',[$pid]);
    return ['language'=>$p['language']??'','studio_language'=>$p['studio_language']??'en'];
}

function project_view_language(string $pid,string $email): string {
    $project=project_language($pid);
    $profile=profile_for(person_key($email,true));
    return $profile['language']?:($project['language']?:$project['studio_language']);
}
function client_text(string $key,string $language='en',array $values=[]): string {
    static $catalogs=[];
    $language=in_array($language,['en','nl'],true)?$language:'en';
    $catalogs[$language]??=require __DIR__.'/languages/'.$language.'.php';
    $replacements=[];foreach($values as $name=>$value)$replacements['{'.$name.'}']=(string)$value;
    return strtr($catalogs[$language][$key]??$key,$replacements);
}
