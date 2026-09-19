<?php
declare(strict_types=1);
require_once __DIR__.'/../app/bootstrap.php';
if(PHP_SAPI!=='cli')exit;
if(!env('STRIPE_SECRET_KEY')){fwrite(STDERR,"Set STRIPE_SECRET_KEY first.\n");exit(1);}
if(!str_starts_with(env('STRIPE_SECRET_KEY'),'sk_test_')&&!in_array('--live',$argv,true)){fwrite(STDERR,"Use a test key first. Live setup requires --live.\n");exit(1);}
try{
    $lookup='studiodeck_website_v1_usd';$existing=stripe_request('GET','prices',['lookup_keys'=>[$lookup],'active'=>'true','limit'=>1]);
    if(!empty($existing['data']))$price=$existing['data'][0];
    else{$product=stripe_request('POST','products',['name'=>'StudioDeck Website','metadata'=>['studiodeck_package'=>'website']],'website-product-v1');$price=stripe_request('POST','prices',['product'=>$product['id'],'currency'=>'usd','unit_amount'=>3900,'tax_behavior'=>'exclusive','recurring'=>['interval'=>'month'],'lookup_key'=>$lookup],'website-price-usd-v1');}
    echo 'STRIPE_PRICE_WEBSITE='.$price['id']."\nUse the existing verified Stripe webhook and billing worker.\n";
}catch(Throwable $e){fwrite(STDERR,$e->getMessage()."\n");exit(1);}
