<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require_once __DIR__.'/../app/bootstrap.php';
[$command,$pid,$plan]=array_pad($argv,3,'');
if(!$pid||!in_array($plan,['project_pass','monthly'],true)){
    fwrite(STDERR,"Usage: php scripts/set-project-enhancement-plan.php PROJECT_ID project_pass|monthly\n");exit(1);
}
try{
    transaction(function()use($pid,$plan){
        if(!one('SELECT id FROM projects WHERE id=?',[$pid]))throw new RuntimeException('Project not found.');
        query('INSERT INTO project_enhancement_plans(project_id,plan_type) VALUES(?,?) ON CONFLICT(project_id) DO UPDATE SET plan_type=excluded.plan_type',[$pid,$plan]);
    });
    echo json_encode(project_enhancement_allowance($pid),JSON_PRETTY_PRINT)."\n";
}catch(Throwable $e){fwrite(STDERR,$e->getMessage()."\n");exit(1);}
