<?php
declare(strict_types=1);
require_once __DIR__.'/../app/bootstrap.php';
if(PHP_SAPI!=='cli')exit;
if(!env('STRIPE_SECRET_KEY')){fwrite(STDERR,"Set STRIPE_SECRET_KEY in the environment first.\n");exit(1);}
if(!str_starts_with(env('STRIPE_SECRET_KEY'),'sk_test_')&&!in_array('--live',$argv,true)){fwrite(STDERR,"Use a Stripe test key first. Live catalog creation requires --live.\n");exit(1);}
try{
    foreach(billing_catalog() as $key=>$p){
        // Lookup keys survive repeated setup runs; existing prices are never edited.
        $lookup=$key==='website'?'studiodeck_website_v1_eur':'studiodeck_v1_'.$key;
        $existing=stripe_request('GET','prices',['lookup_keys'=>[$lookup],'active'=>'true','limit'=>1]);
        if(!empty($existing['data']))$price=$existing['data'][0];
        else{
            $product=stripe_request('POST','products',['name'=>'Studiodeck '.$p['name'],'metadata'=>['studiodeck_package'=>$key]],'catalog-product-v1-'.$key);
            $params=['product'=>$product['id'],'currency'=>'eur','unit_amount'=>$p['cents'],'tax_behavior'=>'exclusive','lookup_key'=>$lookup];
            if(!in_array($key,['pass','extension'],true))$params['recurring']=['interval'=>'month'];
            $price=stripe_request('POST','prices',$params,'catalog-price-v1-'.$key);
        }
        echo 'STRIPE_PRICE_'.strtoupper($key).'='.$price['id']."\n";
    }
    $portal=stripe_request('POST','billing_portal/configurations',['business_profile'=>['headline'=>'Manage your Studiodeck billing'],'features'=>['customer_update'=>['enabled'=>'true','allowed_updates'=>['email','address','name','tax_id']],'invoice_history'=>['enabled'=>'true'],'payment_method_update'=>['enabled'=>'true'],'subscription_cancel'=>['enabled'=>'true','mode'=>'at_period_end'],'subscription_update'=>['enabled'=>'false']]],'studiodeck-portal-v1');
    echo 'STRIPE_PORTAL_CONFIGURATION='.$portal['id']."\n";
    echo "\nCopy these public configuration IDs into the application environment.\nConfigure /stripe-webhook.php and its signing secret using docs/billing.md.\n";
}catch(Throwable $e){fwrite(STDERR,$e->getMessage()."\n");exit(1);}
