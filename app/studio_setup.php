<?php
declare(strict_types=1);

function studio_business_types(): array {
    static $types;
    return $types ??= json_decode(file_get_contents(__DIR__.'/../public/assets/studio-types.json'),true,512,JSON_THROW_ON_ERROR);
}
function studio_business_type_field(mixed $value): string {
    if(!is_string($value)||!in_array($value,array_column(studio_business_types(),'id'),true))fail('Choose a business type.');
    return $value;
}
function studio_business_profile(string $type='interior',string $language='en'): array {
    $types=studio_business_types();
    $profile=$types[array_search($type,array_column($types,'id'),true) ?: 0];
    return array_merge($profile,$profile[$language==='nl'?'nl':'en']);
}
function migrate_studio_setup(PDO $db): void {
    if($db->query("SELECT 1 FROM migrations WHERE name='studio-setup-v1'")->fetchColumn())return;
    $db->exec('BEGIN IMMEDIATE');
    try {
        if(!$db->query("SELECT 1 FROM migrations WHERE name='studio-setup-v1'")->fetchColumn()){
            $db->exec("ALTER TABLE studios ADD COLUMN business_type TEXT NOT NULL DEFAULT 'interior'");
            $db->exec('ALTER TABLE studios ADD COLUMN setup_completed_at TEXT');
            // Established studios keep their workspace. Empty studios get the new introduction.
            $db->exec("UPDATE studios SET setup_completed_at=created_at WHERE EXISTS(SELECT 1 FROM projects WHERE projects.studio_id=studios.id)");
            $db->exec("INSERT INTO migrations(name) VALUES('studio-setup-v1')");
        }
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
function complete_studio_setup(array $u,array $input): void {
    studio_admin($u);
    $name=text_field($input['name']??'',100);if(!$name)fail('Give the studio a name.');
    $language=language_field($input['language']??'',false);
    $type=studio_business_type_field($input['business_type']??'');
    transaction(function()use($u,$name,$language,$type){
        // Retries and a second tab cannot overwrite a completed setup.
        query('UPDATE studios SET name=?,language=?,business_type=?,setup_completed_at=? WHERE id=? AND setup_completed_at IS NULL',[$name,$language,$type,now(),$u['studio_id']]);
    });
}
