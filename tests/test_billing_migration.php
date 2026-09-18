<?php
declare(strict_types=1);
$tmp=sys_get_temp_dir().'/billing-migration-'.bin2hex(random_bytes(5));mkdir($tmp);putenv('DATABASE_PATH='.$tmp.'/db.sqlite');
require __DIR__.'/../app/bootstrap.php';
$db=db();$uid=id();insert('users',['id'=>$uid,'email'=>'migration@example.test','name'=>'Migration','created_at'=>now()]);$sid=create_studio($uid,'Migration');
query('UPDATE studio_billing SET customer_id=?,paid_until=? WHERE studio_id=?',['cus_existing',123456,$sid]);
$db->exec('ALTER TABLE studio_billing DROP COLUMN customer_parameters');
$db->exec("DELETE FROM migrations WHERE name='billing-customer-parameters-v1'");
migrate_billing($db);migrate_billing($db);
$b=billing_studio($sid);
if(!array_key_exists('customer_parameters',$b)||$b['customer_id']!=='cus_existing'||(int)$b['paid_until']!==123456)throw new RuntimeException('Migration lost billing data or failed to add the missing column.');
query('UPDATE studio_billing SET customer_parameters=? WHERE studio_id=?',['{"name":"Migration"}',$sid]);
if(billing_studio($sid)['customer_parameters']!=='{"name":"Migration"}')throw new RuntimeException('Customer parameters cannot be persisted.');
echo "PASS Existing billing database gains customer_parameters without losing billing records; repeated migration is safe.\n";
