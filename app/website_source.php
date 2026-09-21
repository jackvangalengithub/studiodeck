<?php
declare(strict_types=1);

function website_templates(?string $type=null): array {
    $templates=[
        ['id'=>'editorial','name'=>'The Editorial','description'=>'Confident typography and generous photography.','tone'=>'light'],
        ['id'=>'linen','name'=>'Linen','description'=>'Warm neutrals, soft shapes, thoughtful details.','tone'=>'warm'],
        ['id'=>'noir','name'=>'Noir','description'=>'Dark, cinematic, and quietly dramatic.','tone'=>'dark'],
        ['id'=>'gallery','name'=>'The Gallery','description'=>'A crisp grid that puts the work first.','tone'=>'light'],
        ['id'=>'coast','name'=>'Coast','description'=>'Airy blues and a relaxed coastal rhythm.','tone'=>'blue'],
        ['id'=>'atelier','name'=>'Atelier','description'=>'An intimate studio journal with a personal voice.','tone'=>'rose'],
        ['id'=>'panorama','name'=>'Panorama','description'=>'Immersive photography from the very first scroll.','tone'=>'dark'],
        ['id'=>'folio','name'=>'Folio','description'=>'Bold graphic proportions and architectural lines.','tone'=>'green'],
        ['id'=>'terracotta','name'=>'Terracotta','description'=>'Earthy color and a tactile Mediterranean mood.','tone'=>'clay'],
        ['id'=>'minimal','name'=>'Essential','description'=>'Precise, understated, and beautifully simple.','tone'=>'light'],
    ];
    if($type!==null){
        $recommended=studio_business_profile($type)['templates'];
        foreach($templates as &$template)$template['recommended']=in_array($template['id'],$recommended,true);
        unset($template);
        usort($templates,fn($a,$b)=>(array_search($a['id'],$recommended,true)===false?99:array_search($a['id'],$recommended,true))<=>(array_search($b['id'],$recommended,true)===false?99:array_search($b['id'],$recommended,true)));
    }
    return $templates;
}
function website_template_id(string $id): string {
    if($id==='warm')$id='linen';if(!in_array($id,array_column(website_templates(),'id'),true))fail('Choose a starting design.');return $id;
}
function website_source_document(string $html): DOMDocument {
    $dom=new DOMDocument('1.0','UTF-8');$old=libxml_use_internal_errors(true);$dom->loadHTML('<?xml encoding="utf-8" ?>'.$html,LIBXML_NONET);libxml_clear_errors();libxml_use_internal_errors($old);foreach(iterator_to_array($dom->childNodes) as $n)if($n->nodeType===XML_PI_NODE)$dom->removeChild($n);return $dom;
}
function website_code_text(mixed $value,int $limit): string {
    if(!is_string($value))fail('Website source must be text.');if(strlen($value)>$limit)fail('This source file or edit is too large.');return $value;
}
function website_source_files(array $files): array {
    if(array_diff(array_keys($files),['index.html','styles.css','script.js']))fail('Use only index.html, styles.css and script.js.');
    $out=[];foreach(['index.html'=>160000,'styles.css'=>100000,'script.js'=>80000] as $name=>$limit)$out[$name]=website_code_text($files[$name]??'',$limit);
    if(!trim($out['index.html']))fail('Keep an index.html page.');return $out;
}
function website_source_image(string $id,string $alt,bool $eager=false): string {
    if(!$id)return '';return '<picture><source type="image/webp" srcset="assets/'.$id.'.webp"><img src="assets/'.$id.'.jpg" alt="'.website_html($alt).'" loading="'.($eager?'eager':'lazy').'"'.($eager?' fetchpriority="high"':'').'></picture>';
}
function website_source_project(array $p): string {
    $e='website_html';$out='<section class="work-detail" id="project-'.$p['id'].'" data-project="'.$p['id'].'"><div class="section-heading"><p class="eyebrow">'.$e($p['category']?:'Selected work').'</p><h2>'.$e($p['title']).'</h2><p>'.$e($p['description']).'</p>'.($p['location']?'<p>'.$e($p['location']).'</p>':'').'</div><div class="project-gallery">';
    foreach($p['images'] as $im)$out.=website_source_image($im['asset'],$im['alt']);return $out.'</div></section>';
}
function website_testimonial_enabled(array $d,array $t): bool {
    if(!$t['approved'])return false;if(empty($t['project']))return true;foreach($d['projects'] as $p)if($p['id']===$t['project'])return (bool)$p['included'];return false;
}
function website_source_testimonial(array $t): string {
    if(!$t['approved'])return '';return '<blockquote data-testimonial="'.$t['id'].'" data-testimonial-project="'.website_html($t['project']??'').'">'.website_source_image($t['photo'],$t['name']).'<p>“'.website_html($t['content']).'”</p><footer><strong>'.website_html($t['name']).'</strong><span>'.website_html($t['title']).'</span>'.($t['video']?'<a href="'.website_html($t['video']).'" target="_blank" rel="noopener">Watch testimonial ↗</a>':'').'</footer></blockquote>';
}
function website_seed_files(array $d,string $template,?string $hero=null): array {
    $profile=studio_business_profile($d['business_type']??'interior',$d['language']??'en');
    $template=website_template_id($template);$e='website_html';$name=$e($d['name']);$headline=$e($d['headline']?:'Spaces with a story.');$hero??=$d['projects'][0]['images'][0]['asset']??$d['hero_asset']??'';
    $nav='<a href="#work">Our work</a><a href="#studio">The studio</a><a href="#contact">Let’s talk ↗</a>';
    $brand=$d['logo']?website_source_image($d['logo'],$d['name']):$name;
    $html='<!doctype html><html lang="'.($d['language']??'en').'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'.$e($d['title']).'</title><meta name="description" content="'.$e($d['description']?:($d['intro']?:$d['headline'])).'"><link rel="stylesheet" href="styles.css"><script src="script.js" defer></script></head><body class="'.$template.'"><a class="skip" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="#main">'.$brand.'</a><nav aria-label="Main navigation">'.$nav.'</nav></header><main id="main"><section class="hero"><div class="hero-copy"><p class="eyebrow">'.$name.' · '.$e($profile['label']).'</p><h1>'.$headline.'</h1><p class="intro">'.$e($d['intro']?:$profile['intro']).'</p><a class="text-link" href="#work">Explore our work <span>↓</span></a></div><div class="hero-image">'.website_source_image($hero,$profile['alt'],true).'<span class="image-caption">'.$e($profile['label']).'</span></div></section><section class="work" id="work"><div class="section-heading"><p class="eyebrow">01 / Selected work</p><h2>A sense of place.</h2></div><div class="work-grid">';
    foreach($d['projects'] as $p)if($p['included'])$html.='<a class="work-card" data-project-card="true" href="#project-'.$p['id'].'">'.website_source_image($p['images'][0]['asset']??'',$p['images'][0]['alt']??$p['title']).'<span>'.$e($p['category']).'</span><h3>'.$e($p['title']).' ↗</h3></a>';
    if(!array_filter($d['projects'],fn($p)=>$p['included']))$html.='<p class="empty-work">A collection of our work is coming soon.</p>';
    $html.='</div></section><section class="studio" id="studio"><div><p class="eyebrow">02 / The studio</p><h2>Good design starts<br>with a conversation.</h2></div><p>'.$e($d['about']?:$profile['intro']).'</p></section><section class="quotes" id="testimonials"><div class="section-heading"><p class="eyebrow">In good company</p><h2>Words from our clients.</h2></div><div class="quote-grid">';
    $hasQuotes=false;foreach($d['testimonials'] as $t)if(website_testimonial_enabled($d,$t)&&$t['placement']!=='project'){$html.=website_source_testimonial($t);$hasQuotes=true;}
    $html.='</div></section>';if(!$hasQuotes)$html=preg_replace('~<section class="quotes".*?</section>~s','',$html);
    foreach($d['projects'] as $p)if($p['included']){$section=website_source_project($p);$quotes='';foreach($d['testimonials'] as $t)if(website_testimonial_enabled($d,$t)&&$t['project']===$p['id']&&$t['placement']==='project')$quotes.=website_source_testimonial($t);$html.=substr($section,0,-10).$quotes.'</section>';}
    $html.='<section class="contact" id="contact"><p class="eyebrow">Your next chapter</p><h2>Let’s make room<br>for something good.</h2>'.($d['email']?'<a class="contact-link" href="mailto:'.$e($d['email']).'">'.$e($d['email']).' ↗</a>':'<p>Contact details coming soon.</p>').'</section></main><footer class="site-footer"><a href="#main">'.$name.'</a><span>© '.gmdate('Y').'</span><a href="#main">Back to top ↑</a></footer></body></html>';
    $css=<<<'CSS'
*,*::before,*::after{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:24px}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.7 Arial,sans-serif;--paper:#f8f7f2;--ink:#292b26;--muted:#67695f;--accent:#667252;--line:#d9d9cf}a{color:inherit;text-decoration:none}a:focus-visible,button:focus-visible{outline:3px solid var(--accent);outline-offset:6px}img{display:block;width:100%;height:auto}picture{display:block}h1,h2,h3,p{margin:0}h1,h2,h3{font-family:Georgia,serif;font-weight:400;line-height:1.04;letter-spacing:-.045em}h1{font-size:clamp(48px,6.8vw,108px)}h2{font-size:clamp(38px,4.6vw,70px)}h3{font-size:28px}.site-header,.site-footer,main{width:min(1400px,90%);margin:auto}.site-header{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:30px 0;border-bottom:1px solid var(--line)}.brand{font-size:22px;letter-spacing:-.05em;font-weight:600}.brand img{max-width:150px;max-height:65px;object-fit:contain}nav{display:flex;gap:30px;font-size:13px}.hero{display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:7%;padding:80px 0}.hero-copy{padding:24px 0}.eyebrow{font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;margin-bottom:28px}.intro{max-width:400px;color:var(--muted);margin-top:30px;font-size:18px}.text-link{display:inline-flex;gap:45px;border-bottom:1px solid var(--ink);padding:14px 0;margin-top:36px;font-size:13px}.hero-image{position:relative}.hero-image img{aspect-ratio:4/5;object-fit:cover}.image-caption{display:block;font-size:10px;letter-spacing:.12em;text-transform:uppercase;margin-top:12px}.work,.studio,.quotes,.work-detail{padding:90px 0;border-top:1px solid var(--line)}.section-heading{margin-bottom:42px}.section-heading>p:not(.eyebrow){max-width:700px;margin-top:20px;color:var(--muted);white-space:pre-line}.work-grid{display:grid;grid-template-columns:1fr 1fr;gap:50px 32px}.work-card img{aspect-ratio:4/3;object-fit:cover}.work-card>span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.13em;margin:20px 0 10px}.studio{display:grid;grid-template-columns:1fr 1fr;gap:10%;align-items:center}.studio>p{font-size:20px;white-space:pre-line;max-width:600px}.quote-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));gap:30px}blockquote{margin:0;border-top:2px solid var(--accent);padding:28px 0}blockquote>p{font:28px/1.4 Georgia,serif;margin-bottom:20px}blockquote img{width:60px;height:60px;object-fit:cover;border-radius:50%;margin-bottom:20px}blockquote footer{display:grid;font-size:12px;gap:4px}.project-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr));gap:24px}.project-gallery img{aspect-ratio:4/3;object-fit:cover}.contact{text-align:center;padding:110px 0;border-top:1px solid var(--line)}.contact-link{display:inline-block;border-bottom:1px solid currentColor;margin-top:40px;font-size:20px}.site-footer{padding:26px 0;display:flex;justify-content:space-between;border-top:1px solid var(--line);font-size:12px}.skip{position:absolute;top:-100px;background:var(--paper);padding:12px;z-index:10}.skip:focus{top:12px}.empty-work{color:var(--muted)}
.linen{--paper:#f3eee4;--ink:#453b2f;--muted:#6c6051;--accent:#97734f;--line:#dbd1c2}.linen h1,.linen h2{font-style:italic}.linen .hero-image img{border-radius:45% 45% 3px 3px}.linen .work-card:nth-child(even){padding-top:80px}
.noir{--paper:#191d1b;--ink:#eeeae0;--muted:#b2b8ad;--line:#3c433d;--accent:#bdc6a9}.noir .hero{grid-template-columns:1.2fr 1fr}.noir h1{text-transform:uppercase;font-family:Arial,sans-serif;font-weight:400;font-size:clamp(44px,6.2vw,96px)}.noir .hero-image img{aspect-ratio:3/4;filter:saturate(.65)}
.gallery{--paper:#fff;--ink:#252525;--line:#dedede}.gallery .hero{display:flex;flex-direction:column;align-items:stretch;padding-top:40px;gap:30px}.gallery h1{max-width:1000px;font-family:Arial,sans-serif;font-weight:600}.gallery .hero-image img{aspect-ratio:2.6/1}.gallery .intro{max-width:550px}.gallery .work-grid{grid-template-columns:repeat(3,1fr);gap:20px}
.coast{--paper:#eff5f4;--ink:#284648;--muted:#526b6e;--line:#c9d8d7;--accent:#58848b}.coast .hero-copy{text-align:center}.coast .intro{margin:30px auto 0}.coast .hero-image img{border-radius:180px 180px 0 0;aspect-ratio:3/4}.coast .contact{background:#dce9e6;border:0;padding-left:20px;padding-right:20px}
.atelier{--paper:#faf2ec;--ink:#4a3338;--muted:#7c6164;--accent:#a75e67;--line:#e1cdd0}.atelier .hero{grid-template-columns:1fr 1.1fr}.atelier .hero-image{transform:rotate(2deg);padding:15px;background:#fff;box-shadow:0 12px 40px #47383215}.atelier h1{font-style:italic}.atelier .hero-copy{padding-right:20px}.atelier .work-card:nth-child(odd){padding-top:60px}
.panorama{--paper:#141817;--ink:#f6f3eb;--muted:#c5ccc2;--line:#3b423a;--accent:#a7b198}.panorama .hero{display:grid;grid-template-columns:1fr;min-height:82vh;position:relative;padding:60px 6%;margin-top:26px;overflow:hidden;align-items:end}.panorama .hero-copy{position:relative;z-index:1;max-width:800px;text-shadow:0 2px 12px #0008}.panorama .hero-image{position:absolute;inset:0}.panorama .hero-image picture,.panorama .hero-image img{height:100%;object-fit:cover}.panorama .hero-image:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#081310dd,#08131022)}.panorama .image-caption{display:none}.panorama .intro{color:#fff}.panorama .work-grid{gap:50px}
.folio{--paper:#e6ebd8;--ink:#253328;--muted:#53634e;--line:#bec8b1;--accent:#465d3c}.folio h1,.folio h2,.folio h3{font-family:Arial,sans-serif;font-weight:600}.folio .hero{align-items:start;gap:3%}.folio .hero-image{margin-top:80px}.folio .hero-image img{aspect-ratio:1/1}.folio .work-card{border-top:2px solid var(--ink);padding-top:20px}.folio .site-header{border-bottom:2px solid var(--ink)}
.terracotta{--paper:#f5e4d3;--ink:#793c2b;--muted:#885b45;--line:#d9b9a0;--accent:#a65339}.terracotta .hero-image img{border-radius:220px 0 0 0}.terracotta h1,.terracotta h2{font-style:italic}.terracotta .contact{background:#793c2b;color:#fff4e4;padding-left:20px;padding-right:20px}.terracotta .work-grid{gap:70px}
.minimal{--paper:#fff;--ink:#252925;--muted:#626761;--line:#e0e3dd}.minimal h1,.minimal h2,.minimal h3{font-family:Arial,sans-serif;font-weight:400;letter-spacing:-.06em}.minimal .hero{grid-template-columns:1fr 1.35fr;padding:100px 0}.minimal h1{font-size:clamp(44px,5.4vw,80px)}.minimal .hero-image img{aspect-ratio:1/1}.minimal .site-header{border:0}.minimal .work-card h3{font-size:23px}
@media(max-width:700px){.site-header{align-items:flex-start;flex-direction:column;gap:16px}nav{gap:22px;flex-wrap:wrap}.hero,.noir .hero,.atelier .hero,.folio .hero,.minimal .hero{grid-template-columns:1fr;padding:40px 0;gap:30px}.hero-image img{aspect-ratio:4/3}.work-grid,.gallery .work-grid,.studio{grid-template-columns:1fr;gap:32px}.work,.studio,.quotes,.work-detail{padding:55px 0}.linen .work-card:nth-child(even),.atelier .work-card:nth-child(odd){padding-top:0}.folio .hero-image{margin-top:0}.gallery .hero-image img{aspect-ratio:4/3}.panorama .hero{padding:40px 7%;min-height:650px}.contact{padding:70px 0}.site-footer{flex-wrap:wrap;gap:20px}.atelier .hero-image{transform:none}.studio>p{font-size:18px}h1{overflow-wrap:break-word}.contact-link{font-size:17px;overflow-wrap:anywhere}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{animation:none!important;transition:none!important}}
CSS;
    return ['index.html'=>$html,'styles.css'=>$css,'script.js'=>'// This is your website. Add any vanilla JavaScript interactions here.'];
}
function website_with_source(array $draft): array {
    if(!isset($draft['files']))$draft['files']=website_seed_files($draft,$draft['template']??'editorial');
    $draft['started']=$draft['started']??true;$draft['conversation']=$draft['conversation']??[];return $draft;
}
function website_source_assets(string $sid,array $files): array {
    preg_match_all('~assets/([a-f0-9]{32})\.(?:jpg|webp)~',implode("\n",$files),$matches);$ids=array_values(array_unique($matches[1]));foreach($ids as $id)website_asset_check($sid,$id);return $ids;
}
function website_source_checks(string $sid,array $files): array {
    $errors=[];$warnings=[];$dom=website_source_document($files['index.html']);$xp=new DOMXPath($dom);
    if(!preg_match('~<html\b~i',$files['index.html'])||!preg_match('~<body\b~i',$files['index.html']))$errors[]='Keep a complete HTML document with html and body elements.';
    if($xp->query('//base|//iframe|//object|//embed')->length)$errors[]='Keep this a standalone page without embedded sites or a base URL.';
    foreach($xp->query('//script[@src]') as $node)if($node->getAttribute('src')!=='script.js')$errors[]='Use script.js for JavaScript, without external libraries.';
    foreach($xp->query('//link[@rel="stylesheet"]') as $node)if($node->getAttribute('href')!=='styles.css')$errors[]='Use styles.css for the website stylesheet.';
    foreach($xp->query('//script[@type="module"]') as $node)$errors[]='Use ordinary JavaScript scripts, without module imports.';
    if(preg_match('~@import\b~i',$files['styles.css']))$errors[]='Keep CSS in styles.css; external imports are not supported.';
    $ids=[];foreach($xp->query('//*[@id]') as $node){$id=$node->getAttribute('id');if(isset($ids[$id]))$errors[]='Duplicate page anchor: '.$id;$ids[$id]=true;}
    foreach($xp->query('//a[@href]') as $node){$url=$node->getAttribute('href');if(str_starts_with($url,'#')){if(strlen($url)>1&&!isset($ids[substr($url,1)]))$errors[]='Link points to a missing section: '.$url;}
        elseif(!preg_match('~^(?:https?://|mailto:|tel:)~i',$url))$errors[]='Keep page navigation on this single page using #section links.';}
    foreach($xp->query('//img') as $node){if(!$node->hasAttribute('alt'))$warnings[]='An image needs a description (alt text).';$src=$node->getAttribute('src');if(!preg_match('~^assets/[a-f0-9]{32}\.(?:jpg|webp)$~D',$src)&&!str_starts_with($src,'data:image/'))$errors[]='Use an image from this website’s asset library.';}
    if(!$xp->query('//title')->length||!trim($xp->evaluate('string(//title)')))$warnings[]='Add a descriptive page title.';
    if(!$xp->query('//meta[@name="description"]')->length)$warnings[]='Add a search description.';
    if(!$xp->query('//h1')->length)$warnings[]='Add a main heading (h1).';
    if(!$xp->query('//meta[@name="viewport"]')->length)$warnings[]='Add a viewport meta tag for mobile devices.';
    try{website_source_assets($sid,$files);}catch(RuntimeException $e){$errors[]='The source refers to an image outside this website.';}
    return ['errors'=>array_values(array_unique($errors)),'warnings'=>array_values(array_unique($warnings))];
}
function website_code_policy(bool $preview=false): string {
    return "sandbox allow-scripts allow-popups; default-src 'none'; script-src ".($preview?"'unsafe-inline'":"'self' 'unsafe-inline'")."; style-src 'self' 'unsafe-inline'; img-src ".($preview?'':"'self' ")."data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors ".($preview?"'self'":"'none'");
}
function website_source_compile(array $draft,array $assets,string $origin,bool $preview=false,string $channel=''): array {
    $draft=website_with_source($draft);$files=$draft['files'];$dom=website_source_document($files['index.html']);$xp=new DOMXPath($dom);$head=$dom->getElementsByTagName('head')->item(0);$body=$dom->getElementsByTagName('body')->item(0);
    $meta=function(string $key,string $value,string $attribute='name')use($dom,$head,$xp){foreach(iterator_to_array($xp->query('//meta[@'.$attribute.'="'.$key.'"]')) as $n)$n->parentNode->removeChild($n);$n=$dom->createElement('meta');$n->setAttribute($attribute,$key);$n->setAttribute('content',$value);$head->appendChild($n);};
    if(!$xp->query('//meta[@name="viewport"]')->length)$meta('viewport','width=device-width,initial-scale=1');
    $title=trim($xp->evaluate('string(//title)'))?:$draft['title'];if(!$xp->query('//title')->length)$head->appendChild($dom->createElement('title',htmlspecialchars($title,ENT_XML1,'UTF-8')));
    $description=trim($xp->evaluate('string(//meta[@name="description"]/@content)'))?:($draft['description']?:mb_substr(trim($xp->evaluate('string(//h1)')),0,160));$meta('description',$description);$meta('robots',$preview?'noindex,nofollow':'index,follow');
    foreach(iterator_to_array($xp->query('//link[@rel="canonical"]')) as $n)$n->parentNode->removeChild($n);$canonical=$dom->createElement('link');$canonical->setAttribute('rel','canonical');$canonical->setAttribute('href',$origin.'/');$head->appendChild($canonical);
    $meta('og:title',$title,'property');$meta('og:description',$description,'property');$meta('og:url',$origin.'/','property');$meta('og:type','website','property');
    $replacements=[];foreach($assets as $id=>$a){$replacements['assets/'.$id.'.jpg']=$a['jpeg'];$replacements['assets/'.$id.'.webp']=$a['webp'];}
    $first=true;foreach($xp->query('//img') as $im){$src=$im->getAttribute('src');if(preg_match('~^assets/([a-f0-9]{32})\.(jpg|webp)$~D',$src,$m)&&isset($assets[$m[1]])){$a=$assets[$m[1]];$im->setAttribute('src',$m[2]==='jpg'?$a['jpeg']:$a['webp']);$im->setAttribute('width',(string)$a['width']);$im->setAttribute('height',(string)$a['height']);if(!$preview){$format=$m[2]==='jpg'?'jpeg':'webp';$im->setAttribute('srcset',implode(', ',array_map(fn($v)=>$v[$format].' '.$v['width'].'w',$a['variants'])));if(!$im->hasAttribute('sizes'))$im->setAttribute('sizes','(max-width:700px) 90vw, 60vw');if($first)$meta('og:image',$origin.'/'.$a['jpeg'],'property');}else $im->removeAttribute('srcset');}
        if(!$im->hasAttribute('alt'))$im->setAttribute('alt','');if(!$im->hasAttribute('loading'))$im->setAttribute('loading',$first?'eager':'lazy');if($first)$im->setAttribute('fetchpriority','high');$im->setAttribute('decoding','async');$first=false;
    }
    foreach($xp->query('//source[@srcset]') as $n){$value=$n->getAttribute('srcset');if(preg_match('~^assets/([a-f0-9]{32})\.(webp|jpg)$~D',$value,$m)&&isset($assets[$m[1]])){$a=$assets[$m[1]];$format=$m[2]==='jpg'?'jpeg':'webp';$n->setAttribute('srcset',$preview?$a[$format]:implode(', ',array_map(fn($v)=>$v[$format].' '.$v['width'].'w',$a['variants'])));if(!$preview&&!$n->hasAttribute('sizes'))$n->setAttribute('sizes','(max-width:700px) 90vw, 60vw');}}
    if(!$xp->query('//script[@type="application/ld+json"]')->length){$n=$dom->createElement('script');$n->setAttribute('type','application/ld+json');$n->appendChild($dom->createTextNode(json_encode(['@context'=>'https://schema.org','@type'=>'Organization','name'=>$draft['name'],'url'=>$origin.'/'],JSON_HEX_TAG|JSON_HEX_AMP|JSON_UNESCAPED_SLASHES)));$head->appendChild($n);}
    if($preview){
        foreach(iterator_to_array($xp->query('//link[@rel="stylesheet"]')) as $n)$n->parentNode->removeChild($n);$style=$dom->createElement('style');$style->appendChild($dom->createTextNode(str_ireplace('</style','<\/style',strtr($files['styles.css'],$replacements))));$head->appendChild($style);
        foreach(iterator_to_array($xp->query('//script[@src]')) as $n)$n->parentNode->removeChild($n);
        // Diagnostics are advisory; this frame has no access to the parent or its credentials.
        $report=$dom->createElement('script');$report->appendChild($dom->createTextNode('(()=>{const errors=[];addEventListener("error",e=>{if(e.message)errors.push(e.message)});addEventListener("unhandledrejection",()=>errors.push("An interaction failed."));addEventListener("load",()=>setTimeout(()=>parent.postMessage({type:"website-preview-report",channel:'.json_encode($channel).',errors,missingImages:[...document.images].filter(i=>i.loading!=="lazy"&&(!i.complete||!i.naturalWidth)).length,overflow:document.documentElement.scrollWidth>innerWidth+2},"*"),500));})();'));$head->insertBefore($report,$head->firstChild);
        $script=$dom->createElement('script');$script->appendChild($dom->createTextNode(str_ireplace('</script','<\/script',strtr($files['script.js'],$replacements))));$body->appendChild($script);
    }
    $html=$dom->saveHTML();if($preview)$html=strtr($html,$replacements);
    return ['index.html'=>$html,'styles.css'=>strtr($files['styles.css'],$replacements),'script.js'=>strtr($files['script.js'],$replacements)];
}
function website_preview_assets(string $sid,array $files): array {
    $assets=[];foreach(website_source_assets($sid,$files) as $id){$a=one('SELECT * FROM website_assets WHERE studio_id=? AND id=?',[$sid,$id]);$raw=$a['data'];$im=@imagecreatefromstring($raw);if(!$im)fail('A website image is unavailable.');$w=min(1200,imagesx($im));$h=max(1,(int)round(imagesy($im)*$w/imagesx($im)));$scaled=imagecreatetruecolor($w,$h);imagefill($scaled,0,0,imagecolorallocate($scaled,255,255,255));imagecopyresampled($scaled,$im,0,0,0,0,$w,$h,imagesx($im),imagesy($im));ob_start();imagejpeg($scaled,null,78);$raw=ob_get_clean();imagedestroy($scaled);imagedestroy($im);$url='data:image/jpeg;base64,'.base64_encode($raw);$assets[$id]=['jpeg'=>$url,'webp'=>$url,'width'=>$w,'height'=>$h];}return $assets;
}
function website_start(array $u,array $b): array {
    $site=website_get($u['studio_id']);$d=json_decode($site['draft'],true);$template=website_template_id(text_field($b['template']??'',30));
    $studio=one('SELECT * FROM studios WHERE id=?',[$u['studio_id']]);
    $profile=studio_business_profile($studio['business_type'],$studio['language']);
    if(empty($d['started'])){
        $defaults=website_empty_draft($studio['name'],$studio['business_type'],$studio['language']);
        foreach(['name','headline','intro','title','language','business_type'] as $key)$d[$key]=$defaults[$key];
    }
    $d['business_type']=$studio['business_type'];
    if(empty($d['hero_asset']))$d['hero_asset']=website_store_image($u['studio_id'],file_get_contents(ROOT.'/public'.$profile['image']));
    $d['template']=$template;$d['started']=true;$d['files']=website_seed_files($d,$template);$d['conversation']=[];return website_save($u,$d,(int)($b['revision']??0));
}
function website_source_replace_result(array $files,array $result): array {
    $new=$result['files']??[];if(!is_array($new)||array_diff(array_keys($new),array_keys($files)))fail('The website edit returned unsupported files.');
    foreach($new as $file=>$content)$files[$file]=website_code_text($content,160000);
    foreach(website_array($result['patches']??[],30) as $patch){if(!is_array($patch))fail('The website edit returned an invalid change.');$file=$patch['file']??'';if(!array_key_exists($file,$files))fail('The website edit references an unknown file.');$find=website_code_text($patch['find']??'',160000);$replace=website_code_text($patch['replace']??'',160000);if(!$find||substr_count($files[$file],$find)!==1)fail('The edit could not be applied exactly. Your draft is unchanged; please try again.',409);$files[$file]=str_replace($find,$replace,$files[$file]);}
    return website_source_files($files);
}
function website_sync_materials(array $before,array $after): array {
    $old=website_with_source($before);if($after['files']!==$old['files'])return $after;
    $dom=website_source_document($after['files']['index.html']);$xp=new DOMXPath($dom);$main=$dom->getElementsByTagName('main')->item(0)??$dom->getElementsByTagName('body')->item(0);$changed=false;$changedProjects=[];
    $insert=function(DOMNode $parent,string $html,?DOMNode $replace=null,?DOMNode $before=null)use($dom){
        $part=website_source_document('<html><body>'.$html.'</body></html>');$fragment=$dom->createDocumentFragment();foreach(iterator_to_array($part->getElementsByTagName('body')->item(0)->childNodes) as $node)$fragment->appendChild($dom->importNode($node,true));
        if($replace)$parent->replaceChild($fragment,$replace);elseif($before)$parent->insertBefore($fragment,$before);else $parent->appendChild($fragment);
    };
    $appendToPage=function(string $html)use($main,$xp,$insert){$contact=$xp->query('//*[@id="contact"]')->item(0);$insert($main,$html,null,$contact?->parentNode===$main?$contact:null);};
    foreach(['projects','testimonials'] as $type){
        $previous=array_column($old[$type],null,'id');$current=array_column($after[$type],null,'id');
        foreach(array_unique([...array_keys($previous),...array_keys($current)]) as $id){
            $a=$previous[$id]??null;$b=$current[$id]??null;$projectChanged=$type==='testimonials'&&isset($changedProjects[$b['project']??$a['project']??'']);if($a===$b&&!$projectChanged)continue;$changed=true;if($type==='projects')$changedProjects[$id]=true;
            $attribute=$type==='projects'?'data-project':'data-testimonial';$nodes=iterator_to_array($xp->query('//*[@'.$attribute.'="'.$id.'"]'));
            $enabled=$b&&($type==='projects'?$b['included']:website_testimonial_enabled($after,$b));$snippet=$enabled?($type==='projects'?website_source_project($b):website_source_testimonial($b)):'';
            if($type==='testimonials'&&$a&&$b&&($a['placement']!==$b['placement']||$a['project']!==$b['project'])){foreach($nodes as $n)$n->parentNode->removeChild($n);$nodes=[];}
            if($nodes){foreach($nodes as $n){if($snippet)$insert($n->parentNode,$snippet,$n);else $n->parentNode->removeChild($n);}}
            elseif($snippet){
                if($type==='projects')$appendToPage($snippet);
                else{
                    $target=$b['placement']==='project'&&$b['project']?$xp->query('//*[@data-project="'.$b['project'].'"]')->item(0):null;
                    $target??=$xp->query('//*[@id="testimonials"]//*[contains(concat(" ",normalize-space(@class)," ")," quote-grid ")]')->item(0);
                    if(!$target)$target=$xp->query('//*[@id="testimonials"]')->item(0);
                    if($target)$insert($target,$snippet);
                    else $appendToPage('<section class="quotes" id="testimonials"><div class="section-heading"><h2>Words from our clients.</h2></div><div class="quote-grid">'.$snippet.'</div></section>');
                }
            }
            if($type==='projects'){
                $links=iterator_to_array($xp->query('//a[@href="#project-'.$id.'"]'));
                foreach($links as $link){
                    if(!$enabled)$link->parentNode->removeChild($link);
                    elseif($link->hasAttribute('data-project-card')){
                        foreach($link->getElementsByTagName('h3') as $heading)$heading->textContent=$b['title'].' ↗';
                        foreach($link->getElementsByTagName('span') as $label)$label->textContent=$b['category'];
                        foreach(iterator_to_array($link->getElementsByTagName('picture')) as $picture)$picture->parentNode->removeChild($picture);
                        if($b['images'])$insert($link,website_source_image($b['images'][0]['asset'],$b['images'][0]['alt']),null,$link->firstChild);
                    }
                }
                $grid=$xp->query('//*[contains(concat(" ",normalize-space(@class)," ")," work-grid ")]')->item(0);
                if($enabled&&!$links&&$grid)$insert($grid,'<a class="work-card" data-project-card="true" href="#project-'.$id.'">'.website_source_image($b['images'][0]['asset']??'',$b['images'][0]['alt']??$b['title']).'<span>'.website_html($b['category']).'</span><h3>'.website_html($b['title']).' ↗</h3></a>');
                if($enabled)foreach(iterator_to_array($xp->query('//*[@class="empty-work"]')) as $n)$n->parentNode->removeChild($n);
            }
        }
    }
    if($changed)$after['files']['index.html']=$dom->saveHTML();return $after;
}
