<?php
declare(strict_types=1);
function website_html(string $v): string {return htmlspecialchars($v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
function website_copy(string $language,string $key): string {
    $en=['projects'=>'Selected projects','about'=>'Our studio','testimonials'=>'Kind words','contact'=>'Start a conversation','back'=>'All projects','watch'=>'Watch testimonial','skip'=>'Skip to content','notfound'=>'Page not found'];
    $nl=['projects'=>'Geselecteerde projecten','about'=>'Onze studio','testimonials'=>'Ervaringen','contact'=>'Laten we kennismaken','back'=>'Alle projecten','watch'=>'Bekijk de ervaring','skip'=>'Ga naar inhoud','notfound'=>'Pagina niet gevonden'];return ($language==='nl'?$nl:$en)[$key];
}
function website_styles(): string {
    return '*,*:before,*:after{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#faf9f6;color:#22251f;font:17px/1.7 system-ui,sans-serif}a{color:inherit;text-underline-offset:5px}a:focus-visible,button:focus-visible{outline:3px solid currentColor;outline-offset:5px}header,main,footer{width:min(1200px,90%);margin:auto}header{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:32px 0;border-bottom:1px solid #d7d8d1}header>a{font-weight:600;text-decoration:none}nav{display:flex;gap:24px;flex-wrap:wrap;font-size:14px}h1,h2,h3{font-family:Georgia,serif;font-weight:400;line-height:1.12;letter-spacing:-.035em}h1{font-size:clamp(44px,7vw,100px);max-width:1000px;margin:0 0 32px}h2{font-size:clamp(30px,4vw,54px);margin:0 0 32px}h3{font-size:30px;margin:18px 0 8px}p{max-width:750px;white-space:pre-line}section{padding:72px 0;border-bottom:1px solid #d7d8d1}.hero{padding:96px 0 72px}.hero>p{font-size:22px;max-width:650px}.eyebrow{font:12px system-ui;letter-spacing:.16em;text-transform:uppercase;margin-bottom:24px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:56px 32px}.project{text-decoration:none;display:block}.project img{aspect-ratio:4/3;object-fit:cover}.project p{margin:4px 0;font-size:14px}.gallery{display:grid;gap:32px;margin:40px 0}picture{display:block}img{display:block;width:100%;height:auto;background:#eee}.logo{max-width:160px;max-height:70px;object-fit:contain;background:transparent}.quotes{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:32px}blockquote{margin:0;padding:32px;border:1px solid #d7d8d1;border-top:4px solid var(--accent);border-radius:3px}blockquote p{font:25px/1.45 Georgia,serif;margin:0 0 24px}blockquote footer{width:100%;font-size:14px}blockquote .portrait{width:64px;height:64px;object-fit:cover;border-radius:50%;margin-bottom:16px}.cta{display:inline-block;padding:16px 26px;background:#252a24;color:white;text-decoration:none;margin:16px 0}footer{padding:40px 0;font-size:14px}.skip{position:absolute;left:12px;top:-100px;background:white;padding:12px}.skip:focus{top:12px}.warm{background:#f4ede2;color:#33291f}.warm h1,.warm h2{font-style:italic}.warm .project img{border-radius:100px 100px 4px 4px}.minimal{background:#fff;color:#171917}.minimal h1,.minimal h2,.minimal h3{font-family:system-ui,sans-serif;font-weight:500;letter-spacing:-.055em}.minimal .hero{padding:64px 0}.minimal .grid{gap:64px}.editorial .project:nth-child(even){padding-top:72px}.meta{font-size:14px;opacity:.8}@media(max-width:650px){header{align-items:flex-start;flex-direction:column;gap:16px}nav{gap:16px}.grid{grid-template-columns:1fr}.editorial .project:nth-child(even){padding-top:0}section,.hero{padding:48px 0}blockquote{padding:24px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}';
}
function website_image(array $image,array $assets,string $prefix,bool $eager=false,string $class=''): string {
    $a=$assets[$image['asset']]??null;if(!$a)return '';$e='website_html';$alt=$e($image['alt']);$loading=$eager?'loading="eager" fetchpriority="high"':'loading="lazy"';
    if(isset($a['preview']))return '<img src="'.$e($a['preview']).'" width="'.$a['width'].'" height="'.$a['height'].'" alt="'.$alt.'" class="'.$class.'" '.$loading.'>';
    $srcset=function(string $type)use($a,$prefix){return implode(', ',array_map(fn($v)=>$prefix.$v[$type].' '.$v['width'].'w',$a['variants']));};$last=end($a['variants']);
    return '<picture><source type="image/webp" srcset="'.$e($srcset('webp')).'" sizes="(max-width:650px) 90vw, 60vw"><img src="'.$e($prefix.$last['jpeg']).'" srcset="'.$e($srcset('jpeg')).'" sizes="(max-width:650px) 90vw, 60vw" width="'.$a['width'].'" height="'.$a['height'].'" alt="'.$alt.'" class="'.$class.'" decoding="async" '.$loading.'></picture>';
}
function website_quotes(array $d,array $assets,string $prefix,?string $project=null): string {
    $e='website_html';$out='';foreach($d['testimonials'] as $t){if(!$t['approved']||($project===null?!in_array($t['placement'],['home','both'],true):($t['project']!==$project||!in_array($t['placement'],['project','both'],true))))continue;
        $out.='<blockquote>'.($t['photo']?website_image(['asset'=>$t['photo'],'alt'=>$t['name']],$assets,$prefix,false,'portrait'):'').'<p>“'.$e($t['content']).'”</p><footer><strong>'.$e($t['name']).'</strong><br>'.$e($t['title']).($t['video']?'<p><a href="'.$e($t['video']).'" rel="noopener noreferrer">'.website_copy($d['language'],'watch').'</a></p>':'').'</footer></blockquote>';
    }return $out?'<div class="quotes">'.$out.'</div>':'';
}
function website_render(array $d,array $assets,string $origin,?array $project=null,bool $preview=false): string {
    $e='website_html';$lang=$d['language'];$prefix=$project?'../':'';$url=$origin.($project?'/projects/'.$project['slug'].'.html':'/');$title=$project?$project['title'].' | '.$d['name']:$d['title'];$description=$project?mb_substr($project['description'],0,160):$d['description'];
    $projects=array_values(array_filter($d['projects'],fn($p)=>$p['included']));$hero=$project['images'][0]??$projects[0]['images'][0]??null;$og='';if($hero&&isset($assets[$hero['asset']]['variants'])){$variants=$assets[$hero['asset']]['variants'];$og=$origin.'/'.end($variants)['jpeg'];}
    $schema=['@context'=>'https://schema.org','@type'=>'Organization','name'=>$d['name'],'url'=>$origin.'/'];if($d['email'])$schema['email']=$d['email'];
    $head='<!doctype html><html lang="'.$lang.'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'.$e($title).'</title><meta name="description" content="'.$e($description).'"><meta name="robots" content="'.($preview?'noindex,nofollow':'index,follow').'"><link rel="canonical" href="'.$e($url).'"><meta property="og:type" content="website"><meta property="og:title" content="'.$e($title).'"><meta property="og:description" content="'.$e($description).'"><meta property="og:url" content="'.$e($url).'">'.($og?'<meta property="og:image" content="'.$e($og).'"><meta name="twitter:card" content="summary_large_image">':'').'<style>:root{--accent:'.$d['accent'].'}'.website_styles().'</style><script type="application/ld+json">'.json_encode($schema,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_UNESCAPED_SLASHES).'</script></head>';
    $previewHome='/api.php?action=website_preview&website_studio='.($d['_studio_id']??'');
    $home=$preview?$previewHome:($project?'../index.html':'./index.html');$out=$head.'<body class="'.$d['template'].'"><a class="skip" href="#main">'.website_copy($lang,'skip').'</a><header><a href="'.$home.'">'.($d['logo']?website_image(['asset'=>$d['logo'],'alt'=>$d['name']],$assets,$prefix,true,'logo'):$e($d['name'])).'</a><nav aria-label="'.($lang==='nl'?'Hoofdnavigatie':'Main navigation').'">';
    foreach(['projects','about','contact'] as $key)$out.='<a href="'.$home.'#'.$key.'">'.website_copy($lang,$key).'</a>';$out.='</nav></header><main id="main">';
    if($project){$out.='<section class="hero"><a href="'.$home.'#projects">← '.website_copy($lang,'back').'</a><p class="eyebrow">'.$e($project['category']).'</p><h1>'.$e($project['title']).'</h1><p>'.$e($project['description']).'</p><p class="meta">'.$e($project['location']).'</p></section><div class="gallery">';foreach($project['images'] as $n=>$im)$out.=website_image($im,$assets,$prefix,$n===0);$out.='</div>'.website_quotes($d,$assets,$prefix,$project['id']);}
    else{
        $out.='<section class="hero"><p class="eyebrow">'.$e($d['name']).'</p><h1>'.$e($d['headline']).'</h1><p>'.$e($d['intro']).'</p></section>';
        foreach($d['sections'] as $section){$body='';
            if($section==='projects'){$body='<div class="grid">';foreach($projects as $n=>$p){$body.='<a class="project" href="'.($preview?$previewHome.'&project='.$p['id']:'projects/'.$p['slug'].'.html').'">'.(!empty($p['images'])?website_image($p['images'][0],$assets,'',$n===0):'').'<h3>'.$e($p['title']).'</h3><p>'.$e($p['category']).'</p></a>';}$body.='</div>';if(!$projects)$body='';}
            elseif($section==='about'&&$d['about'])$body='<p>'.$e($d['about']).'</p>';
            elseif($section==='testimonials')$body=website_quotes($d,$assets,'');
            elseif($section==='contact'&&$d['email'])$body='<a class="cta" href="mailto:'.$e($d['email']).'">'.$e($d['email']).'</a>';
            if($body)$out.='<section id="'.$section.'"><h2>'.website_copy($lang,$section).'</h2>'.$body.'</section>';
        }
    }
    return $out.'</main><footer>© '.gmdate('Y').' '.$e($d['name']).'</footer></body></html>';
}
function website_asset_ids(array $draft): array {
    $ids=$draft['logo']?[$draft['logo']]:[];foreach($draft['projects'] as $p)if($p['included'])foreach($p['images'] as $im)$ids[]=$im['asset'];foreach($draft['testimonials'] as $t)if($t['approved']&&$t['photo'])$ids[]=$t['photo'];return array_values(array_unique($ids));
}
function website_write(string $path,string $bytes): void {if(file_put_contents($path,$bytes)===false)throw new RuntimeException('Website storage is unavailable.');}
function website_optimize(array $asset,string $dir): array {
    if(!function_exists('imagewebp'))fail('Website publishing needs PHP GD with JPEG and WebP support.',503);
    $image=@imagecreatefromstring($asset['data']);if(!$image)fail('A website image could not be processed.');
    // Normalize camera orientation before removing EXIF metadata.
    if($asset['mime']==='image/jpeg'&&function_exists('exif_read_data')){
        $tmp=tmpfile();fwrite($tmp,$asset['data']);$meta=@exif_read_data(stream_get_meta_data($tmp)['uri']);fclose($tmp);$orientation=(int)($meta['Orientation']??1);
        if(in_array($orientation,[2,4,5,7],true))imageflip($image,IMG_FLIP_HORIZONTAL);
        $angle=match($orientation){3,4=>180,5,6=>-90,7,8=>90,default=>0};if($angle){$rotated=imagerotate($image,$angle,0);imagedestroy($image);$image=$rotated;}
    }
    $width=imagesx($image);$height=imagesy($image);$variants=[];$sizes=array_unique(array_map(fn($n)=>min($width,$n),[480,960,1600]));
    foreach($sizes as $w){$h=max(1,(int)round($height*$w/$width));$out=imagecreatetruecolor($w,$h);imagefill($out,0,0,imagecolorallocate($out,255,255,255));imagecopyresampled($out,$image,0,0,0,0,$w,$h,$width,$height);$base='assets/'.$asset['fingerprint'].'-'.$w;
        if(!imagewebp($out,$dir.'/'.$base.'.webp',80)||!imagejpeg($out,$dir.'/'.$base.'.jpg',82))throw new RuntimeException('Image compression failed.');imagedestroy($out);$variants[]=['width'=>$w,'webp'=>$base.'.webp','jpeg'=>$base.'.jpg'];
    }imagedestroy($image);return ['width'=>$width,'height'=>$height,'variants'=>$variants];
}
function website_publish(array $u,int $revision): array {
    $sid=$u['studio_id'];$root=website_dir($sid);if(!is_dir($root)&&!mkdir($root,0700,true))fail('Website storage is unavailable.',503);
    $lock=fopen($root.'/publish.lock','c');if(!$lock||!flock($lock,LOCK_EX))fail('Website publishing is busy.',409);
    $dir=null;
    try{
        $site=website_get($sid);website_require_paid($site);if((int)$site['revision']!==$revision)fail('Reload before publishing the latest draft.',409);$d=website_clean($sid,json_decode($site['draft'],true));
        $d=website_with_source($d);$checks=website_all_checks($sid,$d);if($checks['errors'])fail('Fix these before publishing: '.implode(' ',$checks['errors']));
        $id=id();$dir=$root.'/releases/'.$id;if(!mkdir($dir.'/public/assets',0700,true))fail('Website storage is unavailable.',503);
        $assets=[];foreach(website_source_assets($sid,website_page_assets($d)) as $aid){$a=one('SELECT * FROM website_assets WHERE id=? AND studio_id=?',[$aid,$sid]);$optimized=website_optimize($a,$dir.'/public');$last=end($optimized['variants']);$assets[$aid]=[...$optimized,'jpeg'=>'assets/'.$aid.'.jpg','webp'=>'assets/'.$aid.'.webp'];if(!copy($dir.'/public/'.$last['jpeg'],$dir.'/public/assets/'.$aid.'.jpg')||!copy($dir.'/public/'.$last['webp'],$dir.'/public/assets/'.$aid.'.webp'))throw new RuntimeException('Could not copy website images.');}
        $origin=website_origin($site);$pagePaths=[];$outputFiles=[];
        foreach($d['pages'] as $page)if(website_page_enabled($d,$page)){
            $pagePaths[$page['id']]=website_page_output($page);$folder=$page['slug']?$page['slug'].'/':'';
            if($folder&&!is_dir($dir.'/public/'.$folder)&&!mkdir($dir.'/public/'.$folder,0700,true))fail('Website storage is unavailable.',503);
            foreach(website_compile_page($d,$assets,$origin,$page) as $file=>$content){website_write($dir.'/public/'.$folder.$file,$content);$outputFiles[]=$folder.$file;}
        }
        $paths=[];foreach($d['projects'] as $p)if($p['included']){$detail=website_project_page($d,$p['id']);$paths[$p['id']]=$detail?website_page_output($detail):'index.html#project-'.$p['id'];}
        $redirects=[];$live=website_live($sid);$previous=$live?json_decode(@file_get_contents($root.'/releases/'.$live['release'].'/release.json')?:'{}',true):[];
        foreach($previous['page_paths']??[] as $pid=>$old){$target=$pagePaths[$pid]??'index.html';if($old!==$target&&!in_array($old,$pagePaths,true))$redirects[$old]=$target;}
        foreach($previous['paths']??[] as $pid=>$old)if(str_starts_with($old,'projects/')&&$old!==($paths[$pid]??'index.html')&&!in_array($old,$pagePaths,true))$redirects[$old]=$paths[$pid]??'index.html';
        foreach($previous['redirects']??[] as $old=>$to)if(!in_array($old,$pagePaths,true)&&!isset($redirects[$old]))$redirects[$old]=$redirects[$to]??$to;
        foreach($redirects as $old=>$to){
            if(!preg_match('~^(?:[a-z0-9-]+/){1,3}(?:index\.html|[a-z0-9-]+\.html)$~D',$old)||in_array($old,$outputFiles,true)){unset($redirects[$old]);continue;}
            if(!in_array(explode('#',$to)[0],$pagePaths,true))$to='index.html';$redirects[$old]=$to;
            $parent=dirname($dir.'/public/'.$old);if(!is_dir($parent))mkdir($parent,0700,true);$relative=str_repeat('../',substr_count($old,'/')).$to;
            website_write($dir.'/public/'.$old,'<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url='.website_html($relative).'"><title>Page moved</title></head><body><a href="'.website_html($relative).'">Continue</a></body></html>');$outputFiles[]=$old;
        }
        website_write($dir.'/public/_redirects',implode("\n",array_map(fn($old,$to)=>'/'.str_replace('/index.html','/',$old).' /'.str_replace('/index.html','/',$to).' 301',array_keys($redirects),$redirects))."\n");
        website_write($dir.'/public/_headers',"/*\n  Content-Security-Policy: ".website_code_policy()."\n  X-Content-Type-Options: nosniff\n");
        website_write($dir.'/public/robots.txt',"User-agent: *\nAllow: /\nSitemap: ".$origin."/sitemap.xml\n");website_write($dir.'/public/sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'.implode('',array_map(fn($p)=>'<url><loc>'.htmlspecialchars($origin.website_page_url($p),ENT_XML1,'UTF-8').'</loc></url>',array_values(array_filter($d['pages'],fn($p)=>website_page_enabled($d,$p))))).'</urlset>');
        website_write($dir.'/public/404.html','<!doctype html><html lang="'.$d['language'].'"><meta charset="utf-8"><meta name="robots" content="noindex"><title>'.website_copy($d['language'],'notfound').'</title><h1>'.website_copy($d['language'],'notfound').'</h1></html>');
        $release=['id'=>$id,'source_version'=>3,'created_at'=>now(),'revision'=>$revision,'origin'=>$origin,'paths'=>$paths,'page_paths'=>$pagePaths,'files'=>$outputFiles,'redirects'=>$redirects];website_write($dir.'/release.json',json_encode($release));website_write($dir.'/draft.json',json_encode($d));
        // Concurrent saves cannot accidentally publish a newer unreviewed draft.
        transaction(function()use($sid,$revision,$id,$release){$current=website_get($sid);website_require_paid($current);if((int)$current['revision']!==$revision)fail('The draft changed while publishing. Preview it and publish again.',409);website_set_live($current,$id,$release);});
        return $release;
    }catch(Throwable $e){if($dir)website_remove_build($dir);throw $e;}finally{flock($lock,LOCK_UN);fclose($lock);}
}
function website_remove_build(string $dir): void {if(!is_dir($dir))return;$files=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);foreach($files as $f){if($f->isDir())rmdir($f->getPathname());else unlink($f->getPathname());}rmdir($dir);}
function website_set_live(array $site,string $release,array $meta): void {
    $root=website_dir($site['studio_id']);$status=website_billing_status($site);$pointer=['release'=>$release,'published_at'=>now(),'revision'=>$meta['revision'],'paid_until'=>$status['until'],'domain'=>$site['domain_verified']?$site['domain']:''];$tmp=$root.'/current-'.id().'.tmp';website_write($tmp,json_encode($pointer));if(!rename($tmp,$root.'/current.json'))throw new RuntimeException('Could not activate the website.');
}
