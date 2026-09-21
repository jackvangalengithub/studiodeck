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
// Repair studios that finished the new wizard before billing was connected to it.
$completed=time()-2*BILLING_DAY;
query('UPDATE studios SET setup_completed_at=? WHERE id=?',[gmdate('Y-m-d\TH:i:s\Z',$completed),$sid]);
$other=create_studio($uid,'Second completed studio');query('UPDATE studios SET setup_completed_at=? WHERE id=?',[gmdate('Y-m-d\TH:i:s\Z',$completed+60),$other]);
$unfinished=create_studio($uid,'Unfinished studio');
query("DELETE FROM migrations WHERE name='studio-billing-setup-v1'");
migrate_studio_billing_setup($db);migrate_studio_billing_setup($db);
$b=billing_studio($sid);$second=billing_studio($other);
if((int)$b['trial_started_at']!==$completed||(int)$b['trial_ends_at']!==$completed+7*BILLING_DAY||billing_summary($sid)['needs_onboarding'])throw new RuntimeException('Completed setup was not repaired at its original date.');
if(!$second['onboarded_at']||$second['trial_ends_at']!==null||(int)one('SELECT COUNT(*) n FROM billing_trials WHERE user_id=?',[$uid])['n']!==1)throw new RuntimeException('Repair granted more than one trial.');
if(billing_studio($unfinished)['onboarded_at']!==null)throw new RuntimeException('Repair started an unfinished studio.');
if($b['customer_id']!=='cus_existing'||(int)$b['paid_until']!==123456)throw new RuntimeException('Repair changed existing paid billing details.');
echo "PASS Completed studio setup is repaired once, preserves dates and payment details, and does not repeat trials or start unfinished studios.\n";
